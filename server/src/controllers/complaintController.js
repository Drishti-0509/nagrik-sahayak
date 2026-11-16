const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const User = require('../models/User');
const Evidence = require('../models/Evidence');
const {
  calculateDeadline,
  checkOverdue,
  PENDING_STATUSES,
  TERMINAL_STATUSES,
} = require('../services/slaService');
const {
  checkReopenEligibility,
  validateStatusTransition,
  buildTimelineEntry,
} = require('../services/complaintWorkflowService');
const { findComplaintsByPriority, toObjectId } = require('../utils/complaintQuery');
const { analyzeComplaint, CATEGORY_DEPARTMENT_MAP } = require('../services/geminiService');
const {
  createNotification,
  notifyUniqueRecipients,
  resolveDepartmentHeadOrAdmins,
  resolveReopenRecipients,
} = require('../services/notificationService');
const { logAudit } = require('../services/auditService');
const { escapeRegex, validateImageDataUri } = require('../utils/security');
const { storeEvidence, getEvidenceByComplaint } = require('../services/evidenceService');
const { checkDuplicateComplaints } = require('../services/duplicateDetectionService');
const { predictResolutionTime, getSlaMetrics } = require('../services/slaPredictionService');

// Helper to generate unique tracking ID e.g. NS-2026-84920
const generateTrackingId = () => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `NS-${year}-${randomNum}`;
};

/**
 * @desc    Submit a new complaint
 * @route   POST /api/v1/complaints
 * @access  Protected (Citizen only)
 */
