// models/activityLogModel.js
const mongoose = require('mongoose');

const activityDetailSchema = new mongoose.Schema({
  activityType: {
    type: String,
    required: true,
  },
  activityDescription: String,
  createdAt: { type: Date, default: Date.now },
});

const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  monthYear: { type: String, required: true }, // Format: "MM-YYYY"
  activities: {
    type: [activityDetailSchema],
    default: [],
  },
});

activityLogSchema.index({ userId: 1, monthYear: 1 }, { unique: true });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
module.exports = ActivityLog;
