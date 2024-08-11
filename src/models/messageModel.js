// models/messageModel.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  contentShareId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentShare' }, // Optional field for content share association
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
