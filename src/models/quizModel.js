// models/quizModel.js

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
  hashtags: [String],
  relatedTopics: [String],
});

const quizSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  difficulty: { type: String, required: true },
  questions: [questionSchema],
  isPaid: { type: Boolean, default: false },
  entryFee: { type: Number, default: 0 }, // For free quizzes
  startTime: { type: Date, required: true },
  participants: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      hasPaid: { type: Boolean, default: false },
      hasJoined: { type: Boolean, default: false },
    },
  ],
  prizePool: { type: Number, default: 0 },
  commissionPercentage: { type: Number, default: 10 }, // Example: 10% commission
  prizeDistribution: {
    firstPlace: { type: Number, default: 0 },
    secondPlace: { type: Number, default: 0 },
    thirdPlace: { type: Number, default: 0 },
  },
  winners: {
    first: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      totalPoints: { type: Number, default: 0 }
    },
    second: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      totalPoints: { type: Number, default: 0 }
    },
    third: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      totalPoints: { type: Number, default: 0 }
    }
  },
  isPrizeDistributed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  quizTopics: [{ type: String }], 
  hasStarted: { type: Boolean, default: false },
  startNotificationSent: { type: Boolean, default: false },
  actualStartTime: { type: Date, default: null }, // Record the actual start time
  endTime: { type: Date, default: null }, // Set the official stop time
  hasEnded: { type: Boolean, default: false }, // Indicate if the quiz has ended

});

const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;
