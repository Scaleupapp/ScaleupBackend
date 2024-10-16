// routes/quizRoutes.js

const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const razorpayController = require('../controllers/razorpayController'); 

// Route to create a quiz
router.post('/create', quizController.createQuiz);
// Edit a quiz (only accessible by admins)
router.put('/edit-quiz', quizController.editQuiz);
// List all quizzes (Admin only)
router.get('/list', quizController.listAllQuizzes);
// Search quizzes by topic
router.get('/search', quizController.searchQuizzes);
// Recommend quizzes to users based on their interests
router.get('/recommend', quizController.recommendQuizzes);
// Join a quiz
router.post('/join', quizController.joinQuiz);
// Initiate quiz participation (Join the waiting room)
router.post('/initiate', quizController.initiateQuizParticipation);
// Start a quiz (Admin only)
router.post('/start', quizController.startQuiz);
// Submit an answer (called for each question)
router.post('/submit-answer', quizController.submitAnswer);
// End the quiz and calculate results (automated process)
router.post('/end-quiz', quizController.endQuizAndCalculateResults);

// Create a Razorpay order for quiz payment
router.post('/create-order', razorpayController.createOrder);
// Handle Razorpay webhook for payment capture
router.post('/razorpay-webhook', razorpayController.handleWebhook);

// Fetch quiz results
router.get('/quiz-results/:quizId', quizController.getQuizResults);


module.exports = router;
