// models/profileViewModel.js
const mongoose = require('mongoose');

const profileViewSchema = new mongoose.Schema({
  viewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  count: { type: Number, default: 1 },
  lastViewedAt: { type: Date, default: Date.now }
});

profileViewSchema.index({ viewerId: 1, viewedUserId: 1 }, { unique: true });

const ProfileView = mongoose.model('ProfileView', profileViewSchema);
module.exports = ProfileView;