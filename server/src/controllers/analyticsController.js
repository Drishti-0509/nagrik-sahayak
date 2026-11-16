const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { checkOverdue, PENDING_STATUSES } = require('../services/slaService');
const { findComplaintsByPriority, toObjectId } = require('../utils/complaintQuery');

/**
 * Compute normalized complaint counts and SLA overdue metrics for a scoped query.
 * Pending statuses always include Submitted, Received, Under Review, Assigned, In Progress, Reopened.
 * Overdue calculations always exclude Resolved, Closed, and Rejected.
 * @param {Object} bucketQuery
 */
async function computeBucketStats(bucketQuery) {
  const [statusCountsRaw, activeComplaints] = await Promise.all([
    Complaint.aggregate([
      { $match: bucketQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Complaint.find({
      ...bucketQuery,
      status: { $in: [...PENDING_STATUSES] },
    }).select('status priority slaDeadline'),
  ]);

  const byStatus = {};
  let total = 0;
  for (const row of statusCountsRaw) {
    byStatus[row._id] = row.count;
    total += row.count;
  }

  const submitted = byStatus.Submitted || 0;
  const received = byStatus.Received || 0;
  const underReview = byStatus['Under Review'] || 0;
  const assigned = byStatus.Assigned || 0;
  const inProgress = byStatus['In Progress'] || 0;
  const reopened = byStatus.Reopened || 0;
  const resolvedOnly = byStatus.Resolved || 0;
  const closed = byStatus.Closed || 0;
  const rejected = byStatus.Rejected || 0;

  const resolved = resolvedOnly + closed;
  const pending = submitted + received + underReview + assigned + inProgress + reopened;

  let overdue = 0;
  let approachingDeadline = 0;
  let urgent = 0;

  for (const complaint of activeComplaints) {
    if (complaint.priority === 'Urgent') urgent++;
    const { isOverdue, hoursRemaining } = checkOverdue(complaint);
    if (isOverdue) {
      overdue++;
    } else if (hoursRemaining <= 24) {
      approachingDeadline++;
    }
  }

  return {
    total,
    pending,
    submitted,
    received,
    underReview,
    assigned,
    inProgress,
    reopened,
    resolved,
    closed,
    rejected,
    urgent,
    overdue,
    approachingDeadline,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
  };
}

/**
 * @desc    Get public aggregate metrics derived directly from MongoDB records
 * @route   GET /api/v1/analytics/public
 * @access  Public
 */
const getPublicStats = async (req, res, next) => {
  try {
    const [bucket, activeDepartments] = await Promise.all([
      computeBucketStats({}),
      Department.countDocuments({ isActive: true }),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalComplaints: bucket.total,
        resolvedComplaints: bucket.resolved,
        pendingComplaints: bucket.pending,
        rejectedComplaints: bucket.rejected,
        overdueComplaints: bucket.overdue,
        resolutionRate: bucket.resolutionRate,
        activeDepartments,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get dashboard metrics for logged-in Citizen
 * @route   GET /api/v1/analytics/citizen
 * @access  Protected (Citizen)
 */
const getCitizenStats = async (req, res, next) => {
  try {
    const citizenId = toObjectId(req.user._id);
    const citizenQuery = { citizen: citizenId };

    const [bucket, recentComplaints] = await Promise.all([
      computeBucketStats(citizenQuery),
      Complaint.find(citizenQuery)
        .populate('department', 'name code')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        total: bucket.total,
        resolved: bucket.resolved,
        inProgress: bucket.inProgress,
        submitted: bucket.submitted,
        received: bucket.received,
        underReview: bucket.underReview,
        assigned: bucket.assigned,
        rejected: bucket.rejected,
        reopened: bucket.reopened,
        closed: bucket.closed,
        pending: bucket.pending,
        overdue: bucket.overdue,
        resolutionRate: bucket.resolutionRate,
      },
      recentComplaints: recentComplaints.map((c) => ({
        ...c.toObject(),
        slaInfo: checkOverdue(c),
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get dashboard metrics for assigned Officer (with separated personal vs. department pool workloads)
 * @route   GET /api/v1/analytics/officer
 * @access  Protected (Officer / Admin)
 */
const getOfficerStats = async (req, res, next) => {
  try {
    const officerId = toObjectId(req.user._id);
    const deptId = toObjectId(req.user.department);
    const isAdmin = req.user.role === 'admin';

    const assignedToMeQuery = { assignedOfficer: officerId };

    const unassignedDeptQuery = deptId
      ? { department: deptId, assignedOfficer: null }
      : isAdmin
        ? { assignedOfficer: null }
        : { _id: null };

    const assignedToOthersQuery = deptId
      ? { department: deptId, assignedOfficer: { $exists: true, $nin: [null, officerId] } }
      : isAdmin
        ? { assignedOfficer: { $exists: true, $nin: [null, officerId] } }
        : { _id: null };

    const activeQueueQuery = isAdmin
      ? {
          ...(deptId ? { $or: [{ assignedOfficer: officerId }, { department: deptId }] } : {}),
          status: { $in: [...PENDING_STATUSES] },
        }
      : {
          $or: [
            { assignedOfficer: officerId },
            ...(deptId ? [{ department: deptId, assignedOfficer: null }] : []),
          ],
          status: { $in: [...PENDING_STATUSES] },
        };

    const [assignedToMe, unassignedDepartment, assignedToOthers, priorityQueue] = await Promise.all([
      computeBucketStats(assignedToMeQuery),
      computeBucketStats(unassignedDeptQuery),
      computeBucketStats(assignedToOthersQuery),
      findComplaintsByPriority(activeQueueQuery, {
        skip: 0,
        limit: 6,
        populate: [
          { path: 'citizen', select: 'name email phone' },
          { path: 'department', select: 'name code' },
          { path: 'assignedOfficer', select: 'name email' },
        ],
      }),
    ]);

    const departmentTotal = assignedToMe.total + unassignedDepartment.total + assignedToOthers.total;
    const departmentPending =
      assignedToMe.pending + unassignedDepartment.pending + assignedToOthers.pending;

    res.status(200).json({
      success: true,
      stats: {
        // Personal workload statistics strictly exclude other officers' assigned complaints
        ...assignedToMe,
        assignedToMe,
        unassignedDepartment,
        assignedToOthers,
        departmentTotal,
        departmentPending,
      },
      urgentComplaints: priorityQueue.map((c) => {
        const plain = typeof c.toObject === 'function' ? c.toObject() : c;
        return {
          ...plain,
          slaInfo: checkOverdue(plain),
        };
      }),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get system-wide metrics and reports for Administrator
 * @route   GET /api/v1/analytics/admin
 * @access  Protected (Admin only)
 */
const getAdminStats = async (req, res, next) => {
  try {
    const [
      bucket,
      escalatedComplaints,
      totalCitizens,
      totalOfficers,
      totalDepartments,
      recentAuditLogs,
      categoryStats,
      statusDistributionRaw,
      departmentStatsRaw,
      departments,
    ] = await Promise.all([
      computeBucketStats({}),
      Complaint.countDocuments({ isEscalated: true }),
      User.countDocuments({ role: 'citizen' }),
      User.countDocuments({ role: 'officer' }),
      Department.countDocuments({ isActive: true }),
      AuditLog.find().sort({ createdAt: -1 }).limit(10),
      Complaint.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Complaint.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Complaint.aggregate([
        { $match: { department: { $ne: null } } },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 },
            pendingCount: {
              $sum: {
                $cond: [{ $in: ['$status', [...PENDING_STATUSES]] }, 1, 0],
              },
            },
          },
        },
      ]),
      Department.find({ isActive: true }).select('name code').sort({ name: 1 }),
    ]);

    const deptCountMap = {};
    for (const d of departmentStatsRaw) {
      deptCountMap[d._id.toString()] = {
        count: d.count,
        pendingCount: d.pendingCount,
      };
    }

    const departmentStats = departments.map((dept) => {
      const counts = deptCountMap[dept._id.toString()] || { count: 0, pendingCount: 0 };
      return {
        departmentId: dept._id,
        code: dept.code,
        name: dept.name,
        count: counts.count,
        pendingCount: counts.pendingCount,
      };
    });

    res.status(200).json({
      success: true,
      stats: {
        totalComplaints: bucket.total,
        resolvedComplaints: bucket.resolved,
        closedComplaints: bucket.closed,
        inProgressComplaints: bucket.inProgress,
        submittedComplaints: bucket.submitted,
        receivedComplaints: bucket.received,
        underReviewComplaints: bucket.underReview,
        assignedComplaints: bucket.assigned,
        rejectedComplaints: bucket.rejected,
        reopenedComplaints: bucket.reopened,
        pendingComplaints: bucket.pending,
        escalatedComplaints,
        overdueComplaints: bucket.overdue,
        totalCitizens,
        totalOfficers,
        totalDepartments,
        resolutionRate: bucket.resolutionRate,
      },
      charts: {
        byCategory: categoryStats.map((c) => ({ category: c._id, count: c.count })),
        byStatus: statusDistributionRaw.map((s) => ({ status: s._id, count: s.count })),
        byDepartment: departmentStats,
      },
      recentAuditLogs,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPublicStats,
  getCitizenStats,
  getOfficerStats,
  getAdminStats,
};
