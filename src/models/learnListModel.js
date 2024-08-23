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
  createdDate: {
    type: Date,
    default: Date.now,
  },

  relatedTopics: [String],
  
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public',
  },
});

const LearnList = mongoose.model('LearnList', learnListSchema);

module.exports = LearnList;
