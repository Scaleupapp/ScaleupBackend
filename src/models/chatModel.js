// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  attachments: [{ type: String }], // Store attachment URLs or file paths
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Keep track of users who have read the message
  // Add more fields as needed
});

module.exports = mongoose.model('Chats', messageSchema);
