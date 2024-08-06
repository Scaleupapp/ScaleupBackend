const Conversation = require("../models/conversationModel");
const jwt = require("jsonwebtoken");

exports.createConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const senderId = decoded.userId;

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
    }).populate("members", "username");

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
