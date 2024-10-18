// src/routes/authRoute.js
const express = require('express');
const passport = require('passport');
require('../config/passport-config');
const authController = require('../controllers/authController');
const Sentry = require("@sentry/node");

const router = express.Router();


// Login route
router.post('/login', authController.login);

// Login via google route - get code
router.get('/google', 
    passport.authenticate('google', {
        session : false,
        scope : ['profile', 'email']
    })
);

// Login via google - get user info
router.get('/google/callback', passport.authenticate('google', {session : false, failureRedirect: '/' }), authController.login1);

// Login via facebook route - get code
router.get('/facebook', 
    passport.authenticate('facebook', {
      session : false
      //, 
       // scope : ['email', 'public_profile']
      } // app review is required in order to retrieve these info
    )
);

// Login via faceboook - get user info
router.get('/facebook/callback', passport.authenticate('facebook',
  {session : false, failureRedirect: '/' }
), authController.login1);

// Login via github - get user info
router.get('/github', passport.authenticate('github', {session : false}));

// Login via github - get user info
router.get('/github/callback', passport.authenticate('github', {session : false, failureRedirect: '/' }), authController.login1);

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

// Delete Account route (add this route)
router.post('/delete-account', authController.deleteAccount);

// Add a route for testing Sentry integration
router.get("/test-sentry", authController.testSentry);

module.exports = router;
