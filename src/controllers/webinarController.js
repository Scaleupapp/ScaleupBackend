const Webinar = require('../models/webinarModel');
const User = require('../models/userModel');
const Notification = require('../models/notificationModel');
const aws = require('aws-sdk');
const jwt = require('jsonwebtoken');
const moment = require('moment');
require('dotenv').config();
const { createNotification } = require('./contentController');
const logActivity = require('../utils/activityLogger');

const jwtSecret = process.env.JWT_SECRET;

// Function to authenticate users inside the controller
const authenticateUser = async (req) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.userId);
    return user;
  } catch (error) {
    throw new Error('Authentication failed');
  }
};

// Create a Webinar
exports.createWebinar = async (req, res) => {
  try {
    const user = await authenticateUser(req);

    const { title, description, scheduledTime, topics, maxAttendees, isCommentEnabled } = req.body;

    // Check if the user has the role or badge to create a webinar
    if (user.role !== 'Subject Matter Expert' && !user.badges.includes('Influencer')) {
      return res.status(403).json({ message: 'You do not have permission to create webinars' });
    }

    if (user.cancellationCount >= 3) {
      const oneMonthAgo = moment().subtract(1, 'month');
      if (moment(user.lastCancellationDate).isAfter(oneMonthAgo)) {
        return res.status(403).json({ message: 'You cannot create webinars for 1 month due to excessive cancellations.' });
      }
    }

    // Create a new webinar entry
    const newWebinar = new Webinar({
      creator: user._id,
      title,
      description,
      topics: topics.split(',').map(topic => topic.trim()),
      scheduledTime: new Date(scheduledTime),
      maxAttendees: maxAttendees || 100,
      isCommentEnabled,
    });

    // Handle thumbnail upload (if provided)
    if (req.file) {
      const s3 = new aws.S3();
      const params = {
        Bucket: 'webinar-thumbnails',
        Key: `${user._id}/thumbnails/${Date.now()}-${req.file.originalname}`,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: 'public-read',
      };

      const uploadResult = await s3.upload(params).promise();
      newWebinar.thumbnailUrl = uploadResult.Location;
    }

    await newWebinar.save();

    // Log activity for creating a webinar
    await logActivity(user._id, 'create_webinar', `User created a webinar titled: ${title}`);

    res.status(201).json({ message: 'Webinar created successfully', webinar: newWebinar });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Edit Webinar
exports.editWebinar = async (req, res) => {
  try {
    const user = await authenticateUser(req);

    const { webinarId } = req.params;
    const { description, topics, maxAttendees, isCommentEnabled } = req.body;

    // Fetch the webinar
    const webinar = await Webinar.findById(webinarId);
    if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

    // Check if the user is the creator of the webinar
    if (webinar.creator.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to edit this webinar' });
    }

    // Update the fields
    webinar.description = description || webinar.description;
    webinar.topics = topics ? topics.split(',').map(topic => topic.trim()) : webinar.topics;
    webinar.maxAttendees = maxAttendees || webinar.maxAttendees;
    webinar.isCommentEnabled = isCommentEnabled !== undefined ? isCommentEnabled : webinar.isCommentEnabled;

    await webinar.save();
    res.status(200).json({ message: 'Webinar updated successfully', webinar });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.cancelWebinar = async (req, res) => {
    try {
      const user = await authenticateUser(req);
  
      // Fetch the webinar and cancel it (as before)
      const { webinarId } = req.params;
      const webinar = await Webinar.findById(webinarId);
      if (!webinar) return res.status(404).json({ message: 'Webinar not found' });
  
      if (webinar.creator.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'You do not have permission to cancel this webinar' });
      }
  
      webinar.isCancelled = true;
      await webinar.save();
  
      // Update user's cancellation count
      user.cancellationCount += 1;
      user.lastCancellationDate = new Date();
      await user.save();
  
      // Notify attendees and return success message
      res.status(200).json({ message: 'Webinar cancelled successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  

// Register for a Webinar
exports.registerForWebinar = async (req, res) => {
  try {
    const user = await authenticateUser(req);

    const { webinarId } = req.params;
    const webinar = await Webinar.findById(webinarId);
    if (!webinar || webinar.isCancelled) {
      return res.status(404).json({ message: 'Webinar not found or cancelled' });
    }

    // Check if the registration window is open
    const timeDifference = moment(webinar.scheduledTime).diff(moment(), 'minutes');
    if (timeDifference < 1) {
      return res.status(400).json({ message: 'Registration window has closed' });
    }

    // Check if the webinar is full
    if (webinar.attendees.length >= webinar.maxAttendees) {
      return res.status(400).json({ message: 'Webinar is full' });
    }

    // Register the user
    if (!webinar.attendees.includes(user._id)) {
      webinar.attendees.push(user._id);
      await webinar.save();

      // Log activity for registering for a webinar
      await logActivity(user._id, 'register_for_webinar', `User registered for webinar titled: ${webinar.title}`);

      res.status(200).json({ message: 'Registered successfully', webinar });
    } else {
      res.status(400).json({ message: 'You are already registered' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search Webinars by Topics
exports.searchWebinars = async (req, res) => {
  try {
    const { topics } = req.query;
    const topicArray = topics.split(',').map(topic => topic.trim());

    const webinars = await Webinar.find({
      topics: { $in: topicArray },
      scheduledTime: { $gte: new Date() },
    });

    res.status(200).json({ webinars });
  } catch (error) {
    res.status(500).json({ message: 'Error searching webinars', error });
  }
};

// List User's Webinars (Past and Upcoming)
exports.getUserWebinars = async (req, res) => {
  try {
    const user = await authenticateUser(req);

    const upcomingWebinars = await Webinar.find({
      attendees: user._id,
      scheduledTime: { $gte: new Date() },
    });

    const pastWebinars = await Webinar.find({
      attendees: user._id,
      scheduledTime: { $lt: new Date() },
    });

    res.status(200).json({
      upcomingWebinars,
      pastWebinars,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// View Webinar Details
exports.viewWebinarDetails = async (req, res) => {
    try {
      const user = await authenticateUser(req);
  
      const { webinarId } = req.params;
  
      // Fetch the webinar by ID
      const webinar = await Webinar.findById(webinarId).populate('creator', 'name role badges').populate('attendees', 'name email');
  
      if (!webinar) {
        return res.status(404).json({ message: 'Webinar not found' });
      }
        res.status(200).json({ 
        webinar: {
          id: webinar._id,
          title: webinar.title,
          description: webinar.description,
          scheduledTime: webinar.scheduledTime,
          maxAttendees: webinar.maxAttendees,
          attendees: webinar.attendees,  
          isCommentEnabled: webinar.isCommentEnabled,
          creator: {
            name: webinar.creator.name,
            role: webinar.creator.role,
            badges: webinar.creator.badges,
          },
          thumbnailUrl: webinar.thumbnailUrl,
          isCancelled: webinar.isCancelled,
          cancellationReason: webinar.cancellationReason
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // Recommend Webinars based on User Interests
exports.recommendWebinars = async (req, res) => {
    try {
      const user = await authenticateUser(req);
  
      // Get user's bio interests from the User model
      const interests = user.bio.bioInterests;
  
      if (!interests || interests.length === 0) {
        return res.status(400).json({ message: "No interests found for recommendations" });
      }
  
      // Find webinars with topics matching user's interests
      const recommendedWebinars = await Webinar.find({
        topics: { $in: interests },
        scheduledTime: { $gte: new Date() }, // Only recommend future webinars
        isCancelled: false, // Exclude cancelled webinars
      });
  
      res.status(200).json({ recommendedWebinars });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

// End Webinar and Show Analytics
exports.endWebinar = async (req, res) => {
    try {
      const user = await authenticateUser(req);
      const { webinarId } = req.params;
  
      const webinar = await Webinar.findById(webinarId);
      if (!webinar) return res.status(404).json({ message: 'Webinar not found' });
  
      // Only the creator can end the webinar
      if (webinar.creator.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'You do not have permission to end this webinar' });
      }
  
      // End the webinar
      webinar.status = 'Ended';
      await webinar.save();
  
      // Analytics
      const analytics = {
        totalAttendees: webinar.attendees.length,
        totalLikes: webinar.likeCount,
        totalComments: webinar.commentCount,
        duration: moment().diff(moment(webinar.scheduledTime), 'minutes'),
      };
  
      // Save analytics in the database
      webinar.analytics = analytics;
      await webinar.save();
  
      res.status(200).json({ message: 'Webinar ended', analytics });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
// Add a comment to a webinar
exports.addComment = async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const { webinarId } = req.params;
    const { content } = req.body;

    const webinar = await Webinar.findById(webinarId);
    if (!webinar || webinar.isCancelled) {
      return res.status(404).json({ message: 'Webinar not found or cancelled' });
    }

    if (!webinar.isCommentEnabled) {
      return res.status(403).json({ message: 'Comments are disabled for this webinar.' });
    }

    const newComment = {
      user: user._id,
      content,
      createdAt: new Date(),
    };

    webinar.comments.push(newComment);
    await webinar.save();

    // Log activity for adding a comment to a webinar
    await logActivity(user._id, 'add_comment_webinar', `User added a comment to webinar titled: ${webinar.title}`);

    res.status(201).json({ message: 'Comment added successfully', comment: newComment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
  
// Like a webinar
exports.likeWebinar = async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const { webinarId } = req.params;

    const webinar = await Webinar.findById(webinarId);
    if (!webinar || webinar.isCancelled) {
      return res.status(404).json({ message: 'Webinar not found or cancelled' });
    }

    if (webinar.likes.includes(user._id)) {
      return res.status(400).json({ message: 'You have already liked this webinar.' });
    }

    webinar.likes.push(user._id);
    await webinar.save();

    // Log activity for liking a webinar
    await logActivity(user._id, 'like_webinar', `User liked webinar titled: ${webinar.title}`);

    res.status(200).json({ message: 'Webinar liked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
  
  // Unlike a webinar
  exports.unlikeWebinar = async (req, res) => {
    try {
      const user = await authenticateUser(req);
      const { webinarId } = req.params;
  
      const webinar = await Webinar.findById(webinarId);
      if (!webinar || webinar.isCancelled) {
        return res.status(404).json({ message: 'Webinar not found or cancelled' });
      }
  
      webinar.likes = webinar.likes.filter(like => like.toString() !== user._id.toString());
      await webinar.save();
  
      res.status(200).json({ message: 'Webinar unliked successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
// Like a comment
exports.likeComment = async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const { webinarId, commentId } = req.params;

    const webinar = await Webinar.findById(webinarId);
    if (!webinar || webinar.isCancelled) {
      return res.status(404).json({ message: 'Webinar not found or cancelled' });
    }

    const comment = webinar.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.likes.includes(user._id)) {
      return res.status(400).json({ message: 'You have already liked this comment.' });
    }

    comment.likes.push(user._id);
    await webinar.save();

    // Log activity for liking a comment on a webinar
    await logActivity(user._id, 'like_webinar_comment', `User liked a comment on webinar titled: ${webinar.title}`);

    res.status(200).json({ message: 'Comment liked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
  
  // Join Waiting Room
exports.joinWaitingRoom = async (req, res) => {
    try {
      const user = await authenticateUser(req);
      const { webinarId } = req.params;
  
      const webinar = await Webinar.findById(webinarId);
      if (!webinar || webinar.isCancelled) {
        return res.status(404).json({ message: 'Webinar not found or cancelled' });
      }
  
      // Add user to the waiting room (this can be Socket.IO logic or saving to the database)
      webinar.waitingRoom = webinar.waitingRoom || [];
      if (!webinar.waitingRoom.includes(user._id)) {
        webinar.waitingRoom.push(user._id);
        await webinar.save();
      }
  
      res.status(200).json({ message: 'Joined the waiting room', webinar });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
  // Leave Waiting Room
  exports.leaveWaitingRoom = async (req, res) => {
    try {
      const user = await authenticateUser(req);
      const { webinarId } = req.params;
  
      const webinar = await Webinar.findById(webinarId);
      if (!webinar || webinar.isCancelled) {
        return res.status(404).json({ message: 'Webinar not found or cancelled' });
      }
  
      // Remove user from the waiting room
      webinar.waitingRoom = webinar.waitingRoom.filter(id => id.toString() !== user._id.toString());
      await webinar.save();
  
      res.status(200).json({ message: 'Left the waiting room', webinar });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
// Join Webinar
exports.joinWebinar = async (req, res) => {
  try {
    const user = await authenticateUser(req);
    const { webinarId } = req.params;

    const webinar = await Webinar.findById(webinarId);
    if (!webinar || webinar.isCancelled || webinar.status !== 'Live') {
      return res.status(404).json({ message: 'Webinar not found, cancelled, or not live yet' });
    }

    // Add user to the webinar attendees if not already joined
    if (!webinar.attendees.includes(user._id)) {
      webinar.attendees.push(user._id);
      await webinar.save();
    }

    // Log activity for joining a webinar
    await logActivity(user._id, 'join_webinar', `User joined webinar titled: ${webinar.title}`);

    res.status(200).json({ message: 'Joined the webinar', webinar });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
  
  // Leave Webinar
  exports.leaveWebinar = async (req, res) => {
    try {
      const user = await authenticateUser(req);
      const { webinarId } = req.params;
  
      const webinar = await Webinar.findById(webinarId);
      if (!webinar || webinar.isCancelled || webinar.status !== 'Live') {
        return res.status(404).json({ message: 'Webinar not found, cancelled, or not live yet' });
      }
  
      // Remove user from the webinar attendees
      webinar.attendees = webinar.attendees.filter(id => id.toString() !== user._id.toString());
      await webinar.save();
  
      res.status(200).json({ message: 'Left the webinar', webinar });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };