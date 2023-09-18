// Import required modules and models
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Create a new router
const router = express.Router();

// Define the Education Information Update route
const updateEducation = async (req, res) => {
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

    // Extract education information from the request body
    const { degree, fieldOfStudy, school, graduationYear } = req.body;

    // Create a new education entry
    const newEducation = {
      degree,
      fieldOfStudy,
      school,
      graduationYear,
    };

    // Add the new education entry to the user's profile
    user.education.push(newEducation);

    // Save the updated user data
    await user.save();

    // Return the updated user object as a response
    res.json({ message: 'Education information updated successfully', user });
  } catch (error) {
    console.error('Error updating education information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
    updateEducation,
  };
  

