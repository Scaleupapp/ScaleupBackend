// src/routes/authRoute.js
const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Login route
router.post('/login', authController.login);

// Register route
router.post('/register', authController.register);

// Signout route
router.get('/signout', authController.signout);

// Generate OTP route
router.post('/otp-gen', authController.loginWithOTP);

//Verify OTP route
router.post('/otp-verify', authController.verifyOTP);

// Forgot Password  OTP route
router.post('/password-gen', authController.forgotPassword);

// Forgot Password & Reset   OTP route
router.post('/resetpassword', authController.verifyOTPAndChangePassword);



module.exports = router;
