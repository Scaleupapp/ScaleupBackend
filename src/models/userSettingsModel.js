// UserSettings Model

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
  showContact: {
    type: Boolean,
    default: true, // By default, the email is visible
  },
});

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

module.exports = UserSettings;
