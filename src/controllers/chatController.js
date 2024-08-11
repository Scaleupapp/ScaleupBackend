// controllers/chatController.js
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Notification = require("../models/notificationModel");
const Conversation = require("../models/conversationModel");
const jwt = require("jsonwebtoken");
const { createNotification } = require('./contentController');

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

    const messages = await Message.find({ conversationId }).populate("sender", "username profilePicture");

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
