// models/learnListModel.js

const mongoose = require('mongoose');

const learnListSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  contentItems: [
    {
      content: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Content',
        required: true,
      },
      sequence: {
        type: Number,
        required: true,
      },
    },
  ],
  discussions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discussion',
    },
  ],
  relatedTopics: [String],
  createdDate: {
    type: Date,
    default: Date.now,
  },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public',
  },
});

const LearnList = mongoose.model('LearnList', learnListSchema);

module.exports = LearnList;
