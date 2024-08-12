// models/interestViewModel.js
const mongoose = require('mongoose');

const interestViewSchema = new mongoose.Schema({
  viewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  interest: { type: String, required: true },
  count: { type: Number, default: 1 } // Counts how many times this interest has been viewed
});

interestViewSchema.index({ viewerId: 1, interest: 1 }, { unique: true }); // Prevent duplicates

const InterestView = mongoose.model('InterestView', interestViewSchema);

module.exports = InterestView;
