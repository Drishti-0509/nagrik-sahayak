const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema(
  {
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: [true, 'Complaint reference is required'],
      index: true,
    },
    timelineEventId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    cycleNumber: {
      type: Number,
      required: [true, 'Resolution cycle number is required'],
      default: 1,
    },
    evidenceType: {
      type: String,
      enum: ['citizen_complaint', 'officer_resolution'],
      required: [true, 'Evidence type is required'],
      index: true,
    },
    storageType: {
      type: String,
      enum: ['base64', 'cloudinary', 's3'],
      default: 'base64',
    },
    dataUrl: {
      type: String,
      default: '',
      validate: {
        validator: function (v) {
          // dataUrl is required when storageType is base64, optional for external storage (s3/cloudinary)
          if (this.storageType === 'base64') {
            return typeof v === 'string' && v.trim().length > 0;
          }
          return true;
        },
        message: 'dataUrl is required when storageType is base64',
      },
    },
    storageKey: {
      type: String,
      default: '',
      trim: true,
    },
    mimeType: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/webp'],
      required: [true, 'MIME type is required'],
    },
    fileSizeBytes: {
      type: Number,
      required: [true, 'File size in bytes is required'],
      min: [1, 'File size must be greater than 0'],
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [500, 'Caption cannot exceed 500 characters'],
      default: '',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader reference is required'],
    },
    uploaderRole: {
      type: String,
      enum: ['citizen', 'officer', 'admin'],
      required: [true, 'Uploader role is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast retrieval by complaint, cycle, and chronological order
evidenceSchema.index({ complaint: 1, cycleNumber: 1, evidenceType: 1 });
evidenceSchema.index({ complaint: 1, createdAt: 1 });

const Evidence = mongoose.model('Evidence', evidenceSchema);
module.exports = Evidence;

