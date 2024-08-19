const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const shareController = require('../controllers/shareController');
const studyGroupController = require('../controllers/studyGroupController');
const multer = require('multer');

// Set up multer for handling file uploads
const upload = multer();

// Study Group routes
router.get('/groupsearch', studyGroupController.searchStudyGroups); // Static route

// Chat routes
router.post('/send', chatController.sendMessage);
router.get('/:conversationId', chatController.getMessages);

// Share routes
router.post('/share', shareController.shareContent);

// Study Group routes
router.post('/create', upload.single('profilePicture'), studyGroupController.createStudyGroup);
router.put('/:id', upload.single('profilePicture'), studyGroupController.updateStudyGroup);
router.put('/:id/members', studyGroupController.updateMembersInStudyGroup);
router.put('/:id/admins', studyGroupController.updateAdminsInStudyGroup);
router.get('/group/:id', studyGroupController.getStudyGroupDetailsById);
router.delete('/group/:id', studyGroupController.deleteStudyGroup);
router.get('/', studyGroupController.getAllStudyGroups);
router.post('/join-request', studyGroupController.requestToJoinStudyGroup); // Request to join a study group
router.post('/handle-join-request', studyGroupController.handleJoinRequest); // Handle join request (approve/reject)
// Route to sending/receivng  a message with attachments in a study group
router.post('/group/send', upload.array('attachments'), studyGroupController.sendGroupMessage);
router.get('/group/:groupId/messages', studyGroupController.getGroupMessages);

module.exports = router;
