// controllers/quizController.js

const jwt = require('jsonwebtoken');
const UserQuizResult = require('../models/userQuizResultModel'); 
const User = require('../models/userModel'); // Import the User model
const Quiz = require('../models/quizModel'); // Import the Quiz model
const Sentry = require('@sentry/node'); // Import Sentry
require('dotenv').config();
const OpenAI = require('openai');
const { createNotification } = require('./contentController');
const AreaOfImprovement = require('../models/areaOfImprovementModel');

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
      model: 'gpt-4o',
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

    const { topic, difficulty, isPaid, entryFee, startTime, endTime, commissionPercentage = 10, prizeDistribution = {} } = req.body;

    // Set default prize distribution percentages if not provided
    const defaultPrizeDistribution = {
      firstPlace: prizeDistribution.firstPlace || 50,
      secondPlace: prizeDistribution.secondPlace || 30,
      thirdPlace: prizeDistribution.thirdPlace || 20,
    };

    // Validate that the total prize distribution percentages equal 100%
    const totalPercentage = defaultPrizeDistribution.firstPlace + defaultPrizeDistribution.secondPlace + defaultPrizeDistribution.thirdPlace;
    if (totalPercentage !== 100) {
      return res.status(400).json({ message: 'The total prize distribution percentages must equal 100%' });
    }

    // Generate questions using ChatGPT API
    const questions = await exports.generateQuestions(topic, difficulty, 15);

    // Create a new Quiz object
    const newQuiz = new Quiz({
      topic,
      difficulty,
      questions,
      isPaid,
      entryFee,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      commissionPercentage,
      prizeDistribution: defaultPrizeDistribution,
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

    const { quizId, topic, difficulty, isPaid, entryFee, startTime, endTime, commissionPercentage, prizeDistribution = {} } = req.body;

    // Find the quiz by ID
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Set default prize distribution percentages if not provided
    const defaultPrizeDistribution = {
      firstPlace: prizeDistribution.firstPlace || quiz.prizeDistribution.firstPlace,
      secondPlace: prizeDistribution.secondPlace || quiz.prizeDistribution.secondPlace,
      thirdPlace: prizeDistribution.thirdPlace || quiz.prizeDistribution.thirdPlace,
    };

    // Validate that the total prize distribution percentages equal 100%
    const totalPercentage = defaultPrizeDistribution.firstPlace + defaultPrizeDistribution.secondPlace + defaultPrizeDistribution.thirdPlace;
    if (totalPercentage !== 100) {
      return res.status(400).json({ message: 'The total prize distribution percentages must equal 100%' });
    }

    // Update the quiz fields
    quiz.topic = topic || quiz.topic;
    quiz.difficulty = difficulty || quiz.difficulty;
    quiz.isPaid = isPaid !== undefined ? isPaid : quiz.isPaid;
    quiz.entryFee = entryFee !== undefined ? entryFee : quiz.entryFee;
    quiz.startTime = startTime ? new Date(startTime) : quiz.startTime;
    quiz.endTime = endTime ? new Date(endTime) : quiz.endTime;
    quiz.commissionPercentage = commissionPercentage !== undefined ? commissionPercentage : quiz.commissionPercentage;
    quiz.prizeDistribution = defaultPrizeDistribution;

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
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const skip = (page - 1) * pageSize;

        const currentTime = new Date();

        const quizzes = await Quiz.find({
            creator: { $ne: userId },
            startTime: { $gt: currentTime } // Filter quizzes with startTime in the future
        })
        .skip(skip)
        .limit(pageSize)
        .sort({ createdAt: -1 });

        const totalQuizzes = await Quiz.countDocuments({
            creator: { $ne: userId },
            startTime: { $gt: currentTime } // Count quizzes with startTime in the future
        });

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
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const regex = new RegExp(query, 'i');
    const currentTime = new Date();

    const quizzes = await Quiz.find({
      topic: { $regex: regex },
      creator: { $ne: userId },
      startTime: { $gt: currentTime } // Filter quizzes with startTime in the future
    }).sort({ createdAt: -1 });

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
      const currentTime = new Date();

      const recommendedQuizzes = await Quiz.find({
        topic: { $in: userInterests },
        startTime: { $gt: currentTime } // Filter quizzes with startTime in the future
      }).sort({ createdAt: -1 });

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

    // Check if the user has already joined this quiz
    const isAlreadyParticipant = quiz.participants.some(participant => participant.userId.toString() === userId);
    if (isAlreadyParticipant) {
      return res.status(400).json({ message: 'You have already joined this quiz' });
    }

    // Ensure the quiz is still joinable (1 minute before start time)
    const currentTime = new Date();
    const oneMinuteBeforeStart = new Date(quiz.startTime.getTime() - 60 * 1000);

    if (currentTime > oneMinuteBeforeStart) {
      return res.status(400).json({ message: 'Cannot join the quiz less than 1 minute before the start time' });
    }

    // Find the user by ID in the database
    const user = await User.findById(userId);

    // Add the user to the quiz participants
    quiz.participants.push({ userId, hasPaid: quiz.isPaid });
    await quiz.save();

    // Record the quiz join action in the user's profile
    user.quizParticipation.push({ quizId });
    await user.save();

    res.status(200).json({ message: 'Successfully joined the quiz' });
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

    // Calculate the prize pool based on the number of participants and entry fee
    const totalParticipants = quiz.participants.length;
    const totalEntryFees = totalParticipants * quiz.entryFee;
    // Calculate the commission and final prize pool
    const commission = totalEntryFees * (quiz.commissionPercentage / 100); // Commission amount
    const prizePool = totalEntryFees - commission; // Final prize pool after deducting commission


    // Calculate prize amounts based on the distribution percentages
    const firstPlaceAmount = (prizePool * quiz.prizeDistribution.firstPlace) / 100;
    const secondPlaceAmount = (prizePool * quiz.prizeDistribution.secondPlace) / 100;
    const thirdPlaceAmount = (prizePool * quiz.prizeDistribution.thirdPlace) / 100;

    // Update the quiz with the calculated prize pool and amounts
    quiz.prizePool = prizePool;
    quiz.prizeDistribution = {
      firstPlace: firstPlaceAmount,
      secondPlace: secondPlaceAmount,
      thirdPlace: thirdPlaceAmount,
    };

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
      quiz.endTime = new Date(quiz.actualStartTime.getTime() + 30 * 60 * 1000); // Set the quiz to end 30 minutes after the start time

      await quiz.save();

      // Automatically end the quiz after the duration
      setTimeout(async () => {
        quiz.hasEnded = true;
        await quiz.save();
        console.log(`Quiz "${quiz.topic}" has ended.`);
        await exports.endQuizAndCalculateResults(quiz._id);
      }, 30 * 60 * 1000);
    }, 2 * 60 * 1000);

    res.status(200).json({ message: 'Quiz will start in 2 minutes' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error starting quiz:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { quizId, questionId, selectedOption, timeTaken } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.hasStarted || quiz.hasEnded) {
      return res.status(400).json({ message: 'Quiz is not active' });
    }

    const question = quiz.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const correct = question.correctAnswer === selectedOption;
    const pointsAwarded = correct ? Math.max(0, 10 - timeTaken) : 0;

    let userQuizResult = await UserQuizResult.findOne({ quizId, userId });
    if (!userQuizResult) {
      userQuizResult = new UserQuizResult({ quizId, userId, totalScore: 0, answers: [] });
    }

    userQuizResult.answers.push({
      questionId,
      selectedOption,
      isCorrect: correct,
      timeTaken,
      pointsAwarded,
    });

    userQuizResult.totalScore += pointsAwarded;
    await userQuizResult.save();

    // Update Area of Improvement if the answer is incorrect
    if (!correct) {
      for (const topic of question.relatedTopics) {
        await AreaOfImprovement.findOneAndUpdate(
          { userId, topic },
          { $inc: { count: 1 } },
          { upsert: true, new: true }
        );
      }
    }

    // Check if all participants have completed the quiz
    const allResults = await UserQuizResult.find({ quizId });
    const allParticipants = quiz.participants.length;
    
    if (allResults.length === allParticipants) {
      // Automatically end the quiz
      await exports.endQuizAndCalculateResults(quizId);
    }

    res.status(200).json({ message: 'Answer submitted', pointsAwarded });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.endQuizAndCalculateResults = async (quizId) => {
  try {
    const quiz = await Quiz.findById(quizId).populate('participants.userId');
    if (!quiz) {
      throw new Error('Quiz not found');
    }

    if (quiz.hasEnded) {
      throw new Error('Quiz has already ended');
    }

    const userResults = await UserQuizResult.find({ quizId });

    // Sort by total score and time taken
    userResults.sort((a, b) => {
      if (a.totalScore === b.totalScore) {
        return a.answers.reduce((acc, curr) => acc + curr.timeTaken, 0) - b.answers.reduce((acc, curr) => acc + curr.timeTaken, 0);
      }
      return b.totalScore - a.totalScore;
    });

    // Assign ranks and calculate final scores for all participants
    for (let i = 0; i < userResults.length; i++) {
      const result = userResults[i];
      result.rank = i + 1;
      
      // Additional points for the top 3
      if (i === 0) {
        result.additionalPoints = 100;
      } else if (i === 1) {
        result.additionalPoints = 75;
      } else if (i === 2) {
        result.additionalPoints = 50;
      } else {
        result.additionalPoints = 0;
      }

      result.finalScore = result.totalScore + result.additionalPoints;
      await result.save();

      // Update cumulative score in user model
      const user = await User.findById(result.userId);
      user.totalPoints += result.finalScore;

      // Calculate and update user level based on cumulative score
      user.level = calculateUserLevel(user.totalPoints);
      
      await user.save();

      // Store the top 3 in the quiz model (if applicable)
      if (i === 0) {
        quiz.winners.first.userId = result.userId;
        quiz.winners.first.totalPoints = result.finalScore;
      } else if (i === 1) {
        quiz.winners.second.userId = result.userId;
        quiz.winners.second.totalPoints = result.finalScore;
      } else if (i === 2) {
        quiz.winners.third.userId = result.userId;
        quiz.winners.third.totalPoints = result.finalScore;
      }
    }

    // Save the quiz model with the updated winners
    await quiz.save();

    quiz.hasEnded = true;
    await quiz.save();

    return userResults;
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error ending quiz and calculating results:', error);
    throw error;
  }
};

function calculateUserLevel(totalPoints) {
  if (totalPoints >= 100001) return 'Godlike';
  if (totalPoints >= 50001) return 'Immortal';
  if (totalPoints >= 20001) return 'Mythic';
  if (totalPoints >= 10001) return 'Legend';
  if (totalPoints >= 5001) return 'Grandmaster';
  if (totalPoints >= 2001) return 'Master';
  if (totalPoints >= 1001) return 'Expert';
  if (totalPoints >= 501) return 'Advanced';
  if (totalPoints >= 101) return 'Intermediate';
  return 'Beginner';
}









