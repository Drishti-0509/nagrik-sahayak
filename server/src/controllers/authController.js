const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');
const { logAudit } = require('../services/auditService');

// Helper to sign JWT token
const signToken = (id) => {
  return jwt.sign({ id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

// Helper to send token response with secure HTTP-only cookie
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
  };

  res.cookie('token', token, cookieOptions);

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      address: user.address,
      createdAt: user.createdAt,
    },
  });
};

/**
 * @desc    Register a new Citizen (Public endpoint - ONLY allows citizen role)
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Role is strictly locked to 'citizen' for public registration
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'citizen',
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
    });

    await logAudit({
      actor: user._id,
      actorName: user.name,
      actorRole: 'citizen',
      action: 'USER_REGISTERED',
      targetType: 'User',
      targetId: user._id,
      details: { email: user.email, role: 'citizen' },
      req,
    });

    sendTokenResponse(user, 201, res, 'Registration successful. Welcome to Nagrik Sahayak!');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Login user & return JWT token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password, requiredRole, portalRole } = req.body;
    const expectedRole = requiredRole || portalRole;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // Fetch user with password field explicitly selected
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .populate('department', 'name code');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your email and password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your email and password.',
      });
    }

    // Portal role verification: prevent cross-portal sign-ins
    if (expectedRole && ['citizen', 'officer', 'admin'].includes(expectedRole)) {
      if (user.role !== expectedRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Your account role (${user.role}) is not authorized to sign in through the ${expectedRole} portal. Please navigate to the ${user.role} sign-in page.`,
        });
      }
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await logAudit({
      actor: user._id,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      targetType: 'User',
      targetId: user._id,
      details: { email: user.email, role: user.role },
      req,
    });

    sendTokenResponse(user, 200, res, 'Logged in successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Logout user & clear cookie
 * @route   POST /api/v1/auth/logout
 * @access  Public / Authenticated
 */
const logout = async (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/auth/me
 * @access  Protected
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('department', 'name code categories');
    res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update permitted profile fields
 * @route   PUT /api/v1/auth/profile
 * @access  Protected
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Only update permitted fields
    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (address !== undefined) user.address = address.trim();

    await user.save();

    await logAudit({
      actor: user._id,
      actorName: user.name,
      actorRole: user.role,
      action: 'PROFILE_UPDATED',
      targetType: 'User',
      targetId: user._id,
      details: { updatedFields: ['name', 'phone', 'address'].filter((f) => req.body[f] !== undefined) },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Change user password
 * @route   PUT /api/v1/auth/password
 * @access  Protected
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = newPassword;
    await user.save();

    await logAudit({
      actor: user._id,
      actorName: user.name,
      actorRole: user.role,
      action: 'PASSWORD_CHANGED',
      targetType: 'User',
      targetId: user._id,
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword,
};
