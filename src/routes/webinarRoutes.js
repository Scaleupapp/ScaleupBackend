const express = require('express');
const router = express.Router();
const multer = require('multer');
const webinarController = require('../controllers/webinarController');

// Multer configuration for thumbnail uploads
const upload = multer({ storage: multer.memoryStorage() });

// Routes for Webinar management
router.post('/create', upload.single('thumbnail'), webinarController.createWebinar);  // Create a webinar
router.put('/edit/:webinarId', webinarController.editWebinar);  // Edit a webinar
router.put('/cancel/:webinarId', webinarController.cancelWebinar);  // Cancel a webinar
router.post('/register/:webinarId', webinarController.registerForWebinar);  // Register for a webinar
router.get('/search', webinarController.searchWebinars);  // Search webinars by topic
router.get('/user/webinars', webinarController.getUserWebinars);  // Get user's past and upcoming webinars
router.get('/:webinarId', webinarController.viewWebinarDetails);  // View webinar details

// Routes for joining/leaving webinar and waiting room
router.post('/:webinarId/join-waiting-room', webinarController.joinWaitingRoom);  // Join waiting room
router.post('/:webinarId/leave-waiting-room', webinarController.leaveWaitingRoom);  // Leave waiting room
router.post('/:webinarId/join-webinar', webinarController.joinWebinar);  // Join webinar
router.post('/:webinarId/leave-webinar', webinarController.leaveWebinar);  // Leave webinar

// Routes for Comments and Likes
router.post('/:webinarId/comment', webinarController.addComment);  // Add a comment to a webinar
router.post('/:webinarId/like', webinarController.likeWebinar);  // Like a webinar
router.post('/:webinarId/unlike', webinarController.unlikeWebinar);  // Unlike a webinar
router.post('/:webinarId/comment/:commentId/like', webinarController.likeComment);  // Like a comment on a webinar

// Routes for Recommendations and Analytics
router.get('/recommend', webinarController.recommendWebinars);  // Recommend webinars based on user interests
router.put('/end/:webinarId', webinarController.endWebinar);  // End webinar and show analytics

module.exports = router;
