const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const UserSettings = require('../models/userSettingsModel');


require('dotenv').config();
const jwtSecret = process.env.JWT_SECRET;

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key
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

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateCommentPrivileges = async (req, res) => {
    try {
      const { commentPrivileges } = req.body; // New comment privileges (e.g., 'everyone', 'followers', 'no one')
  
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key
      const userId = decoded.userId;
  
      // Find the user settings by user ID in the database
      const userSettings = await UserSettings.findOne({ userId });
      if (!userSettings) {
        return res.status(404).json({ message: 'User settings not found' });
      }
      
      // Update the user's comment privileges
      userSettings.commentPrivacy = commentPrivileges;
      await userSettings.save();
  
      res.json({ message: 'Comment privileges updated successfully' });
    } catch (error) {
      console.error('Error updating comment privileges:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

module.exports = {
  changePassword,
    updateCommentPrivileges,
};
