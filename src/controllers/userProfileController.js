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

    // Fetch the user's profile picture from S3 (if available)
    if (user.profilePicture) {
      const profilePictureUrl = user.profilePicture;
      // You can use this URL to display the profile picture in your application
    }

    // Fetch the user's resume from S3 (if available)
    if (user.resume) {
      const resumeUrl = user.resume;
      // You can use this URL to provide a download link for the resume
    }

    // Find all content posted by the user
    const userContent = await Content.find({ userId: userId });

    // Fetch comments for each content item and add them to the result
    const userContentWithComments = [];
    for (const contentItem of userContent) {
      const comments = await Comment.find({ contentId: contentItem._id });
      userContentWithComments.push({ ...contentItem.toObject(), comments });
    }

    // Return the user's profile information along with their posted content and comments
    res.json({ user, userContent: userContentWithComments });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


module.exports = {
  getUserProfile,
};
