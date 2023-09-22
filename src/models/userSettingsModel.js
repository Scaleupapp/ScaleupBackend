const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
  },
  commentPrivacy: {
    type: String,
    enum: ['everyone', 'followers', 'none'],
    default: 'everyone',
  },
  // Add other user settings fields as needed
});

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

module.exports = UserSettings;
