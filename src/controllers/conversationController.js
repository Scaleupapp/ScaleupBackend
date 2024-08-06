const Conversation = require("../models/conversationModel");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");

exports.createConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const senderId = decoded.userId;

    // Check if the recipient is in the sender's inner circle
    const sender = await User.findById(senderId);
    if (!sender.innerCircle.includes(recipientId)) {
      return res.status(403).json({ message: "Recipient is not in your inner circle" });
    }

    const existingConversation = await Conversation.findOne({
      members: { $all: [senderId, recipientId] },
    });

    if (existingConversation) {
      return res.status(200).json(existingConversation);
    }

    const newConversation = new Conversation({
      members: [senderId, recipientId],
    });

    await newConversation.save();

    res.status(201).json(newConversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    const conversations = await Conversation.find({
      members: userId,
      deletedBy: { $ne: userId }
    }).populate("members", "username profilePicture");

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    await Conversation.findByIdAndUpdate(conversationId, { $push: { deletedBy: userId } });

    res.status(200).json({ message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
