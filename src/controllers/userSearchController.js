const User = require('../models/userModel');
const mongoose = require('mongoose');
const Content = require('../models/contentModel');
//const createNotification = require('../controllers/contentController').createNotification;
const jwt = require('jsonwebtoken');

require('dotenv').config();
const jwtSecret = process.env.JWT_SECRET;

// Controller function to search for users based on various criteria
exports.searchUsers = async (req, res) => {
  try {
    // Check if a valid JWT token is present in the request headers
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key

    // Get the user's ID from the decoded token
    const userId = decoded.userId;

    const { query } = req.body;
    const searchTerms = query.split(',').map(term => term.trim());

    // Build an array of regex patterns for each search term
    const regexPatterns = searchTerms.map(term => new RegExp(term, 'i'));

    // Get the list of blocked users by the logged-in user
    const loggedInUser = await User.findById(userId);
    const blockedUserIds = loggedInUser.blockedUsers || [];

    // Get the list of users who have blocked the logged-in user
    const usersWhoBlockedLoggedInUser = await User.find({ blockedUsers: userId });
    const usersWhoBlockedLoggedInUserIds = usersWhoBlockedLoggedInUser.map(user => user._id);


    // Search users based on multiple fields and exclude blocked users
    const searchResults = await User.find({
      $and: [
        { _id: { $ne: userId } }, // Exclude the logged-in user
        {
          $or: [
            { username: { $in: regexPatterns } }, // Case-insensitive username search
            { firstname: { $in: regexPatterns } }, // Case-insensitive first name search
            { lastname: { $in: regexPatterns } }, // Case-insensitive last name search
            { location: { $in: regexPatterns } }, // Case-insensitive location search
            { 'bio.bioInterests': { $in: regexPatterns } }, // Case-insensitive interests search
          ],
        },
        { _id: { $nin: [...blockedUserIds, ...usersWhoBlockedLoggedInUserIds] } }, // Exclude blocked users
      ],
    })
      .select(
        'profilePicture username firstname lastname role followers following followersCount followingCount'
      );

    const formattedResults = [];

    for (const user of searchResults) {
      const totalPosts = await Content.countDocuments({ userId: user._id });
      formattedResults.push({
        profilePicture: user.profilePicture,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role === 'Subject Matter Expert' ? 'SME' : '',
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        totalPosts,
        userId: user._id,
      });
    }

    res.status(200).json(formattedResults);
  } catch (error) {
    console.error('Error searching for users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



// Controller function to get detailed information about a specific user
exports.getUserDetails = async (req, res) => {
  try {
    // Get the user's unique identifier from the request parameters
    const { userId } = req.params;

    // Check if a valid JWT token is present in the request headers
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key

    // Get the user's ID from the decoded token
    const loggedUserId = decoded.userId;

    // Fetch the user's details, including blockedUsers
    const user = await User.findById(userId).select(
      'profilePicture username firstname lastname email phoneNumber bio.bioInterests education workExperience courses certifications badges dateOfBirth location bio.bioAbout followers following followersCount followingCount role blockedUsers'
    );

    // Check if the user was not found
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = await User.findById(userId);
    const loggedInUser = await User.findById(loggedUserId);
    // Check if either user has blocked the other
    if (
      loggedInUser.blockedUsers.includes(userId) ||
      targetUser.blockedUsers.includes(loggedUserId)
    ) {
      // If either user has blocked the other, return a message indicating the block
      return res.status(403).json({ error: 'Access denied. This user is blocked.' });
    }

    // Fetch the user's associated content, populating both 'likes' and 'comments'
    const userContent = await Content.find({ userId }).select(
      'heading captions contentURL hashtags relatedTopics postdate likes comments smeVerify'
    )
      .populate('likes', 'username')
      .populate({
        path: 'comments',
        select: 'commentText username commentDate', // Adjust the fields you want to select
      });

    const totalPosts = await Content.countDocuments({ userId: user._id });

    // Format the user details
    const formattedUser = {
      profilePicture: user.profilePicture,
      userId: user._id,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role === 'Subject Matter Expert' ? 'SME' : '',
      totalPosts,
      bioInterests: user.bio.bioInterests,
      education: user.education,
      workExperience: user.workExperience,
      courses: user.courses,
      certifications: user.certifications,
      badges: user.badges,
      dateOfBirth: user.dateOfBirth,
      location: user.location,
      bioAbout: user.bio.bioAbout,
      followersCount: user.followersCount,
      followers: user.followers,
      followingCount: user.followingCount,
      following: user.following,
      content: userContent.map(content => ({
        heading: content.heading,
        captions: content.captions,
        contentURL: content.contentURL,
        hashtags: content.hashtags,
        relatedTopics: content.relatedTopics,
        postdate: content.postdate,
        likes: {
          count: content.likes.length,
          users: content.likes.map(like => like.username),
        },
        smeVerify: content.smeVerify === 'Accepted',
        contentId: content._id,
        comments: content.comments, // Include comments here
      })),
    };

    res.status(200).json(formattedUser);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

  // Function to follow a user
  exports.followUser = async (req, res) => {
      try {
        // Get the target user's user ID from the request parameters
        const targetUserId = req.params.userId; // Updated to use user ID
    
        // Get the logged-in user's user ID from the JWT token
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key
        const followerUserId = decoded.userId;
    
        // Check if the user is trying to follow themselves
        if (followerUserId === targetUserId) {
          return res.status(400).json({ message: "You can't follow yourself" });
        }
    
        // Find the target user by their user ID
        const targetUser = await User.findById(targetUserId);
    
        if (!targetUser) {
          return res.status(404).json({ message: 'Target user not found' });
        }
    
        // Find the logged-in user by their user ID
        const user = await User.findById(followerUserId);
    
        // Check if the user is already following the target user
        if (user.following.includes(targetUser.username)) {
          return res.status(400).json({ message: 'You are already following this user' });
        }
    
        // Update the logged-in user's following list and count
        user.following.push(targetUser.username);
        user.followingCount += 1;
        await user.save();
    
        // Update the target user's followers list and count
        targetUser.followers.push(user.username);
        targetUser.followersCount += 1;
        await targetUser.save();
    
       // createNotification(followerUserId, targetUserId, 'follow',null);
        res.status(200).json({ message: 'You are now following this user' });
      } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    };
    
  // Function to unfollow a user
  exports.unfollowUser = async (req, res) => {
    try {
      // Get the target user's user ID from the request parameters
      const targetUserId = req.params.userId; // Updated to use user ID
  
      // Get the logged-in user's user ID from the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key
      const followerUserId = decoded.userId;
  
      // Check if the user is trying to unfollow themselves
      if (followerUserId === targetUserId) {
        return res.status(400).json({ message: "You can't unfollow yourself" });
      }
  
      // Find the target user by their user ID
      const targetUser = await User.findById(targetUserId);
  
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }
  
      // Find the logged-in user by their user ID
      const user = await User.findById(followerUserId);
  
      // Check if the user is following the target user
      if (!user.following.includes(targetUser.username)) {
        return res.status(400).json({ message: "You are not following this user" });
      }
  
      // Remove the target user from the logged-in user's following list and update count
      user.following = user.following.filter((username) => username !== targetUser.username);
      user.followingCount -= 1;
      await user.save();
  
      // Remove the logged-in user from the target user's followers list and update count
      targetUser.followers = targetUser.followers.filter((username) => username !== user.username);
      targetUser.followersCount -= 1;
      await targetUser.save();
  
      res.status(200).json({ message: 'You have unfollowed this user' });
    } catch (error) {
      console.error('Error unfollowing user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  exports.getFollowUnfollowList = async (req, res) => {
    try {
      // Check if a valid JWT token is present in the request headers
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key
  
      // Get the user's ID from the decoded token
      const userId = decoded.userId;
  
      // Find the logged-in user by their ID
      const loggedInUser = await User.findById(userId);
  
      if (!loggedInUser) {
        return res.status(404).json({ error: 'Logged-in user not found' });
      }
  
      // Get the list of users who are following the logged-in user
      const followerList = await User.find({ following: loggedInUser.username }).select(
        'username firstname lastname profilePicture role'
      );
  
      // Get the list of users that the logged-in user is following
      const followingList = await User.find({ username: { $in: loggedInUser.following } }).select(
        'username firstname lastname profilePicture role'
      );
  
      res.status(200).json({ followerList, followingList });
    } catch (error) {
      console.error('Error getting follow/unfollow list:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  