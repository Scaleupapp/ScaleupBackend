const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const UserSettings = require('../models/userSettingsModel');
const Sentry = require('@sentry/node');
const Feedback = require('../models/feedbackModel');
const aws = require('aws-sdk');
const logActivity = require('../utils/activityLogger');

require('dotenv').config();
const jwtSecret = process.env.JWT_SECRET;
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const awsRegion = process.env.AWS_REGION;

aws.config.update({
  accessKeyId: awsAccessKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: awsRegion,
});

const s3 = new aws.S3();

const submitFeedback = async (req, res) => {
  try {
    const { name, email, phoneNumber, feedbackType, heading, detail, rating } = req.body;
    const attachmentFile = req.file;

    // Verify the user's identity using the JWT token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    // Extract the user ID from the decoded token
    const userId = decoded.userId;

    const newFeedback = new Feedback({
      userId,
      name,
      email,
      phoneNumber,
      feedbackType,
      heading,
      detail,
      rating,
    });

    // Upload the attachment file to S3 if provided
    if (attachmentFile) {
      const uniqueFileName = `${newFeedback._id}_${Date.now()}_${attachmentFile.originalname}`;
      const params = {
        Bucket: 'scaleupbucket',
        Key: `feedback-attachments/${uniqueFileName}`,
        Body: attachmentFile.buffer,
        ContentType: attachmentFile.mimetype,
        ACL: 'public-read',
      };

      const data = await s3.upload(params).promise();
      newFeedback.attachmentUrl = data.Location;
    }

    await newFeedback.save();

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Get feedback status controller
 const getFeedbackStatus = async (req, res) => {
  try {
    // Verify the user's identity using the JWT token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    // Find all feedback entries associated with the user's ID
    const feedback = await Feedback.find({ userId });

    if (!feedback || feedback.length === 0) {
      return res.status(404).json({ message: 'No feedback found for the logged-in user' });
    }

    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    // Find the user by ID in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify that the old password matches the current password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Old password is incorrect' });
    }

    // Check if the new password and confirm new password match
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database
    user.password = hashedPassword;
    await user.save();

    // Log activity for password change
    await logActivity(userId, 'change_password', 'User changed their password');

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateCommentPrivileges = async (req, res) => {
  try {
    const { commentPrivileges } = req.body;

    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    const userSettings = await UserSettings.findOne({ userId });
    if (!userSettings) {
      return res.status(404).json({ message: 'User settings not found' });
    }

    // Update the user's comment privileges
    userSettings.commentPrivacy = commentPrivileges;
    await userSettings.save();

    // Log activity for comment privileges update
    await logActivity(userId, 'update_comment_privileges', `User updated comment privileges to: ${commentPrivileges}`);

    res.json({ message: 'Comment privileges updated successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating comment privileges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateContactVisibility = async (req, res) => {
  try {
    const { showContact } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    const userSettings = await UserSettings.findOne({ userId });

    if (!userSettings) {
      return res.status(404).json({ message: 'User settings not found' });
    }

    userSettings.showContact = showContact !== undefined ? showContact : userSettings.showContact;
    await userSettings.save();

    // Log activity for contact visibility update
    await logActivity(userId, 'update_contact_visibility', `User updated contact visibility to: ${showContact}`);

    res.json({ message: 'Contact visibility updated successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating contact visibility:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



module.exports = {
  changePassword,
    updateCommentPrivileges,
    submitFeedback,
    getFeedbackStatus,
    updateContactVisibility
};
