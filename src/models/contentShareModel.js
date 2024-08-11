// models/contentShareModel.js
const mongoose = require('mongoose');

const contentShareSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  message: { type: String }, // Optional message sent with the content
  timestamp: { type: Date, default: Date.now },
  conversationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' }] // Track related conversations
});

const ContentShare = mongoose.model('ContentShare', contentShareSchema);

module.exports = ContentShare;
