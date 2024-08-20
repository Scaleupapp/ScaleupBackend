// models/messageModel.js
const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  contentShareId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentShare' }, // Optional field for content share association
  reactions: [reactionSchema], // Array of reactions
  edited: { type: Boolean, default: false }, // New field to track if the message was edited
  deleted: { type: Boolean, default: false }, // New field to track if the message was deleted

}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
