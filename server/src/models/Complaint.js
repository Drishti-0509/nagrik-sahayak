const mongoose = require('mongoose');

const timelineItemSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedByName: {
      type: String,
      required: true,
    },
    changedByRole: {
      type: String,
      enum: ['citizen', 'officer', 'admin', 'system'],
      default: 'system',
    },
    description: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
    evidence: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      enum: ['citizen', 'officer', 'admin'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
      trim: true,
    },
    isInternal: {
      type: Boolean,
      default: false, // Internal notes between officers/admins
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const complaintSchema = new mongoose.Schema(
  {
    trackingId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    citizen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Citizen reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Water Supply',
        'Electricity',
        'Roads and Infrastructure',
        'Sanitation and Waste Management',
        'Public Health',
        'Education',
        'Public Safety',
        'Transport',
        'Other',
      ],
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    location: {
      address: {
        type: String,
        required: [true, 'Location address or landmark is required'],
        trim: true,
        maxlength: [300, 'Address cannot exceed 300 characters'],
      },
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
      pincode: {
        type: String,
        trim: true,
        default: '',
      },
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
      index: true,
    },
    status: {
      type: String,
      enum: [
        'Submitted',
        'Received',
        'Under Review',
        'Assigned',
        'In Progress',
        'Resolved',
        'Closed',
        'Rejected',
        'Reopened',
      ],
      default: 'Submitted',
      index: true,
    },
    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    slaDeadline: {
      type: Date,
      required: true,
      index: true,
    },
    isEscalated: {
      type: Boolean,
      default: false,
      index: true,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    escalationReason: {
      type: String,
      default: '',
    },
    evidenceImage: {
      type: String,
      default: '',
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
    resolutionEvidence: {
      type: String,
      default: '',
    },
    resolutionCycleCount: {
      type: Number,
      default: 0,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
    citizenFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      comment: {
        type: String,
        default: '',
      },
      submittedAt: {
        type: Date,
        default: null,
      },
    },
    timeline: [timelineItemSchema],
    comments: [commentSchema],
    aiAnalysis: {
      categorySuggestion: String,
      departmentSuggestion: String,
      prioritySuggestion: String,
      summary: String,
      nextAction: String,
      confidence: Number,
      isFallback: {
        type: Boolean,
        default: false,
      },
      analyzedAt: Date,
    },
    duplicateDetection: {
      isPotentialDuplicate: {
        type: Boolean,
        default: false,
      },
      highestSimilarity: {
        type: Number,
        default: 0,
      },
      matchedComplaint: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Complaint',
        default: null,
      },
      matchedTrackingId: {
        type: String,
        default: '',
      },
      checkedAt: {
        type: Date,
        default: null,
      },
    },
    predictedSla: {
      predictedHours: {
        type: Number,
        default: null,
      },
      predictedDays: {
        type: Number,
        default: null,
      },
      confidenceLevel: {
        type: String,
        enum: ['High', 'Medium', 'Low', null],
        default: null,
      },
      modelType: {
        type: String,
        default: null,
      },
      predictedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast dashboard queries and citizen lookups
complaintSchema.index({ citizen: 1, createdAt: -1 });
complaintSchema.index({ department: 1, status: 1 });
complaintSchema.index({ assignedOfficer: 1, status: 1 });
complaintSchema.index({ status: 1, slaDeadline: 1 });

const Complaint = mongoose.model('Complaint', complaintSchema);
module.exports = Complaint;
