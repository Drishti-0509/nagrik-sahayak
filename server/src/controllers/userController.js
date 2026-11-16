const User = require('../models/User');
const Department = require('../models/Department');
const { logAudit } = require('../services/auditService');
const { escapeRegex } = require('../utils/security');

/**
 * @desc    Get all users with filters & pagination
 * @route   GET /api/v1/users
 * @access  Protected (Admin only)
 */
const getUsers = async (req, res, next) => {
  try {
    const { role, department, isActive, search, page = 1, limit = 15 } = req.query;

    const query = {};

    if (role && role !== 'all') query.role = role;
    if (department && department !== 'all') query.department = department;
    if (isActive !== undefined && isActive !== 'all') query.isActive = isActive === 'true';

    if (search && search.trim()) {
      const term = escapeRegex(search);
      if (term) {
        query.$or = [
          { name: { $regex: term, $options: 'i' } },
          { email: { $regex: term, $options: 'i' } },
          { phone: { $regex: term, $options: 'i' } },
        ];
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const skip = (pageNum - 1) * limitNum;

    const [users, totalCount] = await Promise.all([
      User.find(query)
        .populate('department', 'name code')
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      currentPage: pageNum,
      users,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create a new Department Officer
 * @route   POST /api/v1/users/officers
 * @access  Protected (Admin only)
 */
const createOfficer = async (req, res, next) => {
  try {
    const { name, email, password, departmentId, phone } = req.body;

    if (!name || !email || !password || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, temporary password, and department are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(400).json({ success: false, message: 'Invalid department specified.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    const officer = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'officer',
      department: department._id,
      phone: phone ? phone.trim() : '',
      isActive: true,
    });

    await logAudit({
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: 'admin',
      action: 'OFFICER_CREATED',
      targetType: 'User',
      targetId: officer._id,
      details: { email: officer.email, department: department.name },
      req,
    });

    const safeOfficer = officer.toObject();
    delete safeOfficer.password;

    res.status(201).json({
      success: true,
      message: `Department Officer account created for ${officer.name}.`,
      user: safeOfficer,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Toggle user active/inactive status
 * @route   PATCH /api/v1/users/:id/status
 * @access  Protected (Admin only)
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own administrative account.',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isActive = isActive !== undefined ? Boolean(isActive) : !user.isActive;
    await user.save();

    await logAudit({
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: 'admin',
      action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      targetType: 'User',
      targetId: user._id,
      details: { email: user.email, isActive: user.isActive },
      req,
    });

    res.status(200).json({
      success: true,
      message: `User status changed to ${user.isActive ? 'Active' : 'Inactive'}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get active officers for department assignment
 * @route   GET /api/v1/users/officers/active
 * @access  Protected (Admin & Officer)
 */
const getActiveOfficers = async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    const query = { role: 'officer', isActive: true };

    if (departmentId) {
      query.department = departmentId;
    }

    const officers = await User.find(query)
      .populate('department', 'name code')
      .select('name email phone department')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: officers.length,
      officers,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  createOfficer,
  toggleUserStatus,
  getActiveOfficers,
};
