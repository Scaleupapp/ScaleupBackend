const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');
const Sentry = require('@sentry/node');
const logActivity = require('../utils/activityLogger');

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

    const updateUserData = () => {
      user.location = req.body.location || user.location;
      user.dateOfBirth = req.body.dateOfBirth || user.dateOfBirth;
      user.bio.bioAbout = req.body.bioAbout || user.bio.bioAbout;
      if (req.body.bioInterests) {
        user.bio.bioInterests = req.body.bioInterests.split(',').map((interest) => interest.trim());
      } else if (!req.body.bioInterests && user.bio.bioInterests) {
        user.bio.bioInterests = user.bio.bioInterests;
      } else {
        user.bio.bioInterests = [];
      }

      // Save the updated user data
      return user.save();
    };

    // If a file is uploaded, handle S3 upload
    if (file) {
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

        // Update the user's profile picture URL
        user.profilePicture = data.Location;

        // Save user data after S3 upload
        await updateUserData();

        // Return a success message
        res.json({ message: 'Profile updated successfully' });
      });
    } else {
      // No file uploaded, update other user data directly
      await updateUserData();
      res.json({ message: 'Profile updated successfully without new picture' });
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteEducation = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const educationId = req.params.educationId;
    const educationEntryIndex = user.education.findIndex((edu) => edu._id == educationId);

    if (educationEntryIndex === -1) {
      return res.status(404).json({ message: 'Education entry not found' });
    }

    user.education.splice(educationEntryIndex, 1);
    await user.save();

    // Log activity for deleting education
    await logActivity(userId, 'delete_education', `User deleted an education entry`);

    res.json({ message: 'Education information deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting education information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteWorkExperience = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workExperienceId = req.params.workExperienceId;
    const workExperienceIndex = user.workExperience.findIndex(
      (workExp) => workExp._id.toString() === workExperienceId
    );

    if (workExperienceIndex === -1) {
      return res.status(404).json({ message: 'Work experience entry not found' });
    }

    user.workExperience.splice(workExperienceIndex, 1);
    await user.save();

    // Log activity for deleting work experience
    await logActivity(userId, 'delete_work_experience', `User deleted a work experience entry`);

    res.json({ message: 'Work experience information deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting work experience information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const courseId = req.params.courseId;
    const courseIndex = user.courses.findIndex((course) => course._id.toString() === courseId);

    if (courseIndex === -1) {
      return res.status(404).json({ message: 'Course entry not found' });
    }

    user.courses.splice(courseIndex, 1);
    await user.save();

    // Log activity for deleting course
    await logActivity(userId, 'delete_course', `User deleted a course entry`);

    res.json({ message: 'Course information deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting course information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteCertification = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const certificationId = req.params.certificationId;
    const certificationIndex = user.certifications.findIndex((certification) => certification._id.toString() === certificationId);

    if (certificationIndex === -1) {
      return res.status(404).json({ message: 'Certification entry not found' });
    }

    user.certifications.splice(certificationIndex, 1);
    await user.save();

    // Log activity for deleting certification
    await logActivity(userId, 'delete_certification', `User deleted a certification entry`);

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
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Block the user and update followers/following relationships
    await User.findByIdAndUpdate(userId, { $addToSet: { blockedUsers: targetUserId } });
    if (user.following.includes(targetUser.username)) {
      await User.findByIdAndUpdate(userId, { $pull: { following: targetUser.username } });
      await User.findByIdAndUpdate(targetUserId, { $pull: { followers: user.username } });
      await User.findByIdAndUpdate(userId, { $inc: { followingCount: -1 } });
      await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });
    }
    if (targetUser.following.includes(user.username)) {
      await User.findByIdAndUpdate(userId, { $pull: { followers: targetUser.username } });
      await User.findByIdAndUpdate(targetUserId, { $pull: { following: user.username } });
      await User.findByIdAndUpdate(userId, { $inc: { followersCount: -1 } });
      await User.findByIdAndUpdate(targetUserId, { $inc: { followingCount: -1 } });
    }

    // Log activity for blocking user
    await logActivity(userId, 'block_user', `User blocked ${targetUser.username}`);

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

// Save User KYC Details
const saveUserKycDetails = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { accountNumber, ifscCode, accountName, panNumber, aadhaarNumber } = req.body;

    // Validate input
    if (!accountNumber || !ifscCode || !accountName || !panNumber || !aadhaarNumber) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find the user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Encrypt the data
    const encryptedAccountNumber = user.encryptField(accountNumber);
    const encryptedIfscCode = user.encryptField(ifscCode);
    const encryptedAccountName = user.encryptField(accountName);
    const encryptedPanNumber = user.encryptField(panNumber);
    const encryptedAadhaarNumber = user.encryptField(aadhaarNumber);

    // Save encrypted data in the database
    user.bankDetails.accountNumber = encryptedAccountNumber;
    user.bankDetails.ifscCode = encryptedIfscCode;
    user.bankDetails.accountName = encryptedAccountName;
    user.panNumber = encryptedPanNumber;
    user.aadhaarNumber = encryptedAadhaarNumber;

    await user.save();

    // Log activity for saving KYC details
    await logActivity(userId, 'save_kyc_details', `User saved their KYC details`);

    res.status(200).json({ message: 'KYC details saved successfully' });
  } catch (error) {
    console.error('Error saving KYC details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Fetch User KYC Details
const getUserKycDetails = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Decrypt the fields before sending them
    const decryptedAccountNumber = user.decryptField(user.bankDetails.accountNumber);
    const decryptedIfscCode = user.decryptField(user.bankDetails.ifscCode);
    const decryptedAccountName = user.decryptField(user.bankDetails.accountName);
    const decryptedPanNumber = user.decryptField(user.panNumber);
    const decryptedAadhaarNumber = user.decryptField(user.aadhaarNumber);

    res.status(200).json({
      accountNumber: decryptedAccountNumber,
      ifscCode: decryptedIfscCode,
      accountName: decryptedAccountName,
      panNumber: decryptedPanNumber,
      aadhaarNumber: decryptedAadhaarNumber,
    });
  } catch (error) {
    console.error('Error fetching KYC details:', error);
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
  saveUserKycDetails,
  getUserKycDetails
};
