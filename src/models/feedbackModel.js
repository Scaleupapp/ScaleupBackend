const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  name: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  feedbackType: { type: String, enum: ['Issue', 'Suggestion'], required: true },
  attachmentUrl: { type: String }, // URL of the attached screenshot or video in AWS S3
  heading: { type: String, required: true },
  detail: { type: String, required: true },
  rating: { type: Number }, // Only applicable for 'suggestion' type
  status: { type: String, default: 'Pending' }, // Status of the feedback
  issueDate: { type: Date, default: Date.now }, // Date when the feedback was logged
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
