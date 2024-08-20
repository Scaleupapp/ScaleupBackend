const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedDate: { type: Date, default: Date.now }
});

const reactionSchema = new mongoose.Schema({
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    attachments: [{ type: String }], 
    reactions: [reactionSchema], 
    timestamp: { type: Date, default: Date.now },
    edited: { type: Boolean, default: false }, // New field to track if the message was edited
    deleted: { type: Boolean, default: false }, // New field to track if the message was deleted

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
