const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [10, 'Department code cannot exceed 10 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    categories: [
      {
        type: String,
        trim: true,
      },
    ],
    slaHours: {
      Low: { type: Number, default: 120 },
      Medium: { type: Number, default: 72 },
      High: { type: Number, default: 48 },
      Urgent: { type: Number, default: 24 },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    headOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Department = mongoose.model('Department', departmentSchema);
module.exports = Department;
