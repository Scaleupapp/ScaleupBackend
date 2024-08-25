// models/contentModel.js

const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  captions: {
    type: String,
    required: true,
  },
  hashtags: [String],
  contentURL: String,
  heading: String,
  verify: {
    type: String,
    enum: ['Yes', 'No'],
    default: 'No',
  },
  relatedTopics: [String],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  postdate: {
    type: Date,
    default: Date.now,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  comments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
    },
  ],
  rating: {
    type: Number,
    default: 0,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  CommentCount: {
    type: Number,
    default: 0,
  },
  smeComments: {
    type: String,
  },
  smeCommentsHistory: [
    {
      comment: String,
      date: { type: Date, default: Date.now },
    },
  ],
  contentType: {
    type: String,
  },
  viewCount: {
    type: Number,
    default: 0,
  },

  pinnedComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment', // Reference to the Comment model
    default: null, // Default to null if no comment is pinned
  },

  smeVerify: {
    type: String,
    enum: ['NA', 'Pending', 'Accepted', 'Rejected','Revise'],
  },
  views: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      count: {
        type: Number,
        default: 0,
      },
    },
  ],
});

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;
