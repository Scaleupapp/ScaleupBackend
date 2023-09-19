const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');

// Configure AWS SDK with your credentials
aws.config.update({
    accessKeyId: 'AKIA4OBHVFBJP4K3I5MX',
    secretAccessKey: 'wYrxeM9CCHQSUwQRtrYEr0wiWPk2KJ7gZI3PLP2R',
    region: 'ap-southeast-2',
  });

const s3 = new aws.S3();

// Get user's profile
const getUserProfile = async (req, res) => {
  try {

    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'scaleupkey');

    // Get the user's ID from the decoded token
    const userId = decoded.userId;

    // Find the user by ID in the database
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch the user's profile picture from S3
    if (user.profilePicture) {
      const profilePictureUrl = user.profilePicture;
      // You can use this URL to display the profile picture in your application
    }

    // Fetch the user's resume from S3 (if available)
    if (user.resume) {
      const resumeUrl = user.resume;
      // You can use this URL to provide a download link for the resume
    }

    // Return the user's profile information
    res.json({ user });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getUserProfile,
};