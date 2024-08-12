// models/profileViewModel.js
const mongoose = require('mongoose');

const profileViewSchema = new mongoose.Schema({
  viewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  count: { type: Number, default: 1 }, // Counts how many times the profile has been viewed by this user
  lastViewedAt: { type: Date, default: Date.now } // Track the last time this profile was viewed
});

profileViewSchema.index({ viewerId: 1, viewedUserId: 1 }, { unique: true }); // Prevent duplicates

const ProfileView = mongoose.model('ProfileView', profileViewSchema);

module.exports = ProfileView;
