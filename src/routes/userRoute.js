const express = require('express');
const userController = require('../controllers/userController');
const educationController = require('../controllers/educationController');
const workExperienceController = require('../controllers/workExperienceController');
const coursesController = require('../controllers/coursesController'); 
const certificationsController = require('../controllers/certificationsController');
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
router.post('/courses', coursesController.updateCourses); // Add this line

// Certifications update route
router.post('/certifications', certificationsController.updateCertifications); // Add this line


module.exports = router;
