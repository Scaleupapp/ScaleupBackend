const express = require('express');
const router = express.Router();
const multer = require('multer'); // Import multer for handling file uploads
const contentController = require('../controllers/contentController');
const userSearchController = require('../controllers/userSearchController');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Create Content route
router.post('/create', upload.single('media'), contentController.addContent);

// Add a route for listing pending verification content
router.get('/pending-verification', contentController.listPendingVerificationContent);

// Verify Content route (for SMEs to rate and verify content)
router.put('/verify/:contentId', contentController.updateContentRatingAndVerification);

// Get Content Details route (for SME review)
router.get('/details/:contentId', contentController.getContentDetails);

// Add a new route for getting filtered content
router.get('/all-content', contentController.getAllContent);

// Like a content item
router.put('/like/:contentId', contentController.likeContent);

// Unlike a content item
router.put('/unlike/:contentId', contentController.unlikeContent);

// Add a new route for searching users
router.post('/search-users', userSearchController.searchUsers);

router.get('/detail/:userId', userSearchController.getUserDetails);


module.exports = router;
