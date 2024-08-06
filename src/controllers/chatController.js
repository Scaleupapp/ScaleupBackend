const Message = require("../models/messageModel");
const jwt = require("jsonwebtoken");

let io;
exports.setSocketIo = (socketIoInstance) => {
  io = socketIoInstance;
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const sender = decoded.userId;

    const newMessage = new Message({
      conversationId,
      sender,
      message,
    });

    await newMessage.save();

    io.to(conversationId).emit("receiveMessage", newMessage);

    res.status(200).json(newMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId }).populate("sender", "username");

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
