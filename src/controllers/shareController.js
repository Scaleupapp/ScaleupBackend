// controllers/shareController.js
const ContentShare = require('../models/contentShareModel');
const Conversation = require('../models/conversationModel');
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const Content = require('../models/contentModel'); // Import the Content model
const { createNotification } = require('./contentController');
const jwt = require("jsonwebtoken");

exports.shareContent = async (req, res) => {
    try {
        const { contentId, recipientIds, message } = req.body;
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const senderId = decoded.userId;

        // Validate the contentId
        const content = await Content.findById(contentId);
        if (!content) {
            return res.status(404).json({ message: "Content not found or invalid contentId" });
        }

        // Validate recipients are in the sender's inner circle
        const sender = await User.findById(senderId);
        if (!recipientIds.every(id => sender.innerCircle.includes(id))) {
            return res.status(403).json({ message: "One or more recipients are not in your inner circle" });
        }

        // Create ContentShare entry
        const contentShare = new ContentShare({ senderId, recipientIds, contentId, message });
        await contentShare.save();

        // Create conversations for each recipient
        for (const recipientId of recipientIds) {
            let conversation;

            // Check if a conversation already exists between the sender and recipient
            const existingConversation = await Conversation.findOne({
                members: { $all: [senderId, recipientId] },
            });

            if (!existingConversation) {
                // Create a new conversation if it doesn't exist
                conversation = new Conversation({ members: [senderId, recipientId] });
                await conversation.save();
            } else {
                conversation = existingConversation;
            }

            // Add the conversation ID to the ContentShare document
            contentShare.conversationIds.push(conversation._id);

            // Log a message in the Messages model
            const newMessage = new Message({
                conversationId: conversation._id,
                sender: senderId,
                message: message ? message : `Shared content`, 
                contentShareId: contentShare._id 
            });
            await newMessage.save();

            // Notify the recipient
            await createNotification(recipientId, senderId, 'content_share', `${sender.username} shared content with you`, `/chat/${conversation._id}`);
        }

        // Save the updated ContentShare document
        await contentShare.save();

        res.status(200).json({ message: 'Content shared successfully', contentShare });
    } catch (error) {
        console.error("Error sharing content:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
