// src/controllers/authController.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Content = require("../models/contentModel");
const Comment = require("../models/commentModel");
const UserSettings = require("../models/userSettingsModel");
const twilio = require("twilio"); // Import Twilio
const router = express.Router();
const nodemailer = require("nodemailer");
const Sentry = require("@sentry/node");
//const Streak = require('../models/streakModel');

require("dotenv").config();

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const jwtSecret = process.env.JWT_SECRET;
const gmail = process.env.GMAIL_EMAIL;
const gmailpassword = process.env.GMAIL_PASSWORD;

const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

const login = async (req, res) => {
  const { loginIdentifier, password, devicetoken } = req.body;

  try {
    // Find the user by email, username, or phone number (case-insensitive)
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${loginIdentifier}$`, 'i') } },
        { username: { $regex: new RegExp(`^${loginIdentifier}$`, 'i') } },
        { phoneNumber: loginIdentifier },
      ],
    });

    // If the user doesn't exist, return an error
    if (!user) {
      return res.status(401).json({ message: "Invalid User Credentials" });
    }

    // Compare the user-entered password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      // Password is correct
      // Create a JWT token for session management
      const token = jwt.sign({ userId: user._id }, jwtSecret, {
        expiresIn: '7200h',
      });

      // Update the user's device token
      user.devicetoken = devicetoken;

      // Handle first-time login logic
      const isFirstTimeLogin1 = user.isFirstTimeLogin;
      const isTestUser = user.isTestUser;

      if (user.isFirstTimeLogin) {
        user.isFirstTimeLogin = false;
      }

      // Handle streak logic
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set time to start of the day

      let streakLabel = 'No streak';

      if (user.lastLoginDate) {
        const lastLoginDate = new Date(user.lastLoginDate);
        lastLoginDate.setHours(0, 0, 0, 0);

        const dayDifference = (today - lastLoginDate) / (1000 * 60 * 60 * 24);

        if (dayDifference === 1) {
          // User logged in on consecutive days
          user.streakCount += 1;
        } else if (dayDifference > 1) {
          // User missed a day or more, reset the streak
          user.streakCount = 1;
        }
      } else {
        // First login ever, start the streak
        user.streakCount = 1;
      }

      // Determine streak label
      if (user.streakCount >= 365) {
        streakLabel = '1 year streak';
      } else if (user.streakCount >= 180) {
        streakLabel = '6 months streak';
      } else if (user.streakCount >= 90) {
        streakLabel = '1 quarter streak';
      } else if (user.streakCount >= 30) {
        streakLabel = '1 month streak';
      } else if (user.streakCount >= 21) {
        streakLabel = '3 weeks streak';
      } else if (user.streakCount >= 14) {
        streakLabel = '2 weeks streak';
      } else if (user.streakCount >= 7) {
        streakLabel = '1 week streak'; 
      }else if (user.streakCount = 1) {
        streakLabel = '1 day streak'; 
      }

      // Update last login date and streak label
      user.lastLoginDate = today;
      user.streakLabel = streakLabel;

      // Save user data
      await user.save();

      // Prepare the response data
      const responseData = {
        message: "Login successful",
        token,
        isFirstTimeLogin: isFirstTimeLogin1,
        id: user._id,
        isTestUser,
        badges: user.badges, // Returning the array of badges
        role: user.role,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        streakCount: user.streakCount, // Include streak count in response
        streakLabel: user.streakLabel, // Include streak label in response
      };

      // Return the success message with the user details and token
      res.json(responseData);
    } else {
      // Password is incorrect
      res.status(401).json({ message: "Incorrect Password" });
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error during login:", error);

    // Check if the error is due to token expiration
    if (error.name === 'TokenExpiredError') {
      // JWT token has expired, prompt user to re-login
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    // For other types of errors, return internal server error
    res.status(500).json({ message: "Internal server error" });
  }
};


const register = async (req, res) => {
  // Extract user registration data from the request body
  const { username, email, password, firstname, lastname, phoneNumber } = req.body;

  try {
    // Normalize email and username to lowercase
    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username.toLowerCase();

    // Check if the user already exists with the normalized email or username
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }, { phoneNumber }]
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the user's password before saving it in the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user instance with normalized email and username
    const newUser = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      firstname: firstname,
      lastname: lastname,
      phoneNumber,
    });

    // Save the new user to the database
    await newUser.save();

    // Create user settings for the new user
    const newuserSettings = new UserSettings({ userId: newUser._id });
    await newuserSettings.save();

    // Automatically follow the admin user using admin's userID
    const adminUser = await User.findById('6666829e3c71111d41f0d19a'); // Use the provided userID
    if (adminUser) {
      newUser.following.push(adminUser.username);
      newUser.followingCount += 1;
      await newUser.save();

      adminUser.followers.push(newUser.username);
      adminUser.followersCount += 1;
      await adminUser.save();
    }

    // Return a success message
    res.json({ message: "Registration successful" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error during registration:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Signout route
const signout = (req, res) => {
  // Just clear the JWT token on the client-side
  // You can remove the token from cookies or local storage here

  // You can send a success message if needed
  res.status(200).json({ message: "Signout successful" });
};

function generateRandomOTP(length) {
  const charset = "0123456789"; // You can add more characters for a more complex OTP
  let otp = "";

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
      return res.status(401).json({ message: "Phone number not registered" });
    }

    if (!phoneNumber.startsWith("+91")) {
      phoneNumber = "+91" + phoneNumber;
    }

    // Generate a random OTP
    let otp = generateRandomOTP(6); // Generate OTP for this request

    // Send the OTP via SMS using Twilio
    await twilioClient.messages.create({
      body: `Your Authentication OTP for ScaleUp: ${otp} . Please note that this OTP is valid for 5 minutes only. In case you did not initiate this , please contact Customer Support`,
      from: "+12564884897", // Use your Twilio phone number
      to: phoneNumber,
    });

    // Store the OTP in the user's document
    user.loginOtp = otp;
    await user.save();

    // Respond with a success message
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("OTP generation and sending error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const verifyOTP = async (req, res) => {
  const { phoneNumber, userOTP, devicetoken } = req.body;

  try {
    // Find the user by phone number
    const user = await User.findOne({ phoneNumber: phoneNumber });

    // Check if the user has a login OTP
    if (!user.loginOtp || user.loginOtp !== userOTP) {
      return res.status(401).json({ message: "Incorrect OTP" });
    }

    // If OTP is correct, generate a JWT token and return it
    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: "7200h",
    });

    const isFirstTimeLogin1 = user.isFirstTimeLogin;
    if (user.isFirstTimeLogin) {
      user.isFirstTimeLogin = false;
      await user.save();
    }
    
    // Remove the login OTP from the user document
    user.loginOtp = undefined;
    user.devicetoken=devicetoken;
    await user.save();

    res.json({ message: "Login successful", token, isFirstTimeLogin1 });
  } catch (error) {
    Sentry.captureException(error);
    console.error("OTP verification error:", error);

    // Check if the error is due to token expiration
    if (error.name === 'TokenExpiredError') {
      // JWT token has expired, prompt user to re-login
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    // For other types of errors, return internal server error
    res.status(500).json({ message: "Internal server error" });
  }
};


// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: gmail, // Use the environment variable
    pass: gmailpassword, // Use the environment variable
  },
});

// Forgot Password route
const forgotPassword = async (req, res) => {
  const { loginIdentifier } = req.body;

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
      return res.status(401).json({ message: "User Not Found" });
    }
    // Generate a random OTP
    let otp = generateRandomOTP(6); // Generate OTP for this request

    let phoneNumber1 = user.phoneNumber;
    if (!user.phoneNumber.startsWith("+91")) {
      phoneNumber1 = "+91" + user.phoneNumber;
    } else phoneNumber1 = user.phoneNumber;

    // Send the OTP via SMS using Twilio
    await twilioClient.messages.create({
      body: `Please reset your password using OTP: ${otp} . Please note that this OTP is valid for 5 minutes only. In case you did not initiate this , please contact Customer Support`,
      from: "+12564884897", // Use your Twilio phone number
      to: phoneNumber1,
    });

    // Store the OTP in the user's document
    user.forgotpasswordOTP = otp;
    await user.save();

    // Respond with a success message
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error during forgot password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const verifyOTPAndChangePassword = async (req, res) => {
  const { loginIdentifier, otp, newPassword } = req.body;

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
      return res.status(401).json({ message: "User Not Found" });
    }

    // Check if the entered OTP matches the stored OTP
    if (otp !== user.forgotpasswordOTP) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database
    user.password = hashedPassword;

    // Clear the stored OTP and its expiration time
    user.forgotpasswordOTP = undefined;

    // Save the updated user document
    await user.save();

    // Respond with a success message
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error during OTP verification and password change:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    // Verify the user's identity using the JWT token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    // Get the user's ID from the decoded token
    const userId = decoded.userId;

    // Find the user by ID
    const user = await User.findById(userId);

    // If the user doesn't exist, return an error
    if (!user) {
      return res.status(401).json({ message: 'Invalid User Credentials' });
    }

    // Compare the user-entered password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      // Password is correct

      // Step 1: Delete user's content
      await Content.deleteMany({ userId: user._id });

      // Step 2: Update follower and following arrays of other users
      const followers = await User.find({ following: user.username });
      const following = await User.find({ followers: user.username });

      await Promise.all([
        ...followers.map(async (follower) => {
          follower.following.pull(user.username);
          await follower.save();
        }),
        ...following.map(async (followedUser) => {
          followedUser.followers.pull(user.username);
          await followedUser.save();
        }),
      ]);

      // Step 3: Update follower and following counts
      await User.updateMany(
        { _id: { $in: [...followers.map((follower) => follower._id), ...following.map((followedUser) => followedUser._id)] } },
        { $inc: { followersCount: -1, followingCount: -1 } }
      );

      // Step 4: Delete the user's data from the User model
      await User.deleteOne({ _id: user._id });

      // Send a success response
      return res.status(200).json({ message: 'Account deleted successfully' });
    } else {
      // Password is incorrect
      return res.status(401).json({ message: 'Incorrect Password' });
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error during account deletion:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const testSentry = (req, res) => {
  try {
    // This will throw an intentional error
    throw new Error("This is a test error for Sentry integration");
  } catch (error) {
    // Capture and report the error to Sentry
    Sentry.captureException(error);

    // Return an error response to the client
    res.status(500).json({ message: "Something went wrong. Error reported to Sentry." });
  }
};


module.exports = {
  login,
  register,
  signout,
  loginWithOTP,
  verifyOTP,
  forgotPassword,
  verifyOTPAndChangePassword,
  deleteAccount,
  testSentry
};
