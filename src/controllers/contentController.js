const aws = require('aws-sdk');
const User = require('../models/userModel'); // Import the User model
const Content = require('../models/contentModel'); // Import the Content model
const Comment = require('../models/commentModel'); // Import the Comment model
const Notification = require('../models/notificationModel'); // Import the Notification model
const UserSettings = require('../models/userSettingsModel'); // Import the UserSettings model
const jwt = require('jsonwebtoken'); // Import JWT library
const Sentry = require('@sentry/node');
require('dotenv').config();


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
    const folderKey = `${userId}/${heading}/`;

    // Upload the file to S3
    const params = {
      Bucket: 'scaleupbucket',
      Key: `${folderKey}${contentFile.originalname}`, // You can adjust the file naming here
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

        // Check if the user is an SME
        if (user.role !== 'Subject Matter Expert') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Get the user's bio interests
        const userBioInterests = user.bio.bioInterests;

        // Query for pending verification content
        const pendingContent = await Content.find({
            smeVerify: 'Pending', // Filter by pending verification status
            $or: [
                { hashtags: { $in: userBioInterests.map(tag => tag.replace('#', '')) } }, // Match hashtags
                { relatedTopics: { $in: userBioInterests } }, // Match related topics
            ],
        })
            .select('username postdate relatedTopics hashtags _id captions heading contentURL rating smeVerify smeComments contentType userId')
            .populate('userId', 'username totalRating'); // Populate user data for content author

        res.json({ pendingContent });
    } catch (error) {
      Sentry.captureException(error);
        console.error('Error listing pending content:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// New controller for updating content rating and verification
exports.updateContentRatingAndVerification = async (req, res) => {
    try {
        const { contentId } = req.params;
        const { rating, smeVerify, smeComments } = req.body;

        // Verify the user's identity using the JWT token
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key

        // Get the user's ID from the decoded token
        const userId = decoded.userId;

        // Find the content by ID
        const content = await Content.findById(contentId);

        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Check if the logged-in user is an SME
        const user = await User.findById(userId);

        if (!user || user.role !== 'Subject Matter Expert') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Update content rating and verification
        content.rating = rating;
        content.smeVerify = smeVerify;
        content.smeComments = smeComments;

        await content.save();

        // Update the totalRating for the content author
        const contentAuthor = await User.findById(content.userId);

        if (contentAuthor) {
            contentAuthor.totalRating += rating;
            await contentAuthor.save();

            // Update the badge based on totalRating
            if (contentAuthor.totalRating >= 1000) {
                contentAuthor.badges = 'Subject Matter Expert';
            } else if (contentAuthor.totalRating >= 600) {
                contentAuthor.badges = 'Influencer';
            } else if (contentAuthor.totalRating >= 300) {
                contentAuthor.badges = 'Specialist';
            } else if (contentAuthor.totalRating >= 150) {
                contentAuthor.badges = 'Creator';
            } else if (contentAuthor.totalRating >= 10) {
                contentAuthor.badges = 'Explorer';
            }

            // Don't create a notification if the user is liking their own content
      const recipientId = content.userId; // The user who owns the content
      const senderId = userId; 
      const type = 'Content Validation '; // Notification type
      const notificationContent = `SME has ${smeVerify} your post.`; // Notification content
      const link = `/api/content/post/${contentId}`; // Link to the liked post

      await createNotification(recipientId, senderId, type, notificationContent, link);
     await contentAuthor.save();
        }

        res.json({ message: 'Content rating and verification updated successfully' });
    } catch (error) {
      Sentry.captureException(error);
        console.error('Content rating and verification update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Controller function to get content details by content ID for verfification
exports.getContentDetails = async (req, res) => {
    try {
      const { contentId } = req.params;
  
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key
  
      // Get the user's ID from the decoded token
      const userId = decoded.userId;
  
      // Find the content by ID
      const content = await Content.findById(contentId).populate('userId', 'username');
  
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }
  
      // You can include any additional details you want to display here
      const contentDetails = {
        _id: content._id,
        username: content.username,
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
      const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key
  
      // Get the user's ID from the decoded token
      const userId = decoded.userId;
  
      // Find the user by ID in the database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Get the user's bio interests
      const userBioInterests = user.bio.bioInterests;
  
      // Get the list of blocked user IDs from the logged-in user's document
      const blockedUserIds = user.blockedUsers || [];

      // Get the list of users who have blocked the logged-in user
    const usersWhoBlockedLoggedInUser = await User.find({ blockedUsers: userId });

    // Create an array of user IDs who have blocked the logged-in user
    const usersWhoBlockedLoggedInUserIds = usersWhoBlockedLoggedInUser.map(user => user._id);
  
      // Query for content matching bio interests and exclude blocked users
      const filteredContent = await Content.find({
        $and: [
          { userId: { $nin: [...blockedUserIds, ...usersWhoBlockedLoggedInUserIds] } }, // Exclude blocked users' content
          {
            $or: [
              { hashtags: { $in: userBioInterests.map(tag => tag.replace('#', '')) } }, // Match hashtags
              { relatedTopics: { $in: userBioInterests } }, // Match related topics
            ],
          },
        ],
      })
        .select('username postdate heading hashtags relatedTopics captions contentURL likes comments contentType smeVerify')
        .populate('userId','profilePicture username')
        .sort({ postdate: -1 }); // Sort by posting date in descending order
  
      // Fetch comments for each content item and add them to the result
      const contentWithComments = [];
      for (const contentItem of filteredContent) {
        const comments = await Comment.find({ contentId: contentItem._id })
          .populate('userId', 'profilePicture username'); // Populate user details for comments
        contentWithComments.push({ ...contentItem.toObject(), comments });
      }
  
  
      // Add a "Verified" tag to content with smeVerify = "Accepted"
      const contentWithVerification = contentWithComments.map(content => ({
        ...content,
        isVerified: content.smeVerify === 'Accepted',
      }));
  
      res.json({ content: contentWithVerification });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error getting filtered content:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
  
// Controller function to like a content item
exports.likeContent = async (req, res) => {
  try {
    const { contentId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key
    const userId = decoded.userId;

    // Find the content by ID and update the likes array
    const updatedContent = await Content.findByIdAndUpdate(
      contentId,
      { $addToSet: { likes: userId } }, // Add the user's ID to the likes array (no duplicates)
      { new: true } // Return the updated content
    );

    if (!updatedContent) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Update the likeCount
    updatedContent.likeCount = updatedContent.likes.length;

    // Save the updated content
    await updatedContent.save();

    // Create a notification for the content owner
    if (updatedContent.userId.toString() !== userId) {

      const liker = await User.findById(userId);

      // Don't create a notification if the user is liking their own content
      const recipientId = updatedContent.userId; // The user who owns the content
      const senderId = userId; // The user who liked the content
      const type = 'like'; // Notification type
      const notificationContent = `${liker.username} liked your post.`; // Notification content
      const link = `/api/content/post/${contentId}`; // Link to the liked post

      await createNotification(recipientId, senderId, type, notificationContent, link);
    }

    // Return the updated likeCount
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

  // Controller function to add a comment
exports.addComment = async (req, res) => {
  try {
    const { contentId, commentText } = req.body;

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
      const content = await Content.findById(contentId);
  
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
    }

    // Fetch the comment privileges of the content owner from UserSettings
    const contentOwnerUserSettings = await UserSettings.findOne({ userId: content.userId });

    if (!contentOwnerUserSettings) {
      return res.status(404).json({ error: 'Content owner settings not found' });
    }

    const contentOwnerCommentPrivileges = contentOwnerUserSettings.commentPrivacy;

    // Check if the user has privileges to comment based on the content owner's settings
    if (
      contentOwnerCommentPrivileges === 'everyone' ||
      (contentOwnerCommentPrivileges === 'followers' && user.following.includes(content.username))
    ) {
      // Create a new comment document
      const newComment = new Comment({
          contentId: contentId,
          userId: userId,
        username: user.username,
          commentText: commentText,
      });

      await newComment.save();

      // Add the comment to the content's comments array
      content.comments.push(newComment._id);
      await content.save();

      // Update the CommentCount in the content model
      content.CommentCount = content.comments.length;
      await content.save();

      // Create a notification for the content owner
      if (content.userId.toString() !== userId) {
          // Don't create a notification if the comment is on the user's own content
        const recipientId = content.userId; // The user who owns the post
        const senderId = userId; // The user who commented
        const type = 'comment'; // Notification type
        const notificationContent = `${user.username} commented on your post.`; // Notification content
        const link = `/api/content/post/${contentId}`; // Link to the commented post

        await createNotification(recipientId, senderId, type, notificationContent, link);
      }

      res.status(200).json({ message: 'Comment added successfully' });
    } else {
      res.status(403).json({ error: 'You do not have the necessary privileges to comment on this content' });
    }
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

    // Find the content by ID
    const content = await Content.findById(contentId).populate('userId', 'username');

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // You can include any additional details you want to display here
    const contentDetails = {
      _id: content._id,
      username: content.username,
      postdate: content.postdate,
      relatedTopics: content.relatedTopics,
      hashtags: content.hashtags,
      captions: content.captions,
      heading: content.heading,
      contentURL: content.contentURL,
      likeCount: content.likeCount,
      CommentCount: content.CommentCount,
      contentType: content.contentType,

    };

    res.json({ contentDetails });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error getting content details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function createNotification(recipientId, senderId, type, content, link) {
  const newNotification = new Notification({
    recipient: recipientId,
    sender: senderId,
    type: type,
    content: content,
    link: link,
  });

  await newNotification.save();
}

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

    // Get the list of usernames that the logged-in user is following
    const followingUsernames = user.following || [];

    // Find the user IDs corresponding to the usernames in the following array
    const followingUsers = await User.find({ username: { $in: followingUsernames } });

    // Extract the user IDs from the followingUsers array
    const followingUserIds = followingUsers.map(user => user._id);

    // Query for content created by the users the logged-in user is following
    const followedUsersContent = await Content.find({ userId: { $in: followingUserIds } })
      .select('username postdate heading hashtags relatedTopics captions contentURL likes comments  contentType smeVerify')
      .populate('userId', 'profilePicture username')
      .sort({ postdate: -1 });

     // Query for the logged-in user's own content
     const loggedInUserContent = await Content.find({ userId })
     .select('username postdate heading hashtags relatedTopics captions contentURL likes comments  contentType smeVerify')
     .populate('userId', 'profilePicture username')
     .sort({ postdate: -1 });

     // Combine the content from followed users and the logged-in user
    const allContent = [...followedUsersContent, ...loggedInUserContent];

    // Sort all content by postdate in descending order
    const homepageContent = allContent.sort((a, b) => b.postdate - a.postdate);

      // Fetch comments for each content item and add them to the result
    const contentWithComments = [];
    for (const contentItem of homepageContent) {
      const comments = await Comment.find({ contentId: contentItem._id })
        .populate('userId', 'profilePicture username'); // Populate user details for comments
      contentWithComments.push({ ...contentItem.toObject(), comments });
    }


    // Add a "Verified" tag to content with smeVerify = "Accepted"
    const contentWithVerification = contentWithComments.map(content => ({
      ...content,
      isVerified: content.smeVerify === 'Accepted',
    }));

    res.json({ content: contentWithVerification });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error getting homepage content:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

