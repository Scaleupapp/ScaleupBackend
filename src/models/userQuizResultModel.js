// models/userQuizResultModel.js

const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  selectedOption: { type: String},
  isCorrect: { type: Boolean},
  timeTaken: { type: Number }, // Time taken to answer in seconds
  pointsAwarded: { type: Number }, // Points awarded for this question
});

const userQuizResultSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [answerSchema],
  totalScore: { type: Number }, // Total score for the quiz
  rank: { type: Number, default: null }, // Rank after the quiz
  additionalPoints: { type: Number, default: 0 }, // Points awarded based on rank
  finalScore: { type: Number, default: 0 }, // Total score + additional points
  //cumulativeScore: { type: Number, default: 0 }, // Cumulative score across all quizzes
  createdAt: { type: Date, default: Date.now },
});

const UserQuizResult = mongoose.model('UserQuizResult', userQuizResultSchema);

module.exports = UserQuizResult;
