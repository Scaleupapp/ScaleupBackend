const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const shareController = require('../controllers/shareController');

router.post('/send', chatController.sendMessage);
router.get('/:conversationId', chatController.getMessages);
router.post('/share', shareController.shareContent);

module.exports = router;
