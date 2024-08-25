  const aws = require('aws-sdk');
  const User = require('../models/userModel'); // Import the User model
  const Content = require('../models/contentModel'); // Import the Content model
  const Comment = require('../models/commentModel'); // Import the Comment model
  const Notification = require('../models/notificationModel'); // Import the Notification model
  const UserSettings = require('../models/userSettingsModel'); // Import the UserSettings model
  const jwt = require('jsonwebtoken'); // Import JWT library
  const Sentry = require('@sentry/node');
  const mongoose = require('mongoose');
  require('dotenv').config();
  const ProfileView = require('../models/profileViewModel');
  const InterestView = require('../models/interestViewModel');
  const LearnList = require('../models/learnListModel');
  const LearnListProgress = require('../models/learnListProgressModel');
  const Discussion = require('../models/discussionModel');

  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION;
  const jwtSecret = process.env.JWT_SECRET;

  aws.config.update({
      accessKeyId:awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
      region: awsRegion,
    });

  const s3 = new aws.S3();

  exports.addContent = async (req, res) => {
    try {
      const { captions, hashtags, heading, verify, relatedTopics, contentType } = req.body;
      const contentFile = req.file;

      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key

      // Get the user's ID from the decoded token
      const userId = decoded.userId;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Create folder structure on S3
      const uniqueFolderName = `${userId}/${heading}_${Date.now()}/`;

      // Upload the file to S3
      const params = {
        Bucket: 'scaleupbucket',
        Key: `${uniqueFolderName}${contentFile.originalname}`, // You can adjust the file naming here
        Body: contentFile.buffer,
        ContentType: contentFile.mimetype,
        ACL: 'public-read', // Set ACL to public-read

      };

      s3.upload(params, async (err, data) => {
        if (err) {
          console.error('S3 upload error:', err);
          return res.status(500).json({ error: 'Failed to upload content' });
        }

        

        // Create a new content document in MongoDB
        const newContent = new Content({
          username: user.username,
          captions: captions,
          hashtags: hashtags.split(',').map(tag => tag.trim()),
          heading: heading,
          verify: verify,
          relatedTopics: relatedTopics.split(',').map(topic => topic.trim()),
          contentURL: data.Location, // Store S3 URL in the contentURL field
          userId: user._id ,// Link the content to the user who created it
          smeVerify: user.role === 'Subject Matter Expert' ? 'Accepted' : verify === 'Yes' ? 'Pending' : 'NA',
          contentType : contentType,
        

        });

        await newContent.save();

        return res.status(200).json({ message: 'Content added successfully' });
      });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Content creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.listPendingVerificationContent = async (req, res) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.role !== 'Subject Matter Expert') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const userBioInterests = user.bio.bioInterests.map(interest => interest.toLowerCase());

      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const skip = (page - 1) * pageSize;

      const smeUsers = await User.find({ role: 'Subject Matter Expert' }, '_id').lean();
      const smeUserIds = smeUsers.map(user => user._id);

      let baseQuery = {
        smeVerify: { $in: ['Pending', ] }, 
        userId: { $nin: smeUserIds },
        $or: [
          { hashtags: { $in: userBioInterests.map(tag => new RegExp(tag, 'i')) } },
          { relatedTopics: { $in: userBioInterests.map(topic => new RegExp(topic, 'i')) } }
        ],
      };

      if (!user.isTestUser) {
        const nonTestUsers = await User.find({ isTestUser: false }, '_id').lean();
        const nonTestUserIds = nonTestUsers.map(user => user._id);
        baseQuery = {
          ...baseQuery,
          userId: { $nin: smeUserIds, $in: nonTestUserIds },
        };
      }

      const totalPendingContent = await Content.countDocuments(baseQuery);

      const pendingContent = await Content.find(baseQuery)
        .select('username postdate relatedTopics hashtags _id captions heading contentURL rating smeVerify smeComments smeCommentsHistory contentType userId')
        .populate('userId', 'username totalRating profilePicture')
        .sort({ postdate: -1 })
        .skip(skip)
        .limit(pageSize);

      const totalPages = Math.ceil(totalPendingContent / pageSize);

      res.json({
        pendingContent,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalPendingContent
        }
      });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error listing pending content:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // controller for updating content rating and verification
  exports.updateContentRatingAndVerification = async (req, res) => {
    try {
      const { contentId } = req.params;
      const { rating, smeVerify, smeComments } = req.body;

      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const content = await Content.findById(contentId);

      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }

      const user = await User.findById(userId);

      if (!user || user.role !== 'Subject Matter Expert') {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (smeVerify === 'Revise') {
        if (content.revisionCount >= 2) {
          return res.status(400).json({ message: 'Maximum revisions reached. Only Approve or Reject is allowed.' });
        }

        content.smeVerify = 'Revise';
        content.smeComments = smeComments;
        content.revisionCount += 1;
        content.smeCommentsHistory.push({ comment: smeComments });
      } else {
        if (content.revisionCount >= 2 && smeVerify !== 'Accepted' && smeVerify !== 'Rejected') {
          return res.status(400).json({ message: 'Only Approve or Reject is allowed after 2 revisions.' });
        }

        content.smeVerify = smeVerify;
        content.smeComments = smeComments;
        content.smeCommentsHistory.push({ comment: smeComments });

        if (smeVerify === 'Accepted') {
          content.rating = rating;
          const contentAuthor = await User.findById(content.userId);

          if (contentAuthor) {
            // Accumulate totalRating directly as a simple sum
            contentAuthor.totalRating += rating;

            // Calculate the new level based on the accumulated totalRating
            contentAuthor.level = calculateLevel(contentAuthor.totalRating);

            // Update badges based on the current totalRating
            contentAuthor.badges = getUpdatedBadges(contentAuthor.totalRating, contentAuthor.badges);

            await contentAuthor.save();
          }
        }
      }

      await content.save();

      const recipientId = content.userId;
      const senderId = userId;
      const type = 'Content Validation';
      const notificationContent = `SME has ${smeVerify} your post.`;
      const link = `/api/content/post/${contentId}`;

      await exports.createNotification(recipientId, senderId, type, notificationContent, link);

      res.json({ message: 'Content verification updated successfully' });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Content verification update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Helper function to calculate user level based on totalRating
  function calculateLevel(totalRating) {
    if (totalRating >= 1000) return 5;
    if (totalRating >= 600) return 4;
    if (totalRating >= 300) return 3;
    if (totalRating >= 150) return 2;
    return 1;
  }

  // Helper function to assign or update badges based on totalRating
  function getUpdatedBadges(totalRating, currentBadges) {
    const badges = new Set(currentBadges);

    if (totalRating >= 1000) {
      badges.add('Subject Matter Expert');
    } else if (totalRating >= 600) {
      badges.add('Influencer');
    } else if (totalRating >= 300) {
      badges.add('Specialist');
    } else if (totalRating >= 150) {
      badges.add('Creator');
    } else if (totalRating >= 10) {
      badges.add('Explorer');
    }

    return Array.from(badges);
  }
  // Controller function to get content details by content ID for verfification
  exports.getContentDetails = async (req, res) => {
    try {
      const { contentId } = req.params;

      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key

      // Get the user's ID from the decoded token
      const userId = decoded.userId;

      // Find the user by ID
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Find the content by ID
      const content = await Content.findById(contentId).populate('userId', 'username isTestUser');

      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }

      // Check if the content should be accessible based on the test user status
      if (!user.isTestUser && content.userId.isTestUser) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // You can include any additional details you want to display here
      const contentDetails = {
        _id: content._id,
        username: content.userId.username,
        postdate: content.postdate,
        relatedTopics: content.relatedTopics,
        hashtags: content.hashtags,
        captions: content.captions,
        heading: content.heading,
        contentURL: content.contentURL,
        rating: content.rating,
        smeVerify: content.smeVerify,
        smeComments: content.smeComments,
        contentType: content.contentType,
        viewCount: content.viewCount,
      };

      res.json({ contentDetails });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error getting content details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.getAllContent = async (req, res) => {
    try {
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);

      // Get the user's ID from the decoded token
      const userId = decoded.userId;

      // Find the user by ID in the database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10; // Default page size
      const skip = (page - 1) * pageSize;

      // Get the user's bio interests and following list
      const userBioInterests = user.bio.bioInterests.map(interest => interest.toLowerCase());
      const followingUsernames = user.following;

      // Get the list of blocked user IDs and users who have blocked the logged-in user
      const blockedUserIds = user.blockedUsers || [];
      const usersWhoBlockedLoggedInUser = await User.find({ blockedUsers: userId });
      const usersWhoBlockedLoggedInUserIds = usersWhoBlockedLoggedInUser.map(user => user._id);

      // Find user IDs of people the current user is following
      const followingUsers = await User.find({ username: { $in: followingUsernames } });
      const followingUserIds = followingUsers.map(user => user._id);

      // Create the base query
      let baseQuery = {
        userId: { $nin: [...blockedUserIds, ...usersWhoBlockedLoggedInUserIds] },
        $or: [
          { hashtags: { $in: userBioInterests.map(tag => new RegExp(tag, 'i')) } },
          { relatedTopics: { $in: userBioInterests.map(topic => new RegExp(topic, 'i')) } },
          { userId: { $in: followingUserIds } }
        ]
      };

      // Modify the query based on whether the user is a test user or not
      if (!user.isTestUser) {
        const nonTestUsers = await User.find({ isTestUser: false }, '_id').lean();
        const nonTestUserIdArray = nonTestUsers.map(user => user._id);
        baseQuery = {
          ...baseQuery,
          $and: [
            baseQuery,
            { userId: { $in: nonTestUserIdArray } }
          ]
        };
      }

      // Calculate total number of matching content items
      const totalContent = await Content.countDocuments(baseQuery);

      // Fetch the paginated content
      const filteredContent = await Content.find(baseQuery)
        .select('username postdate heading hashtags relatedTopics captions contentURL likes comments contentType smeVerify viewCount')
        .populate('userId', 'profilePicture username')
        .populate('pinnedComment')
        .sort({ postdate: -1 })
        .skip(skip)
        .limit(pageSize);

      // Fetch comments for each content item
      const contentWithComments = [];
      for (const contentItem of filteredContent) {
        const comments = await Comment.find({ contentId: contentItem._id })
          .populate('userId', 'profilePicture username');
        contentWithComments.push({ ...contentItem.toObject(), comments });
      }

      // Add a "Verified" tag to content with smeVerify = "Accepted"
      const contentWithVerification = contentWithComments.map(content => ({
        ...content,
        isVerified: content.smeVerify === 'Accepted',
      }));

      // Calculate total pages
      const totalPages = Math.ceil(totalContent / pageSize);

      // Send the response with pagination details
      res.json({
        content: contentWithVerification,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalContent
        }
      });

    } catch (error) {
      Sentry.captureException(error);
      console.error('Error getting filtered content:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

    
  const updateInterests = async (viewerId, topics) => {
    for (const topic of topics) {
      const cleanedTopic = topic.toLowerCase().replace('#', '');
      await InterestView.findOneAndUpdate(
        { viewerId, interest: cleanedTopic },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      );
    }
  };

  // Controller function to like a content item
  exports.likeContent = async (req, res) => {
    try {
      const { contentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const updatedContent = await Content.findByIdAndUpdate(
        contentId,
        { $addToSet: { likes: userId } },
        { new: true }
      );

      if (!updatedContent) {
        return res.status(404).json({ error: 'Content not found' });
      }

      updatedContent.likeCount = updatedContent.likes.length;
      await updatedContent.save();

      // Update interests for the user
      const relatedTopics = updatedContent.relatedTopics || [];
      const hashtags = updatedContent.hashtags || [];
      await updateInterests(userId, [...relatedTopics, ...hashtags]);

      // Create a notification and return the updated likeCount
      if (updatedContent.userId.toString() !== userId) {
        const liker = await User.findById(userId);
        await exports.createNotification(updatedContent.userId, userId, 'like', `${liker.username} liked your post.`, `/api/content/post/${contentId}`);
      }

      res.json({ likeCount: updatedContent.likeCount });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error liking content:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
    
    // Controller function to unlike a content item
    exports.unlikeContent = async (req, res) => {
      try {
        const { contentId } = req.params;
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key
        const userId = decoded.userId;
    
        // Find the content by ID and update the likes array to remove the user's ID
        const content = await Content.findByIdAndUpdate(
          contentId,
          { $pull: { likes: userId } }, // Remove the user's ID from the likes array
          { new: true } // Return the updated content
        );
    
        if (!content) {
          return res.status(404).json({ error: 'Content not found' });
        }
    
        // Update the likeCount
        content.likeCount = content.likes.length;
    
        // Save the updated content
        await content.save();
    
        // Return the updated likeCount
        res.json({ likeCount: content.likeCount });
      } catch (error) {
        Sentry.captureException(error);
        console.error('Error unliking content:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };

    exports.addComment = async (req, res) => {
      try {
        const { contentId, commentText } = req.body;
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        const userId = decoded.userId;
    
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
    
        const content = await Content.findById(contentId);
        if (!content) {
          return res.status(404).json({ error: 'Content not found' });
        }
    
        const newComment = new Comment({
          contentId,
          userId,
          username: user.username,
          commentText
        });
    
        await newComment.save();
        content.comments.push(newComment._id);
        content.CommentCount = content.comments.length;
        await content.save();
    
        // Handle mentions
        const mentionedUsers = await parseMentions(commentText);
        for (const mentionedUser of mentionedUsers) {
          await exports.createNotification(
            mentionedUser._id,
            userId,
            'mention',
            `${user.username} mentioned you in a comment.`,
            `/api/content/post/${contentId}`
          );
        }
    
        // Normal comment notification
        if (content.userId.toString() !== userId) {
          await exports.createNotification(content.userId, userId, 'comment', `${user.username} commented on your post.`, `/api/content/post/${contentId}`);
        }
    
        res.status(200).json({ message: 'Comment added successfully' });
      } catch (error) {
        Sentry.captureException(error);
        console.error('Comment creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
    
  // Controller function to get content details by content ID
  exports.getPostDetails = async (req, res) => {
    try {
      const { contentId } = req.params;

      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key

      // Get the user's ID from the decoded token
      const userId = decoded.userId;

      // Find the user by ID in the database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

          // Find the content by ID, populate the user data, and include the pinned comment
    const content = await Content.findById(contentId)
    .populate('userId', 'username isTestUser')
    .populate('pinnedComment') // Populate the pinned comment
    .populate({
      path: 'comments',
      populate: { path: 'userId', select: 'username profilePicture' },
    });

      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }

      // Check if the logged-in user is not a test user and the content is from a test user
      if (!user.isTestUser && content.userId.isTestUser) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // You can include any additional details you want to display here
      const contentDetails = {
        _id: content._id,
        username: content.userId.username,
        postdate: content.postdate,
        relatedTopics: content.relatedTopics,
        hashtags: content.hashtags,
        captions: content.captions,
        heading: content.heading,
        contentURL: content.contentURL,
        likeCount: content.likeCount,
        CommentCount: content.CommentCount,
        contentType: content.contentType,
        viewCount: content.viewCount,
        pinnedComment: content.pinnedComment,
      };

      res.json({ contentDetails });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error getting content details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.createNotification = async (recipientId, senderId, type, content, link) => {
    const newNotification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type: type,
      content: content,
      link: link,
    });

    await newNotification.save();
  };

  // Controller function to retrieve notifications for the logged-in user
  exports.getNotifications = async (req, res) => {
    try {
      // Get the JWT token from the request headers
      const token = req.headers.authorization.split(' ')[1];
      
      // Verify the token to get the user's ID
      const decoded = jwt.verify(token, jwtSecret); // Replace 'your-secret-key' with your actual secret key

      // Get the user's ID from the decoded token
      const userId = decoded.userId;

      // Query the database for notifications for the user
      const notifications = await Notification.find({ recipient: userId , isRead: false })
        .sort({ createdAt: -1 }) // Sort by most recent first
        .limit(50); // Limit the number of notifications to retrieve

      res.json(notifications);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.markNotificationsAsRead = async (req, res) => {
    try {
      // Check if the 'Authorization' header is present in the request
      if (!req.headers.authorization) {
        return res.status(401).json({ error: 'Authorization header missing' });
      }

      // Get the JWT token from the request headers
      const token = req.headers.authorization.split(' ')[1];

      // Verify the token to get the user's ID
      const decoded = jwt.verify(token, jwtSecret); // Replace 'your-secret-key' with your actual secret key

      // Get the user's ID from the decoded token
      const userId = decoded.userId;

      // Extract the notification IDs from the request body
      const { notificationIds } = req.body;

      if (!notificationIds || !notificationIds.length) {
        return res.status(400).json({ error: 'No notification IDs provided' });
      }

      // Update the notifications to mark them as read
      await Notification.updateMany(
        {
          _id: { $in: notificationIds },
          recipient: userId,
        },
        { $set: { isRead: true } }
      );

      res.json({ message: 'Notifications marked as read' });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };



  exports.getHomepageContent = async (req, res) => {
    try {
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key

      // Get the user's ID from the decoded token
      const userId = decoded.userId;

      // Find the user by ID in the database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10; // Default page size
      const skip = (page - 1) * pageSize;

      // Get the list of usernames that the logged-in user is following
      const followingUsernames = user.following || [];

      // Find the user IDs corresponding to the usernames in the following array
      const followingUsers = await User.find({ username: { $in: followingUsernames } });

      // Extract the user IDs from the followingUsers array
      const followingUserIds = followingUsers.map(user => user._id);

      // Base query for homepage content
      let baseQuery = {
        userId: { $in: [...followingUserIds, userId] }
      };

      // Modify the query based on the test user status
      if (!user.isTestUser) {
        const nonTestUsers = await User.find({ _id: { $in: followingUserIds }, isTestUser: false }).select('_id');
        const nonTestUserIds = nonTestUsers.map(user => user._id);
        baseQuery.userId = { $in: [...nonTestUserIds, userId] }; // Exclude test user content for non-test users
      }

      // Calculate total number of content items
      const totalContent = await Content.countDocuments(baseQuery);

      // Fetch the required slice of content already sorted
      const content = await Content.find(baseQuery)
        .select('username postdate heading hashtags relatedTopics captions contentURL likes comments contentType smeVerify viewCount')
        .populate('userId', 'profilePicture username isTestUser')
        .sort({ postdate: -1 }) // Sorting globally
        .skip(skip)
        .limit(pageSize);

      // Fetch comments for each content item
      const contentWithComments = [];
      for (const contentItem of content) {
        const comments = await Comment.find({ contentId: contentItem._id })
          .populate('userId', 'profilePicture username');
        contentWithComments.push({ ...contentItem.toObject(), comments });
      }

      // Process for verification tag
      const contentWithVerification = contentWithComments.map(content => ({
        ...content,
        isVerified: content.smeVerify === 'Accepted',
      }));

      const totalPages = Math.ceil(totalContent / pageSize);

      res.json({
        content: contentWithVerification,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalContent
        }
      });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error getting homepage content:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };



  exports.deleteContent = async (req, res) => {
    try {
      const { contentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const content = await Content.findById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }

      // Verify the user attempting to delete the content is the owner
      if (content.userId.toString() !== userId) {
        return res.status(403).json({ message: 'You do not have permission to delete this content' });
      }

        // Delete associated comments from MongoDB
        await Comment.deleteMany({ contentId: content._id });

        // Delete the content document from MongoDB
        await Content.deleteOne({ _id: contentId });

        res.json({ message: 'Content and associated comments deleted successfully' });
      
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error deleting content and associated comments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.incrementViewCount = async (req, res) => {
    try {
      const { contentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const content = await Content.findById(contentId);

      if (!content) {
        return res.status(404).json({ message: 'Content not found' });
      }

      // Increment the view count for the content
      content.viewCount += 1;

      // Check if the user has already viewed the content
      const userView = content.views.find(view => view.userId.toString() === userId);

      if (userView) {
        // If the user has already viewed the content, increment the count
        userView.count += 1;
      } else {
        // If the user has not viewed the content, add a new view entry
        content.views.push({ userId, count: 1 });
      }

      await content.save();

      res.status(200).json({ message: 'View count updated successfully', viewCount: content.viewCount, views: content.views });
    } catch (error) {
      console.error('Error incrementing view count:', error);
      Sentry.captureException(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };


  exports.deleteComment = async (req, res) => {
    try {
      const { commentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const comment = await Comment.findById(commentId);

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const content = await Content.findById(comment.contentId);

      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }

      // Check if the logged-in user is the author of the comment or the creator of the content
      if (comment.userId.toString() !== userId && content.userId.toString() !== userId) {
        return res.status(403).json({ message: 'You do not have permission to delete this comment' });
      }

      // Delete the comment
      await Comment.deleteOne({ _id: commentId });

      // Remove the comment reference from the associated content
      await Content.updateOne(
        { _id: comment.contentId },
        { $pull: { comments: commentId } }
      );

      // Update the CommentCount in the content model
      content.CommentCount = content.comments.length;
      await content.save();

      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error deleting comment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };


  exports.saveContent = async (req, res) => {
    try {
      const { contentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const content = await Content.findById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }

      // Check if the user is trying to save their own content
      if (content.userId.toString() === userId) {
        return res.status(400).json({ error: 'You cannot save your own content' });
      }

      const user = await User.findById(userId);

      // Check if the content is already saved
      const isAlreadySaved = user.savedContent.some(
        (savedContent) => savedContent.toString() === contentId
      );

      if (isAlreadySaved) {
        return res.status(400).json({ error: 'Content is already saved' });
      }

      user.savedContent.push(contentId);
      await user.save();

      res.json({ message: 'Content saved successfully' });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error saving content:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };


  exports.unsaveContent = async (req, res) => {
    try {
      const { contentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const content = await Content.findById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }

      await User.findByIdAndUpdate(userId, { $pull: { savedContent: contentId } });
      res.json({ message: 'Content unsaved successfully' });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error unsaving content:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.getSavedContent = async (req, res) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const user = await User.findById(userId).populate('savedContent');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user.savedContent);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error fetching saved content:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.updateContentFields = async (req, res) => {
    try {
      const { contentId } = req.params;
      const { captions, relatedTopics, hashtags } = req.body;

      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const content = await Content.findById(contentId);

      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }

      if (content.userId.toString() !== userId) {
        return res.status(403).json({ message: 'You do not have permission to update this content' });
      }

      if (captions !== undefined) content.captions = captions;
      if (relatedTopics !== undefined) content.relatedTopics = relatedTopics.split(',').map(topic => topic.trim());
      if (hashtags !== undefined) content.hashtags = hashtags.split(',').map(tag => tag.trim());

      // Reset smeVerify to Pending only if verify is Yes
      if (content.verify === 'Yes') {
        content.smeVerify = 'Pending';
      }

      await content.save();

      res.json({ message: 'Content updated successfully', content });
    } catch (error) {
      console.error('Error updating content fields:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.addReply = async (req, res) => {
    try {
      const { contentId, commentText, parentCommentId } = req.body;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
  
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      const content = await Content.findById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }
  
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
  
      const contentOwnerUserSettings = await UserSettings.findOne({ userId: content.userId });
      if (!contentOwnerUserSettings) {
        return res.status(404).json({ error: 'Content owner settings not found' });
      }
  
      const contentOwnerCommentPrivileges = contentOwnerUserSettings.commentPrivacy;
      if (
        contentOwnerCommentPrivileges === 'everyone' ||
        (contentOwnerCommentPrivileges === 'followers' && user.following.includes(content.username))
      ) {
        const newComment = new Comment({
          contentId: contentId,
          userId: userId,
          username: user.username,
          commentText: commentText,
          parentCommentId: parentCommentId,
        });
  
        await newComment.save();
  
        parentComment.replies.push(newComment._id);
        await parentComment.save();
  
        content.comments.push(newComment._id);
        await content.save();
  
        content.CommentCount = content.comments.length;
        await content.save();
  
        // Notify the owner of the content
        if (content.userId.toString() !== userId) {
          const recipientId = content.userId;
          const senderId = userId;
          const type = 'reply';
          const notificationContent = `${user.username} replied to your comment.`;
          const link = `/api/content/post/${contentId}`;
  
          await exports.createNotification(recipientId, senderId, type, notificationContent, link);
        }
  
        // Parse the comment text to detect mentions and notify mentioned users
        const mentionedUsernames = commentText.match(/@(\w+)/g);
        if (mentionedUsernames) {
          for (const mentionedUsername of mentionedUsernames) {
            const username = mentionedUsername.slice(1); // Remove the "@" symbol
            const mentionedUser = await User.findOne({ username });
  
            if (mentionedUser && mentionedUser._id.toString() !== userId) {
              const recipientId = mentionedUser._id;
              const senderId = userId;
              const type = 'mention';
              const notificationContent = `${user.username} mentioned you in a reply.`;
              const link = `/api/content/post/${contentId}`;
  
              await exports.createNotification(recipientId, senderId, type, notificationContent, link);
            }
          }
        }
  
        res.status(200).json({
          message: 'Reply added successfully',
          comment: {
            _id: newComment._id,
            contentId: contentId,
            userId: userId,
            username: user.username,
            profilePicture: user.profilePicture,
            commentText: commentText,
            commentDate: newComment.commentDate,
          },
        });
      } else {
        res.status(403).json({ error: 'You do not have the necessary privileges to comment on this content' });
      }
    } catch (error) {
      Sentry.captureException(error);
      console.error('Reply creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };


  // Controller function to like a comment
  exports.likeComment = async (req, res) => {
    try {
      const { commentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      const comment = await Comment.findByIdAndUpdate(
        commentId,
        { $addToSet: { likes: userId } },
        { new: true }
      );

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      comment.likeCount = comment.likes.length;
      await comment.save();

      if (comment.userId.toString() !== userId) {
        const liker = await User.findById(userId);
        const recipientId = comment.userId;
        const senderId = userId;
        const type = 'like';
        const notificationContent = `${liker.username} liked your comment.`;
        const link = `/api/content/comment/${commentId}`;

        await exports.createNotification(recipientId, senderId, type, notificationContent, link);
      }

      res.json({ likeCount: comment.likeCount });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error liking comment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Controller function to unlike a comment
  exports.unlikeComment = async (req, res) => {
    try {
      const { commentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      const comment = await Comment.findByIdAndUpdate(
        commentId,
        { $pull: { likes: userId } },
        { new: true }
      );

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      comment.likeCount = comment.likes.length;
      await comment.save();

      res.json({ likeCount: comment.likeCount });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error unliking comment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Create a new Learn List
exports.createLearnList = async (req, res) => {
  try {
    const { name, description, contentItems, visibility, relatedTopics } = req.body; // Add relatedTopics to the destructuring
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const creatorId = decoded.userId;

    // Validate the contentItems and assign sequence numbers
    const validContentItems = await Promise.all(
      contentItems.map(async (item, index) => {
        const content = await Content.findById(item.content);
        if (!content) {
          throw new Error(`Content with ID ${item.content} not found`);
        }
        return { content: item.content, sequence: index + 1 };
      })
    );

    // Create the LearnList object including the relatedTopics field
    const learnList = new LearnList({
      name,
      description,
      creator: creatorId,
      contentItems: validContentItems,
      visibility,
      relatedTopics, // Include relatedTopics here
    });

    await learnList.save();
    res.status(201).json({ message: 'Learn List created successfully', learnList });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error creating Learn List:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


 // Get a Learn List by ID and include user progress and completion percentage
exports.getLearnListById = async (req, res) => {
  try {
    const { learnListId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const learnList = await LearnList.findById(learnListId).populate('contentItems.content');
    if (!learnList) {
      return res.status(404).json({ message: 'Learn List not found' });
    }

    const totalItems = learnList.contentItems.length;
    const progress = await LearnListProgress.findOne({ user: userId, learnList: learnListId }).populate('completedItems.content');

    let completedItemsCount = 0;
    if (progress) {
      completedItemsCount = progress.completedItems.length;
    }

    const completionPercentage = totalItems > 0 ? (completedItemsCount / totalItems) * 100 : 0;

    res.status(200).json({
      learnList,
      progress,
      completionPercentage: completionPercentage.toFixed(2), // return percentage with two decimal places
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching Learn List:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Add Content to an existing Learn List and manage sequences
exports.addContentToLearnList = async (req, res) => {
  try {
    const { learnListId } = req.params;
    const { contentId, sequence } = req.body;

    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const learnList = await LearnList.findById(learnListId);

    if (!learnList) {
      return res.status(404).json({ message: 'Learn List not found' });
    }

    // Check if the user is the creator of the Learn List
    if (learnList.creator.toString() !== userId) {
      return res.status(403).json({ message: 'You do not have permission to modify this Learn List' });
    }

    if (!contentId) {
      return res.status(400).json({ message: 'Content ID is required' });
    }

    if (sequence === undefined || sequence === null) {
      // Add content to the end of the Learn List
      learnList.contentItems.push({ content: contentId, sequence: learnList.contentItems.length + 1 });
    } else {
      // Add content at the specified sequence, and adjust other items
      const indexToInsert = sequence - 1;

      // Validate sequence
      if (indexToInsert < 0 || indexToInsert > learnList.contentItems.length) {
        return res.status(400).json({ message: 'Invalid sequence number' });
      }

      // Insert the new content and push other items down
      learnList.contentItems.splice(indexToInsert, 0, { content: contentId, sequence: sequence });

      // Adjust sequence numbers of all items
      for (let i = 0; i < learnList.contentItems.length; i++) {
        learnList.contentItems[i].sequence = i + 1;
      }
    }

    await learnList.save();
    res.status(200).json({ message: 'Content added and sequences updated successfully', learnList });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error adding content to Learn List:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change the sequence of existing content in a Learn List
exports.changeContentSequence = async (req, res) => {
  try {
    const { learnListId } = req.params;
    const { contentId, newSequence } = req.body;

    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const learnList = await LearnList.findById(learnListId);

    if (!learnList) {
      return res.status(404).json({ message: 'Learn List not found' });
    }

    // Check if the user is the creator of the Learn List
    if (learnList.creator.toString() !== userId) {
      return res.status(403).json({ message: 'You do not have permission to modify this Learn List' });
    }

    const contentIndex = learnList.contentItems.findIndex(item => item.content.toString() === contentId);

    if (contentIndex === -1) {
      return res.status(404).json({ message: 'Content not found in the Learn List' });
    }

    if (newSequence < 1 || newSequence > learnList.contentItems.length) {
      return res.status(400).json({ message: 'Invalid sequence number' });
    }

    // Remove the content item from its current position
    const [contentItem] = learnList.contentItems.splice(contentIndex, 1);

    // Insert the content item at the new sequence position
    learnList.contentItems.splice(newSequence - 1, 0, contentItem);

    // Adjust sequence numbers of all items
    for (let i = 0; i < learnList.contentItems.length; i++) {
      learnList.contentItems[i].sequence = i + 1;
    }

    await learnList.save();
    res.status(200).json({ message: 'Content sequence updated successfully', learnList });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error changing content sequence in Learn List:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a Learn List by ID
exports.deleteLearnList = async (req, res) => {
  try {
    const { learnListId } = req.params;

    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const learnList = await LearnList.findById(learnListId);

    if (!learnList) {
      return res.status(404).json({ message: 'Learn List not found' });
    }

    // Check if the user is the creator of the Learn List
    if (learnList.creator.toString() !== userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this Learn List' });
    }

    await learnList.deleteOne();  // Use deleteOne instead of remove
    res.status(200).json({ message: 'Learn List deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting Learn List:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all public Learn Lists
  exports.getAllPublicLearnLists = async (req, res) => {
    try {
      const learnLists = await LearnList.find({ visibility: 'public' }).populate('creator', 'username');

      res.status(200).json(learnLists);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error fetching public Learn Lists:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

// List all Learn Lists created by the logged-in user
exports.getLearnListsByUser = async (req, res) => {
  try {
    // Extract the JWT token from the authorization header
    const token = req.headers.authorization.split(' ')[1];
    // Decode the token to get the user's ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Log the extracted userId for debugging
    console.log('Extracted userId from token:', userId);

    // Find the Learn Lists created by this user
    const learnLists = await LearnList.find({ creator: userId }).populate('creator', 'username');

    // Log the results of the query for debugging
    console.log('Learn Lists retrieved:', learnLists);

    res.status(200).json(learnLists);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching Learn Lists by user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Search Learn Lists based on username, name, description, and related topics
exports.searchLearnLists = async (req, res) => {
  try {
    const { username, name, description, relatedTopics } = req.body;

    // Build the query dynamically based on the search criteria
    let query = {};

    // Search by username
    if (username) {
      const user = await User.findOne({ username: new RegExp(username, 'i') });
      if (user) {
        query.creator = user._id;
      } else {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    // Search by Learn List name
    if (name) {
      query.name = new RegExp(name, 'i'); // Case-insensitive regex search
    }

    // Search by description
    if (description) {
      query.description = new RegExp(description, 'i'); // Case-insensitive regex search
    }

    // Search by related topics
    if (relatedTopics) {
      const topicsArray = relatedTopics.split(',').map(topic => topic.trim());
      query.relatedTopics = { $in: topicsArray };
    }

    // Perform the search with the built query
    const learnLists = await LearnList.find(query).populate('creator', 'username');

    res.status(200).json(learnLists);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error searching Learn Lists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark content as completed in a Learn List
exports.markContentAsCompleted = async (req, res) => {
  try {
    const { learnListId, contentId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    let progress = await LearnListProgress.findOne({ user: userId, learnList: learnListId });

    if (!progress) {
      // Create a new progress document if it doesn't exist
      progress = new LearnListProgress({
        user: userId,
        learnList: learnListId,
        completedItems: [{ content: contentId }],
      });
    } else {
      // Add the content to the completedItems if it's not already completed
      const alreadyCompleted = progress.completedItems.some(item => item.content.toString() === contentId);
      if (!alreadyCompleted) {
        progress.completedItems.push({ content: contentId });
      }
    }

    progress.lastUpdated = Date.now();
    await progress.save();

    res.status(200).json({ message: 'Content marked as completed', progress });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error marking content as completed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get progress for a Learn List with completion percentage
exports.getLearnListProgress = async (req, res) => {
  try {
    const { learnListId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const learnList = await LearnList.findById(learnListId);
    if (!learnList) {
      return res.status(404).json({ message: 'Learn List not found' });
    }

    const totalItems = learnList.contentItems.length;
    const progress = await LearnListProgress.findOne({ user: userId, learnList: learnListId }).populate('completedItems.content');

    let completedItemsCount = 0;
    if (progress) {
      completedItemsCount = progress.completedItems.length;
    }

    const completionPercentage = totalItems > 0 ? (completedItemsCount / totalItems) * 100 : 0;

    res.status(200).json({
      learnList,
      progress,
      completionPercentage: completionPercentage.toFixed(2), // return percentage with two decimal places
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error retrieving Learn List progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new discussion in a Learn List
exports.createDiscussion = async (req, res) => {
  try {
    const { learnListId } = req.params;
    const { title, text } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const learnList = await LearnList.findById(learnListId);
    if (!learnList) {
      return res.status(404).json({ message: 'Learn List not found' });
    }

    const discussion = new Discussion({
      learnList: learnListId,
      user: userId,
      title,
      text,
    });

    await discussion.save();

    learnList.discussions.push(discussion._id);
    await learnList.save();

    res.status(201).json({ message: 'Discussion created successfully', discussion });
  } catch (error) {
    console.error('Error creating discussion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.addReplytoDiscussion = async (req, res) => {
  try {
    const { learnListId, discussionId } = req.params;
    const { text } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Fetch the user's details to get the username
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({ message: 'Discussion not found' });
    }

    const reply = {
      user: userId,
      text,
    };

    discussion.replies.push(reply);
    await discussion.save();

    // Populate the user information (including profile picture) for the response
    const populatedDiscussion = await discussion.populate('replies.user', 'username profilePicture');

    // Notify the discussion owner
    if (discussion.user.toString() !== userId) {
      const recipientId = discussion.user;
      const senderId = userId;
      const type = 'reply';
      const notificationContent = `${user.username} replied to your discussion.`;
      const link = `/api/learnList/${learnListId}/discussion/${discussionId}`;

      await exports.createNotification(recipientId, senderId, type, notificationContent, link);
    }

    // Parse the reply text to detect mentions and notify mentioned users
    const mentionedUsernames = text.match(/@(\w+)/g);
    if (mentionedUsernames) {
      for (const mentionedUsername of mentionedUsernames) {
        const username = mentionedUsername.slice(1); // Remove the "@" symbol
        const mentionedUser = await User.findOne({ username });

        if (mentionedUser && mentionedUser._id.toString() !== userId) {
          const recipientId = mentionedUser._id;
          const senderId = userId;
          const type = 'mention';
          const notificationContent = `${user.username} mentioned you in a reply.`;
          const link = `/api/learnList/${learnListId}/discussion/${discussionId}`;

          await exports.createNotification(recipientId, senderId, type, notificationContent, link);
        }
      }
    }

    res.status(201).json({ message: 'Reply added successfully', discussion: populatedDiscussion });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getDiscussionsByLearnList = async (req, res) => {
  try {
    const { learnListId } = req.params;

    const learnList = await LearnList.findById(learnListId)
      .populate({
        path: 'pinnedDiscussions',
        populate: { path: 'user', select: 'username profilePicture' },
      })
      .populate({
        path: 'discussions',
        populate: { path: 'user replies.user', select: 'username profilePicture' },
      });

    if (!learnList) {
      return res.status(404).json({ message: 'Learn List not found' });
    }

    const discussions = [...learnList.pinnedDiscussions, ...learnList.discussions];

    res.status(200).json(discussions);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching discussions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const parseMentions = async (text) => {
  const mentionedUsernames = text.match(/@(\w+)/g);
  if (!mentionedUsernames) return [];

  const uniqueUsernames = [...new Set(mentionedUsernames.map(u => u.slice(1)))];
  return User.find({ username: { $in: uniqueUsernames } }).select('_id username');
};

// Controller function to pin a discussion to the top of the Learn List
exports.pinDiscussion = async (req, res) => {
  try {
    const { learnListId, discussionId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const learnList = await LearnList.findById(learnListId);
    if (!learnList) {
      return res.status(404).json({ message: 'Learn List not found' });
    }

    // Check if the user is the creator of the Learn List
    if (learnList.creator.toString() !== userId) {
      return res.status(403).json({ message: 'You do not have permission to pin this discussion' });
    }

    // Check if the discussion is already pinned
    if (learnList.pinnedDiscussions.includes(discussionId)) {
      return res.status(400).json({ message: 'Discussion is already pinned' });
    }

    learnList.pinnedDiscussions.push(discussionId);
    await learnList.save();

    res.status(200).json({ message: 'Discussion pinned successfully', pinnedDiscussions: learnList.pinnedDiscussions });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error pinning discussion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Controller function to unpin a discussion from the Learn List
exports.unpinDiscussion = async (req, res) => {
  try {
    const { learnListId, discussionId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const learnList = await LearnList.findById(learnListId);
    if (!learnList) {
      return res.status(404).json({ message: 'Learn List not found' });
    }

    // Check if the user is the creator of the Learn List
    if (learnList.creator.toString() !== userId) {
      return res.status(403).json({ message: 'You do not have permission to unpin this discussion' });
    }

    // Check if the discussion is pinned
    const discussionIndex = learnList.pinnedDiscussions.indexOf(discussionId);
    if (discussionIndex === -1) {
      return res.status(400).json({ message: 'Discussion is not pinned' });
    }

    learnList.pinnedDiscussions.splice(discussionIndex, 1);
    await learnList.save();

    res.status(200).json({ message: 'Discussion unpinned successfully', pinnedDiscussions: learnList.pinnedDiscussions });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error unpinning discussion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Pin a comment
exports.pinComment = async (req, res) => {
  try {
    const { contentId, commentId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const content = await Content.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Verify the user is the owner of the content
    if (content.userId.toString() !== userId) {
      return res.status(403).json({ message: 'You do not have permission to pin this comment' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Update the pinnedComment field
    content.pinnedComment = commentId;
    await content.save();

    res.status(200).json({ message: 'Comment pinned successfully', pinnedComment: content.pinnedComment });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error pinning comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Unpin a comment
exports.unpinComment = async (req, res) => {
  try {
    const { contentId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const content = await Content.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Verify the user is the owner of the content
    if (content.userId.toString() !== userId) {
      return res.status(403).json({ message: 'You do not have permission to unpin this comment' });
    }

    // Update the pinnedComment field to null
    content.pinnedComment = null;
    await content.save();

    res.status(200).json({ message: 'Comment unpinned successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error unpinning comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
