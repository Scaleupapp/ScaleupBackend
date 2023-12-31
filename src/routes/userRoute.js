// userRoutes.js

const express = require('express');
const userController = require('../controllers/userController');
const educationController = require('../controllers/educationController');
const workExperienceController = require('../controllers/workExperienceController');
const coursesController = require('../controllers/coursesController'); 
const certificationsController = require('../controllers/certificationsController');
const userProfileController = require('../controllers/userProfileController');
const settingsController = require('../controllers/settingsController');

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// Profile update route with upload middleware
router.put('/profile', upload.single('profilePicture'), userController.updateProfile);

// Education update route
router.post('/education', educationController.updateEducation);

// Work Experience update route with resume upload middleware
router.post('/work-experience', upload.single('resume'), workExperienceController.updateWorkExperience);

// Courses update route
router.post('/courses', coursesController.updateCourses); 

// Certifications update route
router.post('/certifications', certificationsController.updateCertifications); 

// Delete education route
router.delete('/education/:educationId', userController.deleteEducation); 

//Delete work experience route
router.delete('/work-experience/:workExperienceId', userController.deleteWorkExperience);

// Delete course entry route
router.delete('/courses/:courseId', userController.deleteCourse);


// Get user's profile route
router.get('/profiles', userProfileController.getUserProfile);

// Delete certification entry route
router.delete('/certifications/:certificationId', userController.deleteCertification);

// Route for blocking a user
router.post('/block/:targetUserId', userController.blockUser);

// Route for unblocking a user
router.post('/unblock/:targetUserId', userController.unblockUser);

// Change Password route
router.post('/change-password', settingsController.changePassword);

//Change comments visibility route
router.post('/updateCommentPrivileges', settingsController.updateCommentPrivileges);

// Route for fetching blocked users
router.get('/blocked-users', userController.getBlockedUsers);


module.exports = router;
