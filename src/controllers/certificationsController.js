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

// Define the Certifications Information Update route
const updateCertifications = async (req, res) => {
  try {
    // Verify the user's identity using the JWT token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'scaleupkey');

    // Get the user's ID from the decoded token
    const userId = decoded.userId;

    // Find the user by ID in the database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract certification information from the request body
    const { title, issuer, issueDate } = req.body;

    // Create a new certification entry
    const newCertification = {
      title,
      issuer,
      issueDate,
    };

    // Add the new certification entry to the user's profile
    user.certifications.push(newCertification);

    // Save the updated user data
    await user.save();

    // Return the updated user object as a response
    res.json({ message: 'Certifications information updated successfully', user });
  } catch (error) {
    console.error('Error updating certifications information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  updateCertifications,
};
