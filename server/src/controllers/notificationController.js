const mongoose = require('mongoose');
const Notification = require('../models/Notification');

/**
 * @desc    Get user's notifications
 * @route   GET /api/v1/notifications
 * @access  Protected
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const { unreadOnly, page = 1, limit = 20 } = req.query;

    const query = { recipient: req.user._id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      totalCount,
      unreadCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      currentPage: pageNum,
      notifications,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Mark a notification as read (with recipient ownership guard)
 * @route   PATCH /api/v1/notifications/:id/read
 * @access  Protected
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID.',
      });
    }

    const notification = await Notification.findOne({
      _id: id,
      recipient: req.user._id, // Strict ownership check
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied.',
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Mark all user's notifications as read
 * @route   PATCH /api/v1/notifications/read-all
 * @access  Protected
 */
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
