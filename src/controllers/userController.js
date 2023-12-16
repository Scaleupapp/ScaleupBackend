const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');
const Sentry = require('@sentry/node');

require('dotenv').config();

const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const awsRegion = process.env.AWS_REGION;
const jwtSecret = process.env.JWT_SECRET;

// Configure AWS SDK with your credentials
aws.config.update({
  accessKeyId:awsAccessKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: awsRegion,
});
const s3 = new aws.S3();

// Update the user's profile
const updateProfile = async (req, res) => {
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

    // Access the uploaded profile picture data
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Define the AWS S3 parameters for uploading
    const params = {
      Bucket: 'scaleupbucket',
      Key: `${userId}/profile-picture.jpg`,
      Body: file.buffer,
      ACL: 'public-read', // Make uploaded file publicly accessible
      ContentType: file.mimetype,
    };

    // Upload the file to AWS S3
    s3.upload(params, async (err, data) => {
      if (err) {
        console.error('S3 upload error:', err);
        return res.status(500).json({ message: 'Failed to upload profile picture' });
      }

      // Update the user's profile information with the S3 file URL
      user.profilePicture = data.Location;
      user.location = req.body.location || user.location;
      user.dateOfBirth = req.body.dateOfBirth || user.dateOfBirth;
      user.bio.bioAbout = req.body.bioAbout || user.bioAbout;
      if (req.body.bioInterests) {
        user.bio.bioInterests = req.body.bioInterests.split(',').map((interest) => interest.trim());
      } else {
        user.bio.bioInterests = [];
      }

      // Save the updated user data
      await user.save();

      // Return a success message
      res.json({ message: 'Profile updated successfully' });
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Delete education information
const deleteEducation = async (req, res) => {
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

    // Find the education entry by its ID
    const educationId = req.params.educationId;
    const educationEntryIndex = user.education.findIndex((edu) => edu._id == educationId);

    if (educationEntryIndex === -1) {
      return res.status(404).json({ message: 'Education entry not found' });
    }

    // Remove the education entry from the user's education array
    user.education.splice(educationEntryIndex, 1);

    // Save the updated user data
    await user.save();

    res.json({ message: 'Education information deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting education information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteWorkExperience = async (req, res) => {
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

    // Find the work experience entry by its ID
    const workExperienceId = req.params.workExperienceId;
    const workExperienceIndex = user.workExperience.findIndex(
      (workExp) => workExp._id.toString() === workExperienceId
    );

    if (workExperienceIndex === -1) {
      return res.status(404).json({ message: 'Work experience entry not found' });
    }

    // Remove the work experience entry
    user.workExperience.splice(workExperienceIndex, 1);

    // Save the updated user data
    await user.save();

    res.json({ message: 'Work experience information deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting work experience information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteCourse = async (req, res) => {
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

    // Find the course entry by its ID
    const courseId = req.params.courseId;
    const courseIndex = user.courses.findIndex((course) => course._id.toString() === courseId);

    if (courseIndex === -1) {
      return res.status(404).json({ message: 'Course entry not found' });
    }

    // Remove the course entry
    user.courses.splice(courseIndex, 1);

    // Save the updated user data
    await user.save();

    res.json({ message: 'Course information deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting course information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteCertification = async (req, res) => {
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

    // Find the certification entry by its ID
    const certificationId = req.params.certificationId;
    const certificationIndex = user.certifications.findIndex((certification) => certification._id.toString() === certificationId);

    if (certificationIndex === -1) {
      return res.status(404).json({ message: 'Certification entry not found' });
    }

    // Remove the certification entry
    user.certifications.splice(certificationIndex, 1);

    // Save the updated user data
    await user.save();

    res.json({ message: 'Certification information deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting certification information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const blockUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    
// Verify the user's identity using the JWT token
const token = req.headers.authorization.split(' ')[1];
const decoded = jwt.verify(token, jwtSecret); // Replace with your actual secret key

// Get the user's ID from the decoded token
const userId = decoded.userId;

// Find the user by ID in the database
const user = await User.findById(userId);
const targetUser = await User.findById(targetUserId);

if (!user) {
  return res.status(404).json({ message: 'User not found' });
}


    // Add the target user to the logged-in user's blockedUsers array
    await User.findByIdAndUpdate(userId, { $addToSet: { blockedUsers: targetUserId } });
  if(user.following.includes(targetUser.username)){
    // Remove the target user from the logged-in user's followers and following lists
    await User.findByIdAndUpdate(userId, { $pull: { following: targetUser.username } });
    await User.findByIdAndUpdate(targetUserId, { $pull: { followers: user.username } });

    // Recalculate the followers and following counts for both users
    await User.findByIdAndUpdate(userId, { $inc: { followingCount: -1} });
    await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });

  }
  if( targetUser.following.includes(user.username)){
    await User.findByIdAndUpdate(userId, { $pull: { followers: targetUser.username } });
    await User.findByIdAndUpdate(targetUserId, { $pull: { following: user.username } });
    await User.findByIdAndUpdate(userId, { $inc: { followersCount: -1} });
    await User.findByIdAndUpdate(targetUserId, { $inc: { followingCount: -1 } });

  }

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBlockedUsers = async (req, res) => {
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

    // Get the list of blocked user IDs
    const blockedUserIds = user.blockedUsers || [];

    // Fetch the blocked users' details
    const blockedUsers = await User.find({ _id: { $in: blockedUserIds } })
      .select('profilePicture username'); 

    res.status(200).json(blockedUsers);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching blocked users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const unblockUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;

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

    // Remove the target user from the logged-in user's blockedUsers array
    await User.findByIdAndUpdate(userId, { $pull: { blockedUsers: targetUserId } });

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


module.exports = {
  updateProfile,
  deleteEducation,
  deleteWorkExperience,
  deleteCourse,
  deleteCertification,
  blockUser,
  unblockUser,
  getBlockedUsers,
};
