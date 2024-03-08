const express = require('express');
const router = express.Router();
const multer = require('multer'); // Import multer for handling file uploads
const contentController = require('../controllers/contentController');
const userSearchController = require('../controllers/userSearchController');
const storyController = require('../controllers/storyController');

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

// Follow a user route
router.post('/follow/:userId', userSearchController.followUser);

// Unfollow a user route
router.delete('/unfollow/:userId', userSearchController.unfollowUser);

// Get the follower list of the logged-in user
router.get('/followUnfollowList', userSearchController.getFollowUnfollowList);

// Add a route for adding a comment to a content item
router.post('/add-comment', contentController.addComment);

// Add a route for viewing a specific post
router.get('/post/:contentId', contentController.getPostDetails);

// Add a new route to get notifications
router.get('/notifications', contentController.getNotifications);

// Create Story  route
router.post('/createstory', upload.single('contentFile'), storyController.addStory);

// Define a route for getting homepage content
router.get('/homepage', contentController.getHomepageContent);

// Route for marking  notification as read
router.post('/notifications/mark-as-read', contentController.markNotificationsAsRead);

// New route for deleting content by ID
router.delete('/delete/:contentId', contentController.deleteContent);

// New route for incrementing the view count of a video content
router.post('/view/:contentId', contentController.incrementViewCount);


module.exports = router;
