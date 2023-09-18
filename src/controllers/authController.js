// src/controllers/authController.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');


const router = express.Router();

// Login route
const login = async (req, res) => {
  const { loginIdentifier, password } = req.body;

  try {
    // Find the user  by email, or phone number
    const user = await User.findOne({
        $or: [
          { email: loginIdentifier },
          { username: loginIdentifier },
          { phoneNumber: loginIdentifier },
        ],
      });
    // If the user doesn't exist, return an error
    if (!user) {
      return res.status(401).json({ message: 'Login failed' });
    }

    // Compare the user-entered password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (isPasswordValid) {
      // Password is correct
      // Create a JWT token for session management (customize as needed)
      const token = jwt.sign({ userId: user._id }, 'scaleupkey', {
        expiresIn: '24h',
      });

      // Return a success message and the token
      res.json({ message: 'Login successful', token });
    } else {
      // Password is incorrect
      res.status(401).json({ message: 'Login failed' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  login, // Export the login function as an object property
};

const register = async (req, res) => {
  // Extract user registration data from the request body
  const {
    username,
    email,
    password,
    firstname,
    lastname,
    phoneNumber,
  } = req.body;

  try {
    // Check if the user already exists with the same email or username
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the user's password before saving it in the database
    const hashedPassword = await bcrypt.hash(password, 10); // You can adjust the number of salt rounds

    // Create a new user instance
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      firstname: firstname,
      lastname: lastname,
      phoneNumber,
    });

    // Save the new user to the database
    await newUser.save();

    // Return a success message
    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  login,
  register, // Export the register function as an object property
};