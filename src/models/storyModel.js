// models/storyModel.js

const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  contentUrl: {
    type: String,
    required: true,
  },
  durationInSeconds: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Story = mongoose.model('Story', storySchema);

module.exports = Story;
