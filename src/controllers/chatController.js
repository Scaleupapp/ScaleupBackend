// controllers/chatController.js
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Notification = require("../models/notificationModel");
const Conversation = require("../models/conversationModel");
const jwt = require("jsonwebtoken");
const { createNotification } = require('./contentController');
const logActivity = require('../utils/activityLogger');

let io;
exports.setSocketIo = (socketIoInstance) => {
  io = socketIoInstance;
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, message, contentShareId } = req.body; // Include contentShareId if applicable
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const senderId = decoded.userId;

    // Ensure conversation exists and the sender is a member
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.members.includes(senderId)) {
      return res.status(403).json({ message: "Unauthorized to send message in this conversation" });
    }

    const newMessage = new Message({
      conversationId,
      sender: senderId,
      message,
      contentShareId: contentShareId ? contentShareId : null // Save contentShareId if provided
    });

    await newMessage.save();

    io.to(conversationId).emit("receiveMessage", newMessage);

    // Log activity for sending a message
    await logActivity(senderId, 'message_sent', `User sent a message in conversation ${conversationId}`);

    // Send notification to the recipient(s)
    const recipientId = conversation.members.find(member => member.toString() !== senderId);
    await createNotification(recipientId, senderId, 'message', `${decoded.username} sent you a message`, `/api/chat/${conversationId}`);

    res.status(200).json(newMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId, deleted: false }).populate("sender", "username profilePicture");

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.addReaction = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { emoji } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const message = await Message.findOne({ _id: messageId, conversationId });
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if the message is deleted
    if (message.deleted) {
      return res.status(403).json({ message: "Cannot react to a deleted message" });
    }

    // Initialize the reactions array if it doesn't exist
    if (!message.reactions) {
      message.reactions = [];
    }

    // Find if the reaction already exists
    let reaction = message.reactions.find(r => r.emoji === emoji);

    if (reaction) {
      // Add user to the reaction if not already present
      if (!reaction.users.includes(userId)) {
        reaction.users.push(userId);
      }
    } else {
      // Create a new reaction if it doesn't exist
      message.reactions.push({
        emoji,
        users: [userId]
      });
    }

    await message.save();

    // Emit the reaction to all connected clients in the conversation
    io.to(conversationId).emit("reactionAdded", { messageId, emoji, userId });

    // Log activity for adding a reaction
    await logActivity(userId, 'reaction_added', `User added a reaction to message ${messageId} in conversation ${conversationId}`);

    res.status(200).json({ message: "Reaction added successfully", reactions: message.reactions });
  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { content } = req.body;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const message = await Message.findOne({ _id: messageId, conversationId });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if the message is deleted
    if (message.deleted) {
      return res.status(403).json({ message: "Cannot edit a deleted message" });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized to edit this message" });
    }

    const now = new Date();
    if ((now - message.createdAt) > 10 * 60 * 1000) { // 10 minutes
      return res.status(403).json({ message: "Cannot edit message after 10 minutes" });
    }

    message.message = content;
    message.edited = true;

    await message.save();

    io.to(conversationId).emit("messageEdited", { messageId, content });

    // Log activity for editing a message
    await logActivity(userId, 'message_edited', `User edited message ${messageId} in conversation ${conversationId}`);

    res.status(200).json({ message: "Message edited successfully", message });
  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const message = await Message.findOne({ _id: messageId, conversationId });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized to delete this message" });
    }

    const now = new Date();
    if ((now - message.createdAt) > 10 * 60 * 1000) { // 10 minutes
      return res.status(403).json({ message: "Cannot delete message after 10 minutes" });
    }

    message.message = "This message was deleted";
    message.deleted = true;

    await message.save();

    io.to(conversationId).emit("messageDeleted", { messageId });

    // Log activity for deleting a message
    await logActivity(userId, 'message_deleted', `User deleted message ${messageId} in conversation ${conversationId}`);

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};