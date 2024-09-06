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

//List Draft Items
router.get('/drafts', contentController.listDrafts);

router.put('/publish/:contentId', contentController.publishDraft);


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

// Pin a comment route
router.put('/pin-comment/:contentId/:commentId', contentController.pinComment);

// Unpin a comment route
router.put('/unpin-comment/:contentId', contentController.unpinComment);

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

// route for deleting a comment by ID
router.delete('/comments/:commentId', contentController.deleteComment);

// routes for saving and unsaving content
router.put('/save/:contentId', contentController.saveContent);
router.put('/unsave/:contentId', contentController.unsaveContent);
router.get('/saved-content', contentController.getSavedContent);

// Add a route for updating specific fields of a content item
router.put('/update/:contentId', contentController.updateContentFields);

// Add new routes for commenting on a comment, liking a comment, and unliking a comment
router.post('/comments/reply', contentController.addReply);
router.post('/comments/like/:commentId', contentController.likeComment);
router.post('/comments/unlike/:commentId', contentController.unlikeComment);

// Route to create a new Learn List
router.post('/createlist', contentController.createLearnList);
// Route to get a Learn List by ID
router.get('/getlearnList/:learnListId', contentController.getLearnListById);
// Route to add content to a Learn List
router.put('/:learnListId/add-content', contentController.addContentToLearnList);
// Route to delete a Learn List by ID
router.delete('/learnList/:learnListId', contentController.deleteLearnList);
// Route to get all public Learn Lists
router.get('/learnList/public', contentController.getAllPublicLearnLists);
// Route to change the sequence of content in a Learn List
router.put('/:learnListId/change-sequence', contentController.changeContentSequence);
// Route to list all Learn Lists created by the logged-in user
router.get('/learnList/mylists', contentController.getLearnListsByUser);
// Route to search Learn Lists based on username, description, and related topics
router.post('/learnList/search', contentController.searchLearnLists);
// Route to mark content as completed
router.put('/learnList/:learnListId/content/:contentId/complete', contentController.markContentAsCompleted);
// Route to get progress for a Learn List
router.get('/learnList/:learnListId/progress', contentController.getLearnListProgress);
// Route to create a new discussion thread in a Learn List
router.post('/learnList/:learnListId/discussions', contentController.createDiscussion);
// Route to add a reply to a discussion
router.post('/learnList/:learnListId/discussions/:discussionId/replies', contentController.addReplytoDiscussion);
// Route to get all discussions for a Learn List
router.get('/learnList/:learnListId/discussions', contentController.getDiscussionsByLearnList);
// Pin a discussion
router.put('/learnList/:learnListId/discussions/:discussionId/pin', contentController.pinDiscussion);
// Unpin a discussion
router.put('/learnList/:learnListId/discussions/:discussionId/unpin', contentController.unpinDiscussion);


module.exports = router;
