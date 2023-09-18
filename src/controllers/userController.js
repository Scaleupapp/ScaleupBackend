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

// Update the user's profile
const updateProfile = async (req, res) => {
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

    // Access the uploaded profile picture data
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Define the AWS S3 parameters for uploading
    const params = {
      Bucket: 'scaleupbucket',
      Key: `${userId}/profile-picture.jpg`,
      Body: file.buffer,
      ACL: 'public-read', // Make uploaded file publicly accessible
      ContentType: file.mimetype,
    };

    // Upload the file to AWS S3
    s3.upload(params, async (err, data) => {
      if (err) {
        console.error('S3 upload error:', err);
        return res.status(500).json({ message: 'Failed to upload profile picture' });
      }

      // Update the user's profile information with the S3 file URL
      user.profilePicture = data.Location;
      user.location = req.body.location || user.location;
      user.dateOfBirth = req.body.dateOfBirth || user.dateOfBirth;
      user.bio.bioAbout = req.body.bioAbout || user.bioAbout;
      if (req.body.bioInterests) {
        user.bio.bioInterests = req.body.bioInterests.split(',').map((interest) => interest.trim());
      } else {
        user.bio.bioInterests = [];
      }

      // Save the updated user data
      await user.save();

      // Return a success message
      res.json({ message: 'Profile updated successfully' });
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  updateProfile,
};
