// controllers/analyticsController.js
const ProfileView = require('../models/profileViewModel');
const InterestView = require('../models/interestViewModel');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const Sentry = require('@sentry/node');
require('dotenv').config();
const jwtSecret = process.env.JWT_SECRET;

exports.getUserAnalytics = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const viewerId = decoded.userId;

    // 1. Fetch Profile View Analytics
    const profileViews = await ProfileView.find({ viewerId })
      .populate('viewedUserId', 'username firstname lastname profilePicture')
      .sort({ count: -1 }); // Sort by most viewed profiles

    // 2. Fetch Interest View Analytics
    const interestViews = await InterestView.find({ viewerId })
      .sort({ count: -1 }); // Sort by most viewed interests

    // 3. Format the data for response
    const formattedProfileViews = profileViews.map(view => ({
      username: view.viewedUserId.username,
      firstname: view.viewedUserId.firstname,
      lastname: view.viewedUserId.lastname,
      profilePicture: view.viewedUserId.profilePicture,
      count: view.count,
    }));

    const formattedInterestViews = interestViews.map(view => ({
      interest: view.interest,
      count: view.count,
    }));

    // 4. Return the combined analytics
    res.status(200).json({
      profileViews: formattedProfileViews,
      interestViews: formattedInterestViews,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error retrieving user analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
