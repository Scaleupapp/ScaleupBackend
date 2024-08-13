
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      ref: "User",
      required: true,
    },
    receiver: {
      type: String,
      ref: "User",
      required: true,
    },
    conversationId: {
      type: mongoose.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    content: { type: String, required: true },
    attachments: [{ type: String }], // Store attachment URLs or file paths
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Keep track of users who have read the message
    // Add more fields as needed
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Chats", messageSchema);
