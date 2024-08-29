// controllers/quizController.js

const jwt = require('jsonwebtoken');
const UserQuizResult = require('../models/userQuizResultModel'); 
const User = require('../models/userModel'); // Import the User model
const Quiz = require('../models/quizModel'); // Import the Quiz model
const Sentry = require('@sentry/node'); // Import Sentry
require('dotenv').config();
const OpenAI = require('openai');
const { createNotification } = require('./contentController');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is stored securely
});

exports.generateQuestions = async (topic, difficulty, numQuestions = 15) => {
  try {
    const prompt = `
      Generate ${numQuestions} quiz questions on the topic of "${topic}" with a difficulty level of "${difficulty}".
      For each question, provide the following:
      - Question text
      - Four options
      - Correct answer
      - A list of related topics
      - A list of relevant hashtags

      Format the response as a JSON array like this:
      [
        {
          "questionText": "What is the capital of France?",
          "options": ["Berlin", "Madrid", "Paris", "Rome"],
          "correctAnswer": "Paris",
          "relatedTopics": ["Geography", "European Capitals"],
          "hashtags": ["#Geography", "#France", "#Capitals"]
        },
        ...
      ]
    `;

    // Log the prompt for debugging
    console.log('Prompt being sent to ChatGPT:', prompt);

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4090,
    });

    // Log the response for debugging
    console.log('OpenAI response:', response);

    // Ensure the response structure is correct before parsing
    if (response.choices && response.choices.length > 0) {
      const messageContent = response.choices[0].message.content.trim();

      // Log the message content for debugging
      console.log('Message content:', messageContent);

      // Attempt to parse the JSON response
      const questions = JSON.parse(messageContent);
      return questions;
    } else {
      throw new Error('No choices returned by OpenAI');
    }

  } catch (error) {
    console.error('Error generating questions:', error);
    throw new Error('Failed to generate questions');
  }
};
  
