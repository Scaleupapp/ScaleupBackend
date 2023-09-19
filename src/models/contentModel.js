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
  // Define fields for uploaded content (e.g., contentURL for storing file paths)
  contentURL: String,
  heading: String,
  verify: String,
  relatedTopics: [String],
  // Add a field to link to the user who created the content
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference the User model
  },
  postdate: {
    type: Date, // Use the Date type for storing date values
    default: Date.now, // Set the default value to the current date and time
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference the User model
    },
  ],
  comments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment', // Reference the Comment model
    },
  ],
rating: {
    type: Number,
    default: 0,
  },
  smeComments: 
    {type: String}
  ,
  smeVerify: {
    type: String,
    enum: ['NA', 'Pending'], // Enum values for NA and Pending
    default: function () {
      // Default value based on the existing verify field
      return this.verify === 'Yes' ? 'Pending' : 'NA';
    },
  },
  

});

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;
