const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const { logAudit } = require('../services/auditService');
const { STANDARD_SLA_HOURS, PENDING_STATUSES } = require('../services/slaService');

/**
 * Normalize SLA hours map onto canonical standardized defaults (Low: 120, Medium: 72, High: 48, Urgent: 24).
 */
const normalizeSlaHours = (incomingSla, existingSla = STANDARD_SLA_HOURS) => {
  const base = existingSla?.toObject ? existingSla.toObject() : (existingSla || STANDARD_SLA_HOURS);
  const result = {
    Low: Number(base.Low) > 0 ? Number(base.Low) : STANDARD_SLA_HOURS.Low,
    Medium: Number(base.Medium) > 0 ? Number(base.Medium) : STANDARD_SLA_HOURS.Medium,
    High: Number(base.High) > 0 ? Number(base.High) : STANDARD_SLA_HOURS.High,
    Urgent: Number(base.Urgent) > 0 ? Number(base.Urgent) : STANDARD_SLA_HOURS.Urgent,
  };
  if (incomingSla && typeof incomingSla === 'object') {
    for (const priority of ['Low', 'Medium', 'High', 'Urgent']) {
      const value = Number(incomingSla[priority]);
      if (Number.isFinite(value) && value > 0) {
        result[priority] = value;
      }
    }
  }
  return result;
};

/**
 * @desc    Get all active departments (Public or Authenticated)
 * @route   GET /api/v1/departments
 * @access  Public / Protected
 */
const getDepartments = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const query = includeInactive === 'true' && req.user?.role === 'admin' ? {} : { isActive: true };

    const departments = await Department.find(query)
      .populate('headOfficer', 'name email phone')
      .sort({ name: 1 });

    // Include real complaint counts per department across all active pending statuses
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const count = await Complaint.countDocuments({ department: dept._id });
        const pendingCount = await Complaint.countDocuments({
          department: dept._id,
          status: { $in: PENDING_STATUSES },
        });
        return {
          ...dept.toObject(),
          totalComplaints: count,
          pendingComplaints: pendingCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: departmentsWithCounts.length,
      departments: departmentsWithCounts,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create new department
 * @route   POST /api/v1/departments
 * @access  Protected (Admin only)
 */
const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description, categories, slaHours, headOfficer } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Department name and code are required.',
      });
    }

    const existing = await Department.findOne({
      $or: [{ name: name.trim() }, { code: code.toUpperCase().trim() }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A department with this name or code already exists.',
      });
    }

    const department = await Department.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description: description ? description.trim() : '',
      categories: Array.isArray(categories) ? categories : [],
      slaHours: normalizeSlaHours(slaHours),
      headOfficer: headOfficer || null,
      isActive: true,
    });

    await logAudit({
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: 'admin',
      action: 'DEPARTMENT_CREATED',
      targetType: 'Department',
      targetId: department._id,
      details: { name: department.name, code: department.code },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      department,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update department
 * @route   PUT /api/v1/departments/:id
 * @access  Protected (Admin only)
 */
const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, categories, slaHours, headOfficer, isActive } = req.body;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    if (name) department.name = name.trim();
    if (description !== undefined) department.description = description.trim();
    if (categories && Array.isArray(categories)) department.categories = categories;
    if (slaHours) department.slaHours = normalizeSlaHours(slaHours, department.slaHours);
    if (headOfficer !== undefined) department.headOfficer = headOfficer;
    if (isActive !== undefined) department.isActive = Boolean(isActive);

    await department.save();

    await logAudit({
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: 'admin',
      action: 'DEPARTMENT_UPDATED',
      targetType: 'Department',
      targetId: department._id,
      details: { name: department.name },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      department,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
};