exports.createQuiz = async (req, res) => {
    try {
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Replace with your actual secret key
  
      // Get the user's ID from the decoded token
      const userId = decoded.userId;
  
      // Find the user by ID in the database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Check if the user is an admin
      if (!user.isAdminUser) {
        return res.status(403).json({ message: 'Access denied. Only admins can create quizzes.' });
      }
  
      const { topic, difficulty, isPaid, entryFee, startTime, endTime, commissionPercentage } = req.body;
  
      // Generate questions using ChatGPT API
      const questions = await exports.generateQuestions(topic, difficulty,15);
  
      // Calculate prize pool (optional, for paid quizzes)
      let prizePool = 0;
      if (isPaid) {
        prizePool = (entryFee * 100) / (100 + commissionPercentage); // Example calculation
      }
  
      // Create a new Quiz object
      const newQuiz = new Quiz({
        topic,
        difficulty,
        questions,
        isPaid,
        entryFee,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        prizePool,
        commissionPercentage,
      });
  
      // Save the Quiz object to the database
      await newQuiz.save();
  
      res.status(201).json({ message: 'Quiz created successfully', quiz: newQuiz });
    } catch (error) {
      // Capture the exception in Sentry
      Sentry.captureException(error);
      console.error('Error creating quiz:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

exports.editQuiz = async (req, res) => {
    try {
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Replace with your actual secret key
  
      // Get the user's ID from the decoded token
      const userId = decoded.userId;
  
      // Find the user by ID in the database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Check if the user is an admin
      if (!user.isAdminUser) {
        return res.status(403).json({ message: 'Access denied. Only admins can edit quizzes.' });
      }
  
      const { quizId, topic, difficulty, isPaid, entryFee, startTime, endTime, commissionPercentage, quizTopics } = req.body;
  
      // Find the quiz by ID
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }
  
      // Update the quiz fields
      quiz.topic = topic || quiz.topic;
      quiz.difficulty = difficulty || quiz.difficulty;
      quiz.isPaid = isPaid !== undefined ? isPaid : quiz.isPaid;
      quiz.entryFee = entryFee !== undefined ? entryFee : quiz.entryFee;
      quiz.startTime = startTime ? new Date(startTime) : quiz.startTime;
      quiz.endTime = endTime ? new Date(endTime) : quiz.endTime;
      quiz.commissionPercentage = commissionPercentage !== undefined ? commissionPercentage : quiz.commissionPercentage;
      quiz.quizTopics = quizTopics && quizTopics.length ? quizTopics : quiz.quizTopics; // Allow updating multiple topics
  
      // Save the updated quiz to the database
      await quiz.save();
  
      res.status(200).json({ message: 'Quiz updated successfully', quiz });
    } catch (error) {
      // Capture the exception in Sentry
      Sentry.captureException(error);
      console.error('Error editing quiz:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

exports.listAllQuizzes = async (req, res) => {
    try {
        // Verify the user's identity using the JWT token
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const skip = (page - 1) * pageSize;

        // Find all quizzes excluding those created by the user
        const quizzes = await Quiz.find({ creator: { $ne: userId } })
            .skip(skip)
            .limit(pageSize)
            .sort({ createdAt: -1 });

        const totalQuizzes = await Quiz.countDocuments({ creator: { $ne: userId } });

        res.status(200).json({
            quizzes,
            pagination: {
                totalQuizzes,
                currentPage: page,
                totalPages: Math.ceil(totalQuizzes / pageSize),
            }
        });
    } catch (error) {
        Sentry.captureException(error);
        console.error('Error listing quizzes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.searchQuizzes = async (req, res) => {
  try {
    // Verify the user's identity using the JWT token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const regex = new RegExp(query, 'i');

    // Log the regex for debugging
    console.log('Search Regex:', regex);

    // Search for quizzes excluding those created by the user
    const quizzes = await Quiz.find({
      topic: { $regex: regex },
      creator: { $ne: userId }
    }).sort({ createdAt: -1 });

    // Log the number of results for debugging
    console.log('Number of quizzes found:', quizzes.length);

    res.status(200).json({ quizzes });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error searching quizzes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.recommendQuizzes = async (req, res) => {
  try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      const user = await User.findById(userId);
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      const userInterests = user.bio.bioInterests.map(interest => new RegExp(interest, 'i'));

      const recommendedQuizzes = await Quiz.find({
        topic: { $in: userInterests }
      }).sort({ createdAt: -1 });
      // Log the number of results for debugging
    console.log('Number of quizzes found:', recommendedQuizzes.length);


      res.status(200).json({ recommendedQuizzes });
  } catch (error) {
      Sentry.captureException(error);
      console.error('Error recommending quizzes:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
};

exports.joinQuiz = async (req, res) => {
  try {
    // Check if the Authorization header is present
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'Authorization header is missing' });
    }

    // Extract the JWT token from the Authorization header
    const tokenParts = req.headers.authorization.split(' ');

    // Ensure the token is in the correct format (e.g., "Bearer <token>")
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'Invalid Authorization header format' });
    }

    const token = tokenParts[1];

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { quizId } = req.body;

    // Find the quiz by ID
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Ensure the quiz has a creator field before comparing
    /*
    if (!quiz.creator || quiz.creator.toString() === userId) {
      return res.status(403).json({ message: 'Quiz creators cannot join their own quiz' });
    }
    */
    const currentTime = new Date();
    const oneMinuteBeforeStart = new Date(quiz.startTime.getTime() - 60 * 1000);

    if (currentTime > oneMinuteBeforeStart) {
      return res.status(400).json({ message: 'Cannot join the quiz less than 1 minute before the start time' });
    }

    const user = await User.findById(userId);
    
    if (user.quizParticipation.some(participation => participation.quizId.toString() === quizId)) {
      return res.status(400).json({ message: 'You have already joined this quiz' });
    }

    // Add the user to the quiz participants
    quiz.participants.push({ userId, hasPaid: quiz.isPaid });
    await quiz.save();

    // Record the quiz join action in the user's profile
    user.quizParticipation.push({ quizId });
    await user.save();

    res.status(200).json({ message: 'Successfully joined the quiz', quiz });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error joining quiz:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.initiateQuizParticipation = async (req, res) => {
  try {
    const { quizId } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Find the quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if the user is a participant
    const participant = quiz.participants.find(part => part.userId.toString() === userId);
    if (!participant) {
      return res.status(400).json({ message: 'You are not a participant of this quiz' });
    }

    // Check if the quiz has already started
    if (quiz.hasStarted) {
      return res.status(400).json({ message: 'The quiz has already started' });
    }

    // Mark the participant as having joined the waiting room
    participant.hasJoined = true;
    await quiz.save();

    res.status(200).json({ message: 'You have joined the waiting room' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error initiating quiz participation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.startQuiz = async (req, res) => {
  try {
    const { quizId } = req.body;

    // Find the quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if the quiz has already started
    if (quiz.hasStarted) {
      return res.status(400).json({ message: 'Quiz has already started' });
    }

    const currentTime = new Date();

    // Check if the quiz is being started before the official start time
    if (currentTime < quiz.startTime) {
      return res.status(400).json({ message: 'Cannot start the quiz before the official start time' });
    }

    // Notify participants that the quiz is starting in two minutes
    if (!quiz.startNotificationSent) {
      for (const participant of quiz.participants) {
        await createNotification(
          participant.userId, 
          null, 
          'quiz_start', 
          `Quiz "${quiz.topic}" is about to start in 2 minutes. Prepare yourself!`, 
          `/quiz/initiate-room/${quiz._id}`
        );
      }
      quiz.startNotificationSent = true;
    }

    // Save the quiz state to indicate the notification was sent
    await quiz.save();

    // Wait for two minutes before officially starting the quiz
    setTimeout(async () => {
      // Record the exact start time
      quiz.hasStarted = true;
      quiz.actualStartTime = new Date(); // Save the exact start time
      quiz.endTime = new Date(quiz.actualStartTime.getTime() + 5 * 60 * 1000); // Set the quiz to end 5 minutes after the start time

      await quiz.save();

      // Automatically end the quiz after 5 minutes
      setTimeout(async () => {
        quiz.hasEnded = true;
        await quiz.save();
        console.log(`Quiz "${quiz.topic}" has ended.`);
      }, 5 * 60 * 1000);

    }, 2 * 60 * 1000);

    res.status(200).json({ message: 'Quiz will start in 2 minutes' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error starting quiz:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};







