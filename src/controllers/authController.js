// src/controllers/authController.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const UserSettings = require('../models/userSettingsModel');
const twilio = require('twilio'); // Import Twilio
const router = express.Router();

require('dotenv').config();


const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const jwtSecret = process.env.JWT_SECRET;


const twilioClient = twilio(
  twilioAccountSid,
  twilioAuthToken
);

// Login route
const login = async (req, res) => {
  const { loginIdentifier, password } = req.body;

  try {
    // Find the user by email, username, or phone number
    const user = await User.findOne({
      $or: [
        { email: loginIdentifier },
        { username: loginIdentifier },
        { phoneNumber: loginIdentifier },
      ],
    });

    // If the user doesn't exist, return an error
    if (!user) {
      return res.status(401).json({ message: 'Invalid User Credentials' });
    }

    // Compare the user-entered password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      // Password is correct
      // Create a JWT token for session management (customize as needed)
      const token = jwt.sign({ userId: user._id }, jwtSecret, {
        expiresIn: '240h',
      });

      // Return a success message and the token
      res.json({ message: 'Login successful', token });
    } else {
      // Password is incorrect
      res.status(401).json({ message: 'Incorrect Password' });
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

       // Create user settings for the new user
       const newuserSettings = new UserSettings({
        userId: newUser._id,
    });
    await newuserSettings.save();

    // Return a success message
    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Signout route
const signout = (req, res) => {

  // Just clear the JWT token on the client-side
  // You can remove the token from cookies or local storage here

  // You can send a success message if needed
  res.status(200).json({ message: 'Signout successful' });
};

function generateRandomOTP(length) {
  const charset = '0123456789'; // You can add more characters for a more complex OTP
  let otp = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    otp += charset[randomIndex];
  }

  return otp;
}

const loginWithOTP = async (req, res) => {
  let { phoneNumber } = req.body;

  try {
    // Check if the phone number is associated with a user in your database
    const user = await User.findOne({ phoneNumber: phoneNumber });

    if (!user) {
      return res.status(401).json({ message: 'Phone number not registered' });
    }

    if (!phoneNumber.startsWith('+91')) {
      phoneNumber = '+91' + phoneNumber;
    }

    // Generate a random OTP
    let otp = generateRandomOTP(6); // Generate OTP for this request

    // Send the OTP via SMS using Twilio
    await twilioClient.messages.create({
      body: `Your Authentication OTP for ScaleUp: ${otp} . Please note that this OTP is valid for 5 minutes only.`,
      from: '+12564884897', // Use your Twilio phone number
      to: phoneNumber,
    });

    // Store the OTP in the user's document
    user.loginOtp = otp;
    await user.save();

    // Respond with a success message
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('OTP generation and sending error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const verifyOTP = async (req, res) => {
  const { phoneNumber, userOTP } = req.body;

  try {
    // Find the user by phone number
    const user = await User.findOne({ phoneNumber: phoneNumber });

    // Check if the user has a login OTP
    if (!user.loginOtp || user.loginOtp !== userOTP) {
      return res.status(401).json({ message: 'Incorrect OTP' });
    }

    // If OTP is correct, generate a JWT token and return it
    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: '240h',
    });

    // Remove the login OTP from the user document
    user.loginOtp = undefined;
    await user.save();

    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



module.exports = {
  login,
  register, 
  signout,
  loginWithOTP,
  verifyOTP,
};