const express = require('express');
const userController = require('../controllers/userController');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// Profile update route with upload middleware
router.put('/profile', upload.single('profilePicture'), userController.updateProfile);

module.exports = router;
