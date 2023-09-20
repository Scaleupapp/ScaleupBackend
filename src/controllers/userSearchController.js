const User = require('../models/userModel');
const Content = require('../models/contentModel');
const jwt = require('jsonwebtoken');

// Controller function to search for users based on various criteria
exports.searchUsers = async (req, res) => {
  try {
    // Check if a valid JWT token is present in the request headers
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'scaleupkey'); // Replace with your actual secret key

    // Get the user's ID from the decoded token
    const userId = decoded.userId;

    const { query } = req.body;
    const searchTerms = query.split(',').map(term => term.trim());

    // Build an array of regex patterns for each search term
    const regexPatterns = searchTerms.map(term => new RegExp(term, 'i'));

    // Search users based on multiple fields
    const searchResults = await User.find({
      $or: [
        { username: { $in: regexPatterns } }, // Case-insensitive username search
        { firstname: { $in: regexPatterns } }, // Case-insensitive first name search
        { lastname: { $in: regexPatterns } }, // Case-insensitive last name search
        { location: { $in: regexPatterns } }, // Case-insensitive location search
        { 'bio.bioInterests': { $in: regexPatterns } }, // Case-insensitive interests search
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
  
      // Fetch the user's details
      const user = await User.findById(userId).select(
        'profilePicture username firstname lastname email phoneNumber bio.bioInterests education workExperience courses certifications badges dateOfBirth location bio.bioAbout followersCount followingCount role'
      );
  
      // Fetch the user's associated content
      const userContent = await Content.find({ userId }).select(
        'heading captions contentURL hashtags relatedTopics postdate likes comments smeVerify _id'
      )
      .populate('likes', 'username') ;// Populate the usernames of users who liked the content
     // .populate('comments', 'text date userId'); // Populate comments with text, date, and user IDs
        
     const totalPosts = await Content.countDocuments({ userId: user._id });
      // Format the user details
      const formattedUser = {
        profilePicture: user.profilePicture,
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
        followingCount: user.followingCount,
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
          //comments: content.comments.map(comment => ({
           // text: comment.text,
           // date: comment.date,
           // userId: comment.userId,
         // })),
          smeVerify: content.smeVerify === 'Accepted' ? true : false,
          contentId: content._id,
        })),
      };
  
      res.status(200).json(formattedUser);
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
