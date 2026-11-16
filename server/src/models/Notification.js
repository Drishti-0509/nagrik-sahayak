const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'complaint_submitted',
        'complaint_received',
        'complaint_assigned',
        'status_changed',
        'officer_note',
        'resolved',
        'closed',
        'rejected',
        'reopened',
        'escalated',
        'sla_warning',
      ],
      default: 'status_changed',
    },
    eventKey: {
      type: String,
      default: null,
    },
    relatedComplaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
    },
    trackingId: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index(
  { recipient: 1, eventKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventKey: { $type: 'string' } },
  }
);

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
