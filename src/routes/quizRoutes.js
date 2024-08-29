// routes/quizRoutes.js

const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

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


module.exports = router;
