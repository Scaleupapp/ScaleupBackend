// models/quizResultModel.js

const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  userResults: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      score: { type: Number, required: true },
      rank: { type: Number, required: true },
      timeTaken: { type: Number, required: true }, // Time taken to complete the quiz in seconds
    },
  ],
  totalParticipants: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const QuizResult = mongoose.model('QuizResult', quizResultSchema);

module.exports = QuizResult;