const createComplaint = async (req, res, next) => {
  try {
    if (req.user.role !== 'citizen') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only citizens are authorized to submit grievances. Officers and administrators cannot submit complaints from staff accounts.',
      });
    }

    const { title, description, category, location, priority: userPriority, departmentId, evidenceImage } = req.body;

    if (!title || !description || !category || !location?.address) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category, and address are required.',
      });
    }

    const imageValidation = validateImageDataUri(evidenceImage, 'Evidence image');
    if (!imageValidation.valid) {
      return res.status(400).json({
        success: false,
        message: imageValidation.message,
      });
    }

    // Run AI / Heuristic Analysis
    const aiAnalysis = await analyzeComplaint({
      title,
      description,
      location,
    });

    // Determine final priority: citizen preference or AI suggestion
    const finalPriority = userPriority && ['Low', 'Medium', 'High', 'Urgent'].includes(userPriority)
      ? userPriority
      : aiAnalysis.prioritySuggestion || 'Medium';

    // Find target department: use explicit departmentId if selected, otherwise match by category or AI
    let department = null;
    let isExplicitDepartment = false;

    if (departmentId) {
      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res.status(400).json({ success: false, message: 'Invalid department ID.' });
      }
      department = await Department.findOne({ _id: departmentId, isActive: true });
      if (!department) {
        return res.status(400).json({
          success: false,
          message: 'Selected department is invalid, inactive, or not found.',
        });
      }

      // Enforce category-to-department compatibility
      const expectedDeptName = CATEGORY_DEPARTMENT_MAP[category];
      const isCompatible =
        (department.categories && department.categories.includes(category)) ||
        (expectedDeptName && department.name.toLowerCase().startsWith(expectedDeptName.toLowerCase())) ||
        (expectedDeptName && department.name.toLowerCase() === expectedDeptName.toLowerCase());

      if (!isCompatible) {
        return res.status(400).json({
          success: false,
          message: `Department "${department.name}" is incompatible with category "${category}". Expected department: "${expectedDeptName}".`,
        });
      }

      isExplicitDepartment = true;
    }

    if (!department) {
      const deptName = CATEGORY_DEPARTMENT_MAP[category] || aiAnalysis.departmentSuggestion;
      if (deptName) {
        department = await Department.findOne({
          name: { $regex: new RegExp(`^${escapeRegex(deptName)}`, 'i') },
          isActive: true,
        });
      }
    }

    // Calculate standardized SLA deadline (Low: 120h, Medium: 72h, High: 48h, Urgent: 24h)
    const slaDeadline = calculateDeadline(finalPriority);

    // Generate unique tracking reference with collision check (up to 10 attempts)
    let trackingId;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      trackingId = generateTrackingId();
      const existing = await Complaint.findOne({ trackingId }).select('_id');
      if (!existing) isUnique = true;
      attempts++;
    }

    if (!isUnique || !trackingId) {
      return res.status(500).json({
        success: false,
        message: 'Unable to allocate a unique tracking reference right now. Please retry.',
      });
    }

    const now = new Date();
    const initialTimeline = [
      buildTimelineEntry({
        eventType: 'complaint_created',
        status: 'Submitted',
        actor: req.user._id,
        actorName: req.user.name,
        actorRole: 'citizen',
        description: 'Complaint submitted by citizen through portal',
        timestamp: now,
      }),
    ];

    if (department) {
      const timelineDescription = isExplicitDepartment
        ? `Department selected by citizen: ${department.name}`
        : `Automatically routed by category to: ${department.name}`;

      const timelineActorName = isExplicitDepartment ? (req.user.name || 'Citizen') : 'System Router';
      const timelineActorRole = isExplicitDepartment ? (req.user.role || 'citizen') : 'system';

      initialTimeline.push(
        buildTimelineEntry({
          eventType: 'department_assigned',
          status: 'Submitted',
          actor: req.user._id,
          actorName: timelineActorName,
          actorRole: timelineActorRole,
          description: timelineDescription,
          timestamp: now,
        })
      );
    }

    // Check for potential duplicate complaints (Advisory Only - never blocks or auto-rejects)
    const duplicateMeta = {
      isPotentialDuplicate: false,
      highestSimilarity: 0,
      matchedComplaint: null,
      matchedTrackingId: '',
      checkedAt: now,
    };

    try {
      const dupCheck = await checkDuplicateComplaints({
        title: title.trim(),
        description: description.trim(),
        category,
        departmentId: department ? department._id : null,
        limit: 1,
      });

      if (dupCheck && dupCheck.isDuplicate && dupCheck.duplicates.length > 0) {
        const topDup = dupCheck.duplicates[0];
        duplicateMeta.isPotentialDuplicate = true;
        duplicateMeta.highestSimilarity = topDup.similarity || 0;
        duplicateMeta.matchedTrackingId = topDup.trackingId || '';
        if (mongoose.Types.ObjectId.isValid(topDup.id)) {
          duplicateMeta.matchedComplaint = topDup.id;
        }
      }
    } catch (dupErr) {
      console.warn('[ComplaintCreate] Duplicate advisory check warning:', dupErr.message);
    }

    // Predict resolution time via ML (Advisory Only - strictly preserves statutory slaDeadline)
    let predictedSlaMeta = {
      predictedHours: null,
      predictedDays: null,
      confidenceLevel: null,
      modelType: null,
      predictedAt: now,
    };

    try {
      const pred = await predictResolutionTime({
        category,
        department: department ? department.name : '',
        priority: finalPriority,
        description: description.trim(),
        location,
      });

      if (pred && pred.predictedHours) {
        predictedSlaMeta = {
          predictedHours: pred.predictedHours,
          predictedDays: pred.predictedDays,
          confidenceLevel: pred.confidenceLevel,
          modelType: pred.modelType,
          predictedAt: now,
        };
      }
    } catch (predErr) {
      console.warn('[ComplaintCreate] SLA prediction advisory warning:', predErr.message);
    }

    const complaint = await Complaint.create({
      trackingId,
      citizen: req.user._id,
      title: title.trim(),
      description: description.trim(),
      category,
      department: department ? department._id : null,
      location: {
        address: location.address.trim(),
        pincode: location.pincode ? location.pincode.trim() : '',
        latitude: location.latitude ? Number(location.latitude) : null,
        longitude: location.longitude ? Number(location.longitude) : null,
      },
      priority: finalPriority,
      status: 'Submitted',
      slaDeadline,
      evidenceImage: imageValidation.value,
      aiAnalysis,
      duplicateDetection: duplicateMeta,
      predictedSla: predictedSlaMeta,
      timeline: initialTimeline,
    });

    // Also persist citizen evidence into Evidence collection for uniform tracking
    if (imageValidation.value) {
      try {
        await storeEvidence({
          complaintId: complaint._id,
          cycleNumber: 1,
          evidenceType: 'citizen_complaint',
          rawImage: imageValidation.value,
          caption: `Citizen uploaded grievance photo`,
          user: req.user,
        });
      } catch (err) {
        console.warn('[Evidence] Non-fatal error storing citizen evidence record:', err.message);
      }
    }

    // Notify citizen after complaint persistence succeeds
    await createNotification({
      recipient: req.user._id,
      title: 'Complaint Registered',
      message: `Your grievance has been registered with reference ${trackingId}. SLA target: ${slaDeadline.toLocaleDateString()}.`,
      type: 'complaint_submitted',
      relatedComplaint: complaint._id,
      trackingId,
      eventKey: `submitted:${complaint._id}:${req.user._id}`,
    });

    // Notify department head if configured and active
    if (department?.headOfficer) {
      await createNotification({
        recipient: department.headOfficer,
        title: 'New Department Grievance',
        message: `New complaint ${trackingId} logged under ${category} (${finalPriority} priority).`,
        type: 'complaint_submitted',
        relatedComplaint: complaint._id,
        trackingId,
        eventKey: `submitted:${complaint._id}:${department.headOfficer}`,
      });
    }

    // Audit log
    await logAudit({
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: 'citizen',
      action: 'COMPLAINT_CREATED',
      targetType: 'Complaint',
      targetId: complaint._id,
      details: { trackingId, category, priority: finalPriority },
      req,
    });

    res.status(201).json({
      success: true,
      message: `Complaint submitted successfully with reference ID ${trackingId}`,
      complaint,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get current citizen's complaints
 * @route   GET /api/v1/complaints/my
 * @access  Protected (Citizen)
 */
const getMyComplaints = async (req, res, next) => {
  try {
    const { status, category, priority, search, page = 1, limit = 10 } = req.query;

    const query = { citizen: req.user._id };

    if (status && status !== 'all') query.status = status;
    if (category && category !== 'all') query.category = category;
    if (priority && priority !== 'all') query.priority = priority;

    if (search && search.trim()) {
      const term = escapeRegex(search);
      if (term) {
        query.$or = [
          { trackingId: { $regex: term, $options: 'i' } },
          { title: { $regex: term, $options: 'i' } },
          { 'location.address': { $regex: term, $options: 'i' } },
        ];
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [complaints, totalCount] = await Promise.all([
      Complaint.find(query)
        .select('-evidenceImage -resolutionEvidence')
        .populate('department', 'name code')
        .populate('assignedOfficer', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Complaint.countDocuments(query),
    ]);

    const enrichedComplaints = complaints.map((c) => {
      const slaInfo = checkOverdue(c);
      return {
        ...c.toObject(),
        slaInfo,
      };
    });

    res.status(200).json({
      success: true,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      currentPage: pageNum,
      complaints: enrichedComplaints,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get complaints assigned to current officer or officer's department
 * @route   GET /api/v1/complaints/assigned
 * @access  Protected (Officer)
 */
const getAssignedComplaints = async (req, res, next) => {
  try {
    const { status, priority, category, overdueOnly, search, page = 1, limit = 10 } = req.query;

    const officerObjId = toObjectId(req.user._id);
    const deptObjId = toObjectId(req.user.department);

    const query = {
      $or: [
        { assignedOfficer: officerObjId },
        ...(deptObjId ? [{ department: deptObjId }] : []),
      ],
    };

    if (status && status !== 'all') {
      query.status = status === 'pending' ? { $in: [...PENDING_STATUSES] } : status;
    }
    if (priority && priority !== 'all') query.priority = priority;
    if (category && category !== 'all') query.category = category;

    if (search && search.trim()) {
      const term = escapeRegex(search);
      if (term) {
        query.$and = [
          {
            $or: [
              { trackingId: { $regex: term, $options: 'i' } },
              { title: { $regex: term, $options: 'i' } },
              { 'location.address': { $regex: term, $options: 'i' } },
            ],
          },
        ];
      }
    }

    if (overdueOnly === 'true') {
      query.slaDeadline = { $lt: new Date() };
      if (!status || status === 'all' || status === 'pending') {
        query.status = { $in: [...PENDING_STATUSES] };
      } else if (TERMINAL_STATUSES.includes(status)) {
        // Closed, Resolved, and Rejected complaints are never counted as overdue
        query.status = { $in: [] };
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [complaints, totalCount] = await Promise.all([
      findComplaintsByPriority(query, {
        skip,
        limit: limitNum,
        populate: [
          { path: 'citizen', select: 'name email phone' },
          { path: 'department', select: 'name code' },
          { path: 'assignedOfficer', select: 'name email phone' },
        ],
      }),
      Complaint.countDocuments(query),
    ]);

    const enrichedComplaints = complaints.map((c) => {
      const plain = typeof c.toObject === 'function' ? c.toObject() : c;
      return {
        ...plain,
        slaInfo: checkOverdue(plain),
      };
    });

    res.status(200).json({
      success: true,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      currentPage: pageNum,
      complaints: enrichedComplaints,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get all complaints in system (Admin only)
 * @route   GET /api/v1/complaints
 * @access  Protected (Admin)
 */
const getAllComplaints = async (req, res, next) => {
  try {
    const {
      status,
      category,
      priority,
      department,
      officer,
      overdueOnly,
      search,
      sortBy,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status === 'pending' ? { $in: [...PENDING_STATUSES] } : status;
    }
    if (category && category !== 'all') query.category = category;
    if (priority && priority !== 'all') query.priority = priority;
    if (department && department !== 'all') {
      const deptId = toObjectId(department);
      if (deptId) query.department = deptId;
      else query._id = null;
    }
    if (officer && officer !== 'all') {
      const offId = toObjectId(officer);
      if (offId) query.assignedOfficer = offId;
      else query._id = null;
    }

    if (overdueOnly === 'true') {
      query.slaDeadline = { $lt: new Date() };
      if (!status || status === 'all' || status === 'pending') {
        query.status = { $in: [...PENDING_STATUSES] };
      } else if (TERMINAL_STATUSES.includes(status)) {
        query.status = { $in: [] };
      }
    }

    if (search && search.trim()) {
      const term = escapeRegex(search);
      if (term) {
        query.$or = [
          { trackingId: { $regex: term, $options: 'i' } },
          { title: { $regex: term, $options: 'i' } },
          { 'location.address': { $regex: term, $options: 'i' } },
        ];
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const complaintsPromise = sortBy === 'priority'
      ? findComplaintsByPriority(query, {
          skip,
          limit: limitNum,
          populate: [
            { path: 'citizen', select: 'name email phone' },
            { path: 'department', select: 'name code' },
            { path: 'assignedOfficer', select: 'name email' },
          ],
        })
      : Complaint.find(query)
          .select('-evidenceImage -resolutionEvidence')
          .populate('citizen', 'name email phone')
          .populate('department', 'name code')
          .populate('assignedOfficer', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum);

    const [complaints, totalCount] = await Promise.all([
      complaintsPromise,
      Complaint.countDocuments(query),
    ]);

    const enrichedComplaints = complaints.map((c) => {
      const plain = typeof c.toObject === 'function' ? c.toObject() : c;
      return {
        ...plain,
        slaInfo: checkOverdue(plain),
      };
    });

    res.status(200).json({
      success: true,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      currentPage: pageNum,
      complaints: enrichedComplaints,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get single complaint details by ID or Tracking ID
 * @route   GET /api/v1/complaints/:id
 * @access  Protected (Owner Citizen, Assigned/Dept Officer, Admin)
 */
const getComplaintById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Support lookup by MongoDB _id or trackingId string (e.g. NS-2026-10492)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const query = isObjectId ? { _id: id } : { trackingId: id.toUpperCase() };

    const complaint = await Complaint.findOne(query)
      .populate('citizen', 'name email phone address')
      .populate('department', 'name code categories')
      .populate('assignedOfficer', 'name email phone department')
      .populate('timeline.changedBy', 'name role')
      .populate('timeline.evidence')
      .populate('comments.user', 'name role');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
    }

    // Role-based Ownership Security Check
    if (req.user.role === 'citizen') {
      if (complaint.citizen._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view other citizens’ complaints.',
        });
      }
    } else if (req.user.role === 'officer') {
      const isAssigned = complaint.assignedOfficer?._id?.toString() === req.user._id.toString();
      const isDept = req.user.department && complaint.department?._id?.toString() === req.user.department.toString();

      if (!isAssigned && !isDept) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view complaints outside your assigned department.',
        });
      }
    }

    // Strip internal remarks/timeline entries and private officer fields when viewed by citizens
    const complaintObj = complaint.toObject();
    if (req.user.role === 'citizen') {
      complaintObj.comments = (complaintObj.comments || []).filter((c) => !c.isInternal);
      complaintObj.timeline = (complaintObj.timeline || []).filter((t) => !t.isInternal);
      if (complaintObj.assignedOfficer && typeof complaintObj.assignedOfficer === 'object') {
        delete complaintObj.assignedOfficer.phone;
        delete complaintObj.assignedOfficer.department;
      }
    }

    complaintObj.slaInfo = checkOverdue(complaint);
    complaintObj.reopenInfo = checkReopenEligibility(complaint);

    res.status(200).json({
      success: true,
      complaint: complaintObj,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update complaint status & resolution
 * @route   PUT /api/v1/complaints/:id/status
 * @access  Protected (Officer, Admin, Citizen for reopening only)
 */
const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, resolutionNotes, resolutionEvidence, rating, feedbackComment, comment } = req.body;

    const allowedStatuses = [
      'Submitted',
      'Received',
      'Under Review',
      'Assigned',
      'In Progress',
      'Resolved',
      'Closed',
      'Rejected',
      'Reopened',
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    const complaint = await Complaint.findById(id).populate('department');
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    let validatedResolutionEvidence = '';
    if (resolutionEvidence) {
      const evidenceValidation = validateImageDataUri(resolutionEvidence, 'Resolution evidence image');
      if (!evidenceValidation.valid) {
        return res.status(400).json({ success: false, message: evidenceValidation.message });
      }
      validatedResolutionEvidence = evidenceValidation.value;
    }

    // Centralized workflow & role-based status transition check (including 7-day citizen reopen rule)
    const transitionCheck = validateStatusTransition({
      user: req.user,
      complaint,
      targetStatus: status,
      notes,
      resolutionNotes,
    });

    if (!transitionCheck.allowed) {
      return res.status(transitionCheck.statusCode || 400).json({
        success: false,
        message: transitionCheck.message,
      });
    }

    const previousStatus = complaint.status;
    complaint.status = status;
    const now = new Date();

    let createdEvidenceDoc = null;
    let timelineEvidenceId = null;
    let timelineEventId = undefined;

    if (status === 'Resolved') {
      const nextCycle = (complaint.resolutionCycleCount || 0) + 1;
      complaint.resolutionCycleCount = nextCycle;
      complaint.resolvedAt = now;
      complaint.resolutionNotes = resolutionNotes
        ? resolutionNotes.trim()
        : notes?.trim() || 'Grievance resolved by department officer';

      timelineEventId = new mongoose.Types.ObjectId();

      if (validatedResolutionEvidence) {
        createdEvidenceDoc = await storeEvidence({
          complaintId: complaint._id,
          timelineEventId,
          cycleNumber: nextCycle,
          evidenceType: 'officer_resolution',
          rawImage: validatedResolutionEvidence,
          caption: complaint.resolutionNotes,
          user: req.user,
        });
        timelineEvidenceId = createdEvidenceDoc._id;
        complaint.resolutionEvidence = validatedResolutionEvidence;
      } else {
        // Critical requirement: If a reopened complaint is resolved without a new image:
        // - Do not create a fake evidence record.
        // - Set current top-level resolutionEvidence to empty string.
        // - Preserve earlier evidence records.
        // - Do not display an older image as proof of latest resolution.
        complaint.resolutionEvidence = '';
      }
    } else if (status === 'Closed') {
      complaint.closedAt = now;
      const feedbackNotes =
        (feedbackComment || comment || notes || 'Citizen confirmed resolution and closed ticket').trim();
      if (rating) {
        complaint.citizenFeedback = {
          rating: Number(rating),
          comment: feedbackNotes,
          submittedAt: now,
        };
      }
    } else if (status === 'Reopened') {
      complaint.resolvedAt = null;
      complaint.closedAt = null;
      complaint.reopenedAt = now;
      complaint.slaDeadline = calculateDeadline(complaint.priority);
      complaint.isEscalated = true;
      complaint.escalatedAt = now;
      complaint.escalationReason = notes?.trim() || 'Reopened by citizen due to dissatisfaction with resolution';
    }

    const timelineEventTypeMap = {
      Resolved: 'resolved',
      Closed: 'closed',
      Rejected: 'rejected',
      Reopened: 'reopened',
    };
    const defaultTimelineNote =
      status === 'Resolved'
        ? `Resolved: ${complaint.resolutionNotes}`
        : status === 'Reopened'
          ? `Grievance reopened: ${complaint.escalationReason}`
          : status === 'Closed'
            ? 'Grievance confirmed closed by complainant'
            : `Status transitioned from ${previousStatus} to ${status}`;

    const timelineEntry = buildTimelineEntry({
      eventType: timelineEventTypeMap[status] || 'status_changed',
      status,
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      description: notes && notes.trim() ? notes.trim() : defaultTimelineNote,
      evidence: timelineEvidenceId,
      timestamp: now,
    });
    if (timelineEventId) {
      timelineEntry._id = timelineEventId;
    }

    complaint.timeline.push(timelineEntry);

    try {
      await complaint.save();
    } catch (saveErr) {
      if (createdEvidenceDoc) {
        await Evidence.findByIdAndDelete(createdEvidenceDoc._id).catch(() => {});
      }
      throw saveErr;
    }

    const timelineIdx = complaint.timeline.length;

    // Emit role-appropriate notifications after persistence succeeds
    if (status === 'Reopened') {
      const recipients = await resolveReopenRecipients({
        complaint,
        department: complaint.department,
      });
      await notifyUniqueRecipients(recipients, (recipientId) => ({
        title: `Complaint Reopened: ${complaint.trackingId}`,
        message: `Grievance ${complaint.trackingId} (${complaint.title}) was reopened by ${req.user.name}. Reason: ${complaint.escalationReason}`,
        type: 'reopened',
        relatedComplaint: complaint._id,
        trackingId: complaint.trackingId,
        eventKey: `reopened:${complaint._id}:${timelineIdx}:${recipientId}`,
      }));

      // If admin reopened on citizen's behalf, inform citizen too
      if (complaint.citizen.toString() !== req.user._id.toString()) {
        await createNotification({
          recipient: complaint.citizen,
          title: `Grievance Reopened: ${complaint.trackingId}`,
          message: `Your complaint ${complaint.trackingId} has been reopened for further review.`,
          type: 'reopened',
          relatedComplaint: complaint._id,
          trackingId: complaint.trackingId,
          eventKey: `reopened_citizen:${complaint._id}:${timelineIdx}:${complaint.citizen}`,
        });
      }
    } else if (status === 'Closed') {
      await createNotification({
        recipient: complaint.citizen,
        title: `Grievance Closed: ${complaint.trackingId}`,
        message: `Your complaint ${complaint.trackingId} has been confirmed closed.`,
        type: 'closed',
        relatedComplaint: complaint._id,
        trackingId: complaint.trackingId,
        eventKey: `closed:${complaint._id}:${timelineIdx}:${complaint.citizen}`,
      });
    } else if (complaint.citizen.toString() !== req.user._id.toString()) {
      const notifTypeMap = {
        Received: 'complaint_received',
        Assigned: 'complaint_assigned',
        Resolved: 'resolved',
        Rejected: 'rejected',
      };
      await createNotification({
        recipient: complaint.citizen,
        title: `Grievance Status Updated: ${status}`,
        message: `Your complaint ${complaint.trackingId} status has changed to "${status}". ${notes ? `Note: ${notes.trim()}` : ''}`.trim(),
        type: notifTypeMap[status] || 'status_changed',
        relatedComplaint: complaint._id,
        trackingId: complaint.trackingId,
        eventKey: `status:${complaint._id}:${timelineIdx}:${complaint.citizen}`,
      });
    }

    // Audit log
    await logAudit({
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'STATUS_UPDATED',
      targetType: 'Complaint',
      targetId: complaint._id,
      details: { previousStatus, newStatus: status, notes },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Complaint status updated to ${status}`,
      complaint,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Assign officer or department to complaint
 * @route   PUT /api/v1/complaints/:id/assign
 * @access  Protected (Admin or Officer Head)
 */
const assignComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { departmentId, officerId, priority, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Only Admin or Officer can assign
    if (!['admin', 'officer'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (['Closed', 'Resolved', 'Rejected'].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign or transfer a complaint that is already ${complaint.status}.`,
      });
    }

    const currentComplaintDeptId = complaint.department?.toString() || null;

    // Officers are strictly scoped to their own department and cannot transfer complaints across departments
    if (req.user.role === 'officer') {
      const userDeptId = req.user.department?.toString();
      if (!userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Your officer account is not mapped to any department.',
        });
      }

      if (!currentComplaintDeptId || currentComplaintDeptId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to assign complaints outside your department.',
        });
      }

      if (departmentId && departmentId.toString() !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only administrators can transfer complaints to another department.',
        });
      }

      // Prevent claiming or assigning a complaint already assigned to another officer
      if (complaint.assignedOfficer) {
        if (complaint.assignedOfficer.toString() === req.user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: 'Complaint is already assigned to you.',
          });
        }
        return res.status(409).json({
          success: false,
          message: 'This complaint has already been assigned to another officer.',
        });
      }
    }

    let assignedOfficerName = null;
    let deptName = null;
    let targetDeptId = currentComplaintDeptId;

    if (departmentId) {
      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res.status(400).json({ success: false, message: 'Invalid department ID' });
      }
      const dept = await Department.findOne({ _id: departmentId, isActive: true });
      if (!dept) return res.status(400).json({ success: false, message: 'Invalid or inactive department' });
      complaint.department = dept._id;
      targetDeptId = dept._id.toString();
      deptName = dept.name;
    } else if (targetDeptId) {
      const existingDept = await Department.findById(targetDeptId).select('name');
      if (existingDept) deptName = existingDept.name;
    }

    if (officerId) {
      if (!mongoose.Types.ObjectId.isValid(officerId)) {
        return res.status(400).json({ success: false, message: 'Invalid officer ID' });
      }
      const officer = await User.findOne({ _id: officerId, role: 'officer', isActive: true });
      if (!officer) return res.status(400).json({ success: false, message: 'Invalid or inactive officer' });

      if (!targetDeptId) {
        return res.status(400).json({
          success: false,
          message: 'Please select a department before assigning an officer.',
        });
      }

      if (!officer.department || officer.department.toString() !== targetDeptId) {
        if (req.user.role === 'officer') {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You can only assign complaints to officers in your own department.',
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Selected officer does not belong to the complaint\'s department.',
        });
      }

      complaint.assignedOfficer = officer._id;
      assignedOfficerName = officer.name;

      if (['Submitted', 'Received', 'Under Review'].includes(complaint.status)) {
        complaint.status = 'Assigned';
      }
    } else if (departmentId && currentComplaintDeptId !== targetDeptId && complaint.assignedOfficer) {
      // Clear stale officer from old department when admin transfers to a new department without selecting a new officer
      complaint.assignedOfficer = null;
    }

    if (priority && ['Low', 'Medium', 'High', 'Urgent'].includes(priority)) {
      const priorityChanged = priority !== complaint.priority;
      complaint.priority = priority;
      if (priorityChanged) {
        complaint.slaDeadline = calculateDeadline(priority);
      }
    }

    const assignmentDesc = `Assigned to ${assignedOfficerName || 'department'}${deptName ? ` (${deptName})` : ''}. ${notes ? `Notes: ${notes.trim()}` : ''}`.trim();

    complaint.timeline.push(
      buildTimelineEntry({
        eventType: assignedOfficerName ? 'officer_assigned' : 'department_assigned',
        status: complaint.status,
        actor: req.user._id,
        actorName: req.user.name,
        actorRole: req.user.role,
        description: assignmentDesc,
        timestamp: new Date(),
      })
    );

    if (req.user.role === 'officer') {
      const freshDoc = await Complaint.findById(complaint._id).select('assignedOfficer');
      if (freshDoc?.assignedOfficer && freshDoc.assignedOfficer.toString() !== officerId?.toString()) {
        return res.status(409).json({
          success: false,
          message: 'This complaint has already been assigned to another officer.',
        });
      }
    }

    await complaint.save();

    const assignTimelineIdx = complaint.timeline.length;

    // Notify assigned officer (after save)
    if (officerId && complaint.assignedOfficer) {
      await createNotification({
        recipient: complaint.assignedOfficer,
        title: 'New Complaint Assigned',
        message: `You have been assigned complaint ${complaint.trackingId} (${complaint.title}).`,
        type: 'complaint_assigned',
        relatedComplaint: complaint._id,
        trackingId: complaint.trackingId,
        eventKey: `assigned_officer:${complaint._id}:${assignTimelineIdx}:${complaint.assignedOfficer}`,
      });
    }

    // Notify citizen (after save)
    await createNotification({
      recipient: complaint.citizen,
      title: assignedOfficerName ? 'Complaint Assigned' : 'Department Updated',
      message: assignedOfficerName
        ? `Your complaint ${complaint.trackingId} has been assigned to ${assignedOfficerName}${deptName ? ` (${deptName})` : ''}.`
        : `Your complaint ${complaint.trackingId} has been routed to ${deptName || 'the concerned department'}.`,
      type: 'complaint_assigned',
      relatedComplaint: complaint._id,
      trackingId: complaint.trackingId,
      eventKey: `assigned_citizen:${complaint._id}:${assignTimelineIdx}:${complaint.citizen}`,
    });

    // Audit log
    await logAudit({
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'OFFICER_ASSIGNED',
      targetType: 'Complaint',
      targetId: complaint._id,
      details: { officerId, departmentId, priority },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Complaint assignment updated successfully',
      complaint,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Add comment or progress note
 * @route   POST /api/v1/complaints/:id/comments
 * @access  Protected
 */
const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, isInternal = false } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Role security check
    if (req.user.role === 'citizen') {
      const citizenId = (complaint.citizen?._id || complaint.citizen)?.toString();
      if (citizenId !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You cannot comment on another citizen’s grievance.' });
      }
    } else if (req.user.role === 'officer') {
      const assignedId = (complaint.assignedOfficer?._id || complaint.assignedOfficer)?.toString();
      const complaintDeptId = (complaint.department?._id || complaint.department)?.toString();
      const userDeptId = (req.user.department?._id || req.user.department)?.toString();

      const isAssigned = assignedId === req.user._id.toString();
      const isDept = Boolean(userDeptId && complaintDeptId && complaintDeptId === userDeptId);

      if (!isAssigned && !isDept) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to comment on complaints outside your assigned department.',
        });
      }
    }

    // Only officers and admins can mark internal notes
    const safeIsInternal = req.user.role === 'citizen' ? false : Boolean(isInternal);
    const now = new Date();

    const comment = {
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      message: message.trim(),
      isInternal: safeIsInternal,
      timestamp: now,
    };

    complaint.comments.push(comment);

    // Record public progress notes on timeline without exposing internal staff notes
    if (!safeIsInternal) {
      const prefix = req.user.role === 'citizen' ? 'Citizen remark' : 'Progress update';
      complaint.timeline.push(
        buildTimelineEntry({
          eventType: 'progress_note',
          status: complaint.status,
          actor: req.user._id,
          actorName: req.user.name,
          actorRole: req.user.role,
          description: `${prefix}: ${comment.message}`,
          timestamp: now,
          isInternal: false,
        })
      );
    }

    await complaint.save();

    const savedComment = complaint.comments[complaint.comments.length - 1];

    // If officer or admin added non-internal note, notify citizen
    if (['officer', 'admin'].includes(req.user.role) && !safeIsInternal) {
      await createNotification({
        recipient: complaint.citizen,
        title: 'New Update on Grievance',
        message: `${req.user.name} added a progress note on your grievance ${complaint.trackingId}: "${comment.message.substring(0, 80)}${comment.message.length > 80 ? '...' : ''}"`,
        type: 'officer_note',
        relatedComplaint: complaint._id,
        trackingId: complaint.trackingId,
        eventKey: `comment:${complaint._id}:${savedComment._id}:${complaint.citizen}`,
      });
    }

    // If citizen replied, notify assigned officer
    if (req.user.role === 'citizen' && complaint.assignedOfficer) {
      await createNotification({
        recipient: complaint.assignedOfficer,
        title: 'Citizen Comment',
        message: `Citizen replied on ${complaint.trackingId}: "${comment.message.substring(0, 80)}${comment.message.length > 80 ? '...' : ''}"`,
        type: 'officer_note',
        relatedComplaint: complaint._id,
        trackingId: complaint.trackingId,
        eventKey: `comment:${complaint._id}:${savedComment._id}:${complaint.assignedOfficer}`,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: savedComment,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Escalate complaint
 * @route   PUT /api/v1/complaints/:id/escalate
 * @access  Protected
 */
const escalateComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    const complaint = await Complaint.findById(id).populate('department');
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (req.user.role === 'citizen') {
      const citizenId = (complaint.citizen?._id || complaint.citizen)?.toString();
      if (citizenId !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You cannot escalate another citizen’s grievance.' });
      }
    } else if (req.user.role === 'officer') {
      const assignedId = (complaint.assignedOfficer?._id || complaint.assignedOfficer)?.toString();
      const complaintDeptId = (complaint.department?._id || complaint.department)?.toString();
      const userDeptId = (req.user.department?._id || req.user.department)?.toString();

      const isAssigned = assignedId === req.user._id.toString();
      const isDept = Boolean(userDeptId && complaintDeptId && complaintDeptId === userDeptId);

      if (!isAssigned && !isDept) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to escalate complaints outside your assigned department.',
        });
      }
    }

    if (['Closed', 'Resolved', 'Rejected'].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot escalate a complaint that is already ${complaint.status}.`,
      });
    }

    if (complaint.isEscalated) {
      return res.status(400).json({
        success: false,
        message: 'This complaint has already been escalated.',
      });
    }

    const now = new Date();
    complaint.isEscalated = true;
    complaint.escalatedAt = now;
    complaint.escalationReason = reason
      ? reason.trim()
      : 'Escalated by user due to SLA breach or urgent civic attention needed';

    complaint.timeline.push(
      buildTimelineEntry({
        eventType: 'escalated',
        status: complaint.status,
        actor: req.user._id,
        actorName: req.user.name,
        actorRole: req.user.role,
        description: `Grievance Escalated: ${complaint.escalationReason}`,
        timestamp: now,
      })
    );

    await complaint.save();

    // Notify department head or fallback active administrators (prevent duplicates via eventKey)
    const escalationRecipients = await resolveDepartmentHeadOrAdmins(complaint.department);
    await notifyUniqueRecipients(escalationRecipients, (recipientId) => ({
      title: `Escalated Grievance: ${complaint.trackingId}`,
      message: `Complaint ${complaint.trackingId} (${complaint.title}) has been escalated by ${req.user.name}. Reason: ${complaint.escalationReason}`,
      type: 'escalated',
      relatedComplaint: complaint._id,
      trackingId: complaint.trackingId,
      eventKey: `escalated:${complaint._id}:${now.getTime()}:${recipientId}`,
    }));

    await logAudit({
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'COMPLAINT_ESCALATED',
      targetType: 'Complaint',
      targetId: complaint._id,
      details: { reason: complaint.escalationReason },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Complaint has been escalated to senior administration.',
      complaint,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get all evidence records for a complaint
 * @route   GET /api/v1/complaints/:id/evidence
 * @access  Protected (Owner Citizen, Assigned/Department Officer, Admin)
 */
const getComplaintEvidence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const query = isObjectId ? { _id: id } : { trackingId: id.toUpperCase() };

    const complaint = await Complaint.findOne(query)
      .populate('citizen', 'name email phone')
      .populate('department', 'name code')
      .populate('assignedOfficer', 'name email');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Role-based Access Control Check
    if (req.user.role === 'citizen') {
      const citizenId = complaint.citizen?._id ? complaint.citizen._id.toString() : complaint.citizen.toString();
      if (citizenId !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view evidence for other citizens’ complaints.',
        });
      }
    } else if (req.user.role === 'officer') {
      const userDeptId = req.user.department ? req.user.department.toString() : null;
      const complaintDeptId = complaint.department?._id
        ? complaint.department._id.toString()
        : complaint.department
          ? complaint.department.toString()
          : null;
      const isAssigned = complaint.assignedOfficer?._id
        ? complaint.assignedOfficer._id.toString() === req.user._id.toString()
        : complaint.assignedOfficer
          ? complaint.assignedOfficer.toString() === req.user._id.toString()
          : false;
      const isDept = Boolean(userDeptId && complaintDeptId && userDeptId === complaintDeptId);

      if (!isAssigned && !isDept) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view evidence for complaints outside your department.',
        });
      }
    }

    const evidenceRecords = await getEvidenceByComplaint(complaint._id);

    // Legacy fallback: if no Evidence collection records exist, synthesize from complaint document
    if (evidenceRecords.length === 0 && (complaint.evidenceImage || complaint.resolutionEvidence)) {
      const legacyItems = [];
      if (complaint.evidenceImage) {
        legacyItems.push({
          _id: 'legacy-citizen-' + complaint._id,
          complaint: complaint._id,
          cycleNumber: 1,
          evidenceType: 'citizen_complaint',
          storageType: 'base64',
          dataUrl: complaint.evidenceImage,
          mimeType: complaint.evidenceImage.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          fileSizeBytes: Math.round((complaint.evidenceImage.length * 3) / 4),
          caption: 'Citizen uploaded grievance photo',
          uploadedBy: {
            _id: complaint.citizen?._id || complaint.citizen,
            name: complaint.citizen?.name || 'Citizen',
            role: 'citizen',
          },
          uploaderRole: 'citizen',
          createdAt: complaint.createdAt,
          isLegacyFallback: true,
        });
      }
      if (complaint.resolutionEvidence) {
        legacyItems.push({
          _id: 'legacy-resolution-' + complaint._id,
          complaint: complaint._id,
          cycleNumber: 1,
          evidenceType: 'officer_resolution',
          storageType: 'base64',
          dataUrl: complaint.resolutionEvidence,
          mimeType: complaint.resolutionEvidence.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          fileSizeBytes: Math.round((complaint.resolutionEvidence.length * 3) / 4),
          caption: complaint.resolutionNotes || 'Official resolution proof',
          uploadedBy: {
            _id: complaint.assignedOfficer?._id || complaint.assignedOfficer || null,
            name: complaint.assignedOfficer?.name || 'Assigned Officer',
            role: 'officer',
          },
          uploaderRole: 'officer',
          createdAt: complaint.resolvedAt || complaint.updatedAt,
          isLegacyFallback: true,
        });
      }
      return res.status(200).json({
        success: true,
        count: legacyItems.length,
        evidence: legacyItems,
      });
    }

    res.status(200).json({
      success: true,
      count: evidenceRecords.length,
      evidence: evidenceRecords,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Check for potential duplicate complaints (Advisory Only)
 * @route   POST /api/v1/complaints/check-duplicates
 * @access  Protected
 */
const checkDuplicates = async (req, res, next) => {
  try {
    const { title, description, category, departmentId, excludeComplaintId, threshold, limit } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required to check for duplicates.',
      });
    }

    const result = await checkDuplicateComplaints({
      title,
      description,
      category,
      departmentId,
      excludeComplaintId,
      threshold,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Predict grievance resolution duration (Advisory Only)
 * @route   POST /api/v1/complaints/predict-sla
 * @access  Protected
 */
const predictSla = async (req, res, next) => {
  try {
    const { category, department, priority, description, location } = req.body;

    const result = await predictResolutionTime({
      category,
      department,
      priority,
      description,
      location,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get authentic SLA ML model evaluation metrics
 * @route   GET /api/v1/complaints/sla-metrics
 * @access  Protected
 */
const getSlaModelMetrics = async (req, res, next) => {
  try {
    const metrics = getSlaMetrics();
    return res.status(200).json({
      success: true,
      metrics: metrics || { message: 'Metrics not yet generated' },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getAssignedComplaints,
  getAllComplaints,
  getComplaintById,
  getComplaintEvidence,
  updateComplaintStatus,
  assignComplaint,
  addComment,
  escalateComplaint,
  checkDuplicates,
  predictSla,
  getSlaModelMetrics,
};
