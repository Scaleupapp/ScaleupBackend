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

let io;
exports.setSocketIo = (socketIoInstance) => {
  io = socketIoInstance;
};

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
      // Extract token from the Authorization header
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      // Pagination logic
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const skip = (page - 1) * pageSize;

      const currentTime = new Date();

      // Fetch quizzes that are starting in the future and not created by the current user
      const quizzes = await Quiz.find({
          creator: { $ne: userId },
          startTime: { $gt: currentTime }
      })
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 });

      // Check if the user is already registered for each quiz
      const updatedQuizzes = quizzes.map(quiz => {
          const isRegistered = quiz.participants.some(participant => participant.userId.toString() === userId);
          return {
              ...quiz.toObject(),
              isRegistered // Add this field to indicate if the user is registered
          };
      });

      // Count total number of future quizzes (for pagination)
      const totalQuizzes = await Quiz.countDocuments({
          creator: { $ne: userId },
          startTime: { $gt: currentTime }
      });

      // Respond with the quiz data and pagination information
      res.status(200).json({
          quizzes: updatedQuizzes,
          pagination: {
              totalQuizzes,
              currentPage: page,
              totalPages: Math.ceil(totalQuizzes / pageSize),
          }
      });
  } catch (error) {
      // Capture the error in Sentry for tracking
      Sentry.captureException(error);
      console.error('Error listing quizzes:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
};

exports.searchQuizzes = async (req, res) => {
  try {
    // Extract token from the Authorization header
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Get the search query from the request
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Create a case-insensitive regular expression to search for the quiz topic
    const regex = new RegExp(query, 'i');
    const currentTime = new Date();

    // Find quizzes where the topic matches the search query, and start time is in the future
    const quizzes = await Quiz.find({
      topic: { $regex: regex },
      creator: { $ne: userId }, // Exclude quizzes created by the user
      startTime: { $gt: currentTime } // Filter quizzes with future start times
    }).sort({ createdAt: -1 });

    // Check if the user is already registered for each quiz
    const updatedQuizzes = quizzes.map(quiz => {
      const isRegistered = quiz.participants.some(participant => participant.userId.toString() === userId);
      return {
        ...quiz.toObject(),
        isRegistered // Add this field to indicate if the user is registered
      };
    });

    // Send the updated quizzes as the response
    res.status(200).json({ quizzes: updatedQuizzes });
  } catch (error) {
    // Capture the error in Sentry for tracking
    Sentry.captureException(error);
    console.error('Error searching quizzes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.recommendQuizzes = async (req, res) => {
  try {
    // Extract token from the Authorization header
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Find the user by their ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Map user interests to regular expressions for case-insensitive matching
    const userInterests = user.bio.bioInterests.map(interest => new RegExp(interest, 'i'));
    const currentTime = new Date();

    // Find recommended quizzes based on user interests
    const recommendedQuizzes = await Quiz.find({
      topic: { $in: userInterests },
      startTime: { $gt: currentTime } // Filter quizzes with startTime in the future
    }).sort({ createdAt: -1 });

    // Check if the user is already registered for each recommended quiz
    const updatedQuizzes = recommendedQuizzes.map(quiz => {
      const isRegistered = quiz.participants.some(participant => participant.userId.toString() === userId);
      return {
        ...quiz.toObject(),
        isRegistered // Add this field to indicate if the user is registered
      };
    });

    // Send the updated recommended quizzes as the response
    res.status(200).json({ recommendedQuizzes: updatedQuizzes });
  } catch (error) {
    // Capture the error in Sentry for tracking
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

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (quiz.hasStarted) {
      return res.status(400).json({ message: 'Quiz has already started' });
    }

    const totalParticipants = quiz.participants.length;
    const totalEntryFees = totalParticipants * quiz.entryFee;
    const commission = totalEntryFees * (quiz.commissionPercentage / 100); 
    const prizePool = totalEntryFees - commission; 

    quiz.prizePool = prizePool;
    quiz.prizeDistribution = {
      firstPlace: (prizePool * quiz.prizeDistribution.firstPlace) / 100,
      secondPlace: (prizePool * quiz.prizeDistribution.secondPlace) / 100,
      thirdPlace: (prizePool * quiz.prizeDistribution.thirdPlace) / 100,
    };

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

    
    
    // Emit the 'quizStarted' event to all participants in the room with the **actual start time** (2 minutes later)
    const actualStartTime = new Date(new Date().getTime() + 2 * 60 * 1000);  // The actual start time (2 minutes from now)
    io.in(`quiz_${quizId}`).emit('quizStarted', { quizId, startTime: actualStartTime });
   
    //console.log('quiz start time emitted', $(startTime));
    console.log(`Quiz will officially start in 2 minutes at ${actualStartTime}`);

    await quiz.save();

    io.in(`quiz_${quizId}`).emit('quizJoined', { quizId, startTime: actualStartTime });

    // Wait for 2 minutes before officially starting the quiz
    setTimeout(async () => {
      quiz.hasStarted = true;
      quiz.actualStartTime = new Date(); // The exact time the quiz starts
      quiz.endTime = new Date(quiz.actualStartTime.getTime() + 30 * 60 * 1000); // Set quiz to end 30 minutes after the start time

      await quiz.save();
      console.log(`Quiz "${quiz.topic}" has officially started at ${quiz.actualStartTime}`);
      
      // Emit the 'quizStarted' event
      io.in(`quiz_${quizId}`).emit('quizReady', { quizId, startTime: actualStartTime });


      // Start emitting questions at regular intervals
      await exports.emitNextQuestion(quizId);

      // Automatically end the quiz after the duration (30 minutes)
      setTimeout(async () => {
        quiz.hasEnded = true;
        await quiz.save();
        console.log(`Quiz "${quiz.topic}" has ended.`);
        await exports.endQuizAndCalculateResults(quiz._id);
      }, 30 * 60 * 1000); // 30 minutes duration

    }, 2 * 60 * 1000); // 2 minutes waiting time before starting the quiz

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

    // Check if the answer is correct
    const correct = selectedOption !== null && question.correctAnswer === selectedOption;
    const pointsAwarded = correct ? Math.max(0, 10 - timeTaken) : 0;

    let userQuizResult = await UserQuizResult.findOne({ quizId, userId });
    if (!userQuizResult) {
      userQuizResult = new UserQuizResult({ quizId, userId, totalScore: 0, answers: [], questionsAnswered: 0 });
    }

    // Add the answer to the user's quiz results
    userQuizResult.answers.push({
      questionId,
      selectedOption, // Can be null if no answer was submitted
      isCorrect: correct,
      timeTaken,
      pointsAwarded,
    });

    userQuizResult.totalScore += pointsAwarded;
    userQuizResult.questionsAnswered += 1; // Increment the number of questions answered
    await userQuizResult.save();

    // Update Area of Improvement if the answer is incorrect and not null
    if (!correct && selectedOption !== null) {
      for (const topic of question.relatedTopics) {
        await AreaOfImprovement.findOneAndUpdate(
          { userId, topic },
          { $inc: { count: 1 } },
          { upsert: true, new: true }
        );
      }
    }

    // Check if all participants have completed all questions
    const allResults = await UserQuizResult.find({ quizId });
    const allParticipants = quiz.participants.length;
    const allQuestionsAnswered = allResults.every(result => result.questionsAnswered === quiz.questions.length);

    if (allResults.length === allParticipants && allQuestionsAnswered) {
      // End the quiz if all participants have answered all questions
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

    // Array to store participants' rank and scores for the quiz
    const participantsRank = [];

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

      // Update cumulative score in the user model
      const user = await User.findById(result.userId);
      user.totalPoints += result.finalScore;

      // Calculate and update user level based on cumulative score
      user.level = calculateUserLevel(user.totalPoints);
      await user.save();

      // Add participant's rank to the array
      participantsRank.push({
        userId: result.userId,
        rank: result.rank,
        finalScore: result.finalScore
      });

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

    // Store the participants' ranks in the quiz model
    quiz.participantsRank = participantsRank;

    // Save the quiz model with the updated winners and participants' ranks
    quiz.hasEnded = true;
    await quiz.save();

    console.log('Quiz results calculated and winners updated');
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error ending quiz and calculating results:', error);
    throw error;
  }
};


// Helper function to calculate user level based on total points
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

exports.emitNextQuestion = (quizId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        return reject(new Error('Quiz not found'));
      }

      let questionIndex = 0;
      const questionInterval = setInterval(async () => {
        // If there are no more questions, clear the interval and end the quiz
        if (questionIndex >= quiz.questions.length) {
          clearInterval(questionInterval);
          // End the quiz and calculate results
          await exports.endQuizAndCalculateResults(quizId);
          io.to(`quiz_${quizId}`).emit('showLeaderboard');
          return resolve();
        }

        // Get the current question and emit it to the quiz room
        const question = quiz.questions[questionIndex];
        io.to(`quiz_${quizId}`).emit('nextQuestion', {
          quizId: quizId, // Include quizId
          question: {
            _id: question._id,
            text: question.questionText, // Use questionText from your model
            options: question.options,
            // Note: Correct answer is not included to prevent cheating
          }
        });
        

        console.log(`Emitting question ${questionIndex + 1} for quiz ${quizId}`);
        questionIndex++;
      }, 10000); // Emit a question every 10 seconds
    } catch (error) {
      console.error('Error emitting next question:', error);
      return reject(error);
    }
  });
};


exports.getQuizResults = async (req, res) => {
  try {
    const { quizId } = req.params;

    // Find the quiz with participant ranks
    const quiz = await Quiz.findById(quizId).populate('participantsRank.userId', 'username profilePicture'); // Populate user details

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Get detailed results for each participant
    const userResults = await UserQuizResult.find({ quizId }).populate('userId', 'username profilePicture');

    // Prepare results data
    const results = userResults.map(result => {
      const totalTimeTaken = result.answers.reduce((acc, answer) => acc + answer.timeTaken, 0);
      const totalCorrectAnswers = result.answers.filter(answer => answer.isCorrect).length;

      return {
        userId: result.userId._id,
        username: result.userId.username,
        profilePicture: result.userId.profilePicture,
        rank: result.rank,
        finalScore: result.finalScore,
        totalCorrectAnswers,
        totalTimeTaken
      };
    });

    // Sort results by rank
    results.sort((a, b) => a.rank - b.rank);

    res.status(200).json({ results });
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};








