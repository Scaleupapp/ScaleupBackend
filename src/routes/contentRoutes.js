const express = require('express');
const router = express.Router();
const multer = require('multer'); // Import multer for handling file uploads
const contentController = require('../controllers/contentController');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Create Content route
router.post('/create', upload.single('media'), contentController.addContent);

module.exports = router;
