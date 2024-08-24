// models/learnListProgressModel.js

const mongoose = require('mongoose');

const learnListProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  learnList: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearnList',
    required: true,
  },
  completedItems: [
    {
      content: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Content',
      },
      completedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

learnListProgressSchema.index({ user: 1, learnList: 1 }, { unique: true });

const LearnListProgress = mongoose.model('LearnListProgress', learnListProgressSchema);

module.exports = LearnListProgress;
