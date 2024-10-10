// utils/activityQueue.js
const Queue = require('bull');
const getActivityLogModel = require('./getActivityLogModel');
const User = require('../models/userModel');
require("dotenv").config();

// Create a queue for activity logs
const activityQueue = new Queue('activityQueue', {
  redis: { port: 6379, host: process.env.REDIS_HOST }, // Adjust based on your Redis configuration
});

// Define a worker to process activity logs
activityQueue.process(async (job) => {
  const { userId, activityType, activityDescription } = job.data;

  try {
    console.log(`Processing activity log for user ${userId}: ${activityType}`);
    const user = await User.findById(userId).select('username profilePicture');
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Get current month-year
    const now = new Date();
    const monthYear = `${now.getMonth() + 1}-${now.getFullYear()}`; // Format: "MM-YYYY"

    // Get activity log model for the month
    const ActivityLog = getActivityLogModel(monthYear);

    // Find user's log for the current month
    let activityLog = await ActivityLog.findOne({ userId, monthYear });

    if (!activityLog) {
      // Create a new log for the current month
      activityLog = new ActivityLog({
        userId: user._id,
        monthYear,
        activities: [
          {
            activityType,
            activityDescription,
            createdAt: new Date(),
          },
        ],
      });
    } else {
      // Append new activity for the current month
      if (activityLog.activities.length >= 1000) {
        activityLog.activities.shift(); // Remove the oldest activity if size limit reached
      }

      activityLog.activities.push({
        activityType,
        activityDescription,
        createdAt: new Date(),
      });
    }

    // Save updated activity log
    await activityLog.save();
    console.log(`Successfully logged activity for user ${userId}: ${activityType}`);
  } catch (error) {
    console.error('Error processing activity log:', error);
  }
});

module.exports = activityQueue;
