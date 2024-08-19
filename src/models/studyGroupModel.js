const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedDate: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    attachments: [{ type: String }], // Optional: for any attachments like images, files, etc.
    timestamp: { type: Date, default: Date.now }
  });

const studyGroupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    topics: [{ type: String }],
    privacy: { type: String, enum: ['public', 'private'], default: 'public' },
    joinRequests: [joinRequestSchema], // Store join requests for private groups
    profilePicture: { type: String }, // Store the URL of the profile picture
    createdDate: { type: Date, default: Date.now },
    messages: [messageSchema],
});

module.exports = mongoose.model('StudyGroup', studyGroupSchema);
