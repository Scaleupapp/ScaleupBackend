const User = require('../models/userModel');
const Content = require('../models/contentModel'); // Import the Content model
const Comment = require('../models/commentModel'); // Import the Comment model
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');
const Sentry = require('@sentry/node');

require('dotenv').config();

const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const awsRegion = process.env.AWS_REGION;
const jwtSecret = process.env.JWT_SECRET;

// Configure AWS SDK with your credentials
aws.config.update({
  accessKeyId:awsAccessKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: awsRegion,
});

const s3 = new aws.S3();

const getUserProfile = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    // Get the user's ID from the decoded token
    const userId = decoded.userId;

    // Find the user by ID in the database, excluding the password field
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1; // Default to first page if not provided
    const pageSize = parseInt(req.query.pageSize) || 10; // Default page size
    const skip = (page - 1) * pageSize;

    // Execute query to find all content posted by the user with pagination
    const userContent = await Content.find({ userId: userId })
      .skip(skip)
      .limit(pageSize)
      .sort({ postdate: -1 });

    const totalContent = await Content.countDocuments({ userId: userId });

    // Fetch comments for each content item and add them to the result
    const userContentWithComments = [];
    for (const contentItem of userContent) {
      const comments = await Comment.find({ contentId: contentItem._id });
      userContentWithComments.push({ ...contentItem.toObject(), comments });
    }

    // Calculate total pages
    const totalPages = Math.ceil(totalContent / pageSize);

    // Return the user's profile information along with their posted content, comments, and pagination details
    res.json({
      user,
      userContent: userContentWithComments,
      pagination: {
        currentPage: page,
        pageSize,
        totalPages,
        totalItems: totalContent
      }
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


module.exports = {
  getUserProfile,
};
