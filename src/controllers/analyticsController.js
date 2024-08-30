// controllers/analyticsController.js
const ProfileView = require('../models/profileViewModel');
const InterestView = require('../models/interestViewModel');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const Sentry = require('@sentry/node');
require('dotenv').config();
const jwtSecret = process.env.JWT_SECRET;
const AreaOfImprovement = require('../models/areaOfImprovementModel');

exports.getUserAnalytics = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const viewerId = decoded.userId;

    // Fetch Profile View Analytics
    const profileViews = await ProfileView.find({ viewerId })
      .populate('viewedUserId', 'username firstname lastname profilePicture')
      .sort({ lastViewedAt: -1 });

    // Fetch Interest View Analytics
    const interestViews = await InterestView.find({ viewerId })
      .sort({ count: -1 });

    // Fetch Areas of Improvement
    const areasOfImprovement = await AreaOfImprovement.find({ userId: viewerId })
      .sort({ count: -1 });

    // Format the data for response
    const formattedProfileViews = profileViews.map(view => ({
      type: 'Profile View',
      userId: view.viewedUserId._id,
      username: view.viewedUserId.username,
      profilePicture: view.viewedUserId.profilePicture,
      timestamp: view.lastViewedAt,
      count: view.count
    }));

    const formattedInterestViews = interestViews.map(view => ({
      interest: view.interest,
      count: view.count,
    }));

    const formattedAreasOfImprovement = areasOfImprovement.map(area => ({
      topic: area.topic,
      count: area.count,
    }));

    // Return the combined analytics
    res.status(200).json({
      activity: formattedProfileViews,
      interests: formattedInterestViews,
      areasOfImprovement: formattedAreasOfImprovement, // Include Areas of Improvement
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error retrieving user analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
  