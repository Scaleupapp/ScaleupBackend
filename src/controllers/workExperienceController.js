const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');

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

// Define the Work Experience Information Update route
const updateWorkExperience = async (req, res) => {
  try {
    // Verify the user's identity using the JWT token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    // Get the user's ID from the decoded token
    const userId = decoded.userId;

    // Find the user by ID in the database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract work experience information from the request body
    const { position, company, startDate, endDate, description } = req.body;

    // Create a new work experience entry
    const newWorkExperience = {
      position,
      company,
      startDate,
      endDate,
      description,
    };

    // Add the new work experience entry to the user's profile
    user.workExperience.push(newWorkExperience);

    // Upload the resume file to Amazon S3
    if (req.file) {
      const resumeFile = req.file;
      const resumeFileExtension = resumeFile.originalname.split('.').pop();
      const resumeFileName = `${userId}/resume.${resumeFileExtension}`;
      const resumeFileParams = {
        Bucket: 'scaleupbucket',
        Key: resumeFileName,
        Body: resumeFile.buffer,
        ACL: 'public-read',
        ContentType: resumeFile.mimetype,
      };

      s3.upload(resumeFileParams, (err, data) => {
        if (err) {
          console.error('S3 upload error:', err);
          return res.status(500).json({ message: 'Failed to upload resume' });
        }

        // Update the user's profile with the resume file URL
        user.resume = data.Location;
        user.save();
      });
    }

    // Save the updated user data
    await user.save();

    // Return the updated user object as a response
    res.json({ message: 'Work experience information updated successfully', user });
  } catch (error) {
    console.error('Error updating work experience information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  updateWorkExperience,
};
