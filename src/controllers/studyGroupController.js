const StudyGroup = require('../models/studyGroupModel');
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');
const Sentry = require('@sentry/node');
const { createNotification } = require('./contentController');
const User = require('../models/userModel');
require('dotenv').config();

let io;
 const setSocketIo = (socketIoInstance) => {
  io = socketIoInstance;
};

const jwtSecret = process.env.JWT_SECRET;
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});


// Create a new study group with profile picture upload
const createStudyGroup = async (req, res) => {
    try {
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
  
      // Parse and validate input data
      let { name, description, members = [], admins = [], topics, privacy } = req.body;
  
      // Ensure members and admins are arrays
      if (typeof members === 'string') {
        members = JSON.parse(members);
      }
      if (typeof admins === 'string') {
        admins = JSON.parse(admins);
      }
  
      // Handle topics to ensure it's an array
      if (typeof topics === 'string') {
        topics = JSON.parse(topics);
      } else if (!Array.isArray(topics)) {
        topics = [topics]; // Ensure topics is an array
      }
  
      // Add the current user (who is creating the group) as an admin
      if (!admins.includes(decoded.userId)) {
        admins.push(decoded.userId);
      }
  
      // Ensure the current user is also added as a member
      if (!members.includes(decoded.userId)) {
        members.push(decoded.userId);
      }
  
      const newGroup = new StudyGroup({
        name,
        description,
        members,
        admins,
        topics,
        privacy,
        createdDate: new Date(),
      });
  
      // Handle profile picture upload if provided
      if (req.file) {
        const params = {
          Bucket: 'scaleupbucket',
          Key: `study-groups/${newGroup._id}/profile-picture.jpg`,
          Body: req.file.buffer,
          ACL: 'public-read', // Make uploaded file publicly accessible
          ContentType: req.file.mimetype,
        };
  
        const uploadResult = await s3.upload(params).promise();
        newGroup.profilePicture = uploadResult.Location;
      }
  
      const savedGroup = await newGroup.save();
      res.status(201).json(savedGroup);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error creating study group:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
  
// Update a study group by ID with option to edit profile picture
const updateStudyGroup = async (req, res) => {
    try {
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
  
      let { description, members, admins, topics, privacy } = req.body;
  
      const group = await StudyGroup.findById(req.params.id);
  
      if (!group) {
        return res.status(404).json({ message: 'Study group not found' });
      }
  
      // Ensure the current user is one of the admins
      if (!group.admins.includes(decoded.userId)) {
        return res.status(403).json({ message: 'You are not authorized to update this group.' });
      }
  
      // Ensure members and admins are arrays
      if (typeof members === 'string') {
        members = JSON.parse(members);
      }
      if (typeof admins === 'string') {
        admins = JSON.parse(admins);
      }
  
      // Handle topics to ensure it's an array only if topics are provided
      if (topics) {
        if (typeof topics === 'string') {
          topics = JSON.parse(topics);
        } else if (!Array.isArray(topics)) {
          topics = [topics]; // Ensure topics is an array
        }
        group.topics = topics; // Update topics only if provided
      }
  
      // Update non-name fields only if they are provided
      if (description) group.description = description;
      if (members) group.members = members;
      if (admins) group.admins = admins;
      if (privacy) group.privacy = privacy;
  
      // Handle profile picture upload if provided
      if (req.file) {
        const params = {
          Bucket: 'scaleupbucket',
          Key: `study-groups/${group._id}/profile-picture.jpg`,
          Body: req.file.buffer,
          ACL: 'public-read', // Make uploaded file publicly accessible
          ContentType: req.file.mimetype,
        };
  
        const uploadResult = await s3.upload(params).promise();
        group.profilePicture = uploadResult.Location;
      }
  
      const updatedGroup = await group.save();
      res.status(200).json(updatedGroup);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error updating study group:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  

// Function to get study group details by ID
const getStudyGroupDetailsById = async (req, res) => {
    try {
        // Extract the group ID from the request parameters
        const { id } = req.params;

        // Find the study group by ID and populate the referenced fields
        const group = await StudyGroup.findById(id)
            .populate('members', 'username email') // Populate the members with username and email
            .populate('admins', 'username email') // Populate the admins with username and email
            .populate('joinRequests.userId', 'username email'); // Populate the joinRequests with user details

        // If the group is not found, return a 404 response
        if (!group) {
            return res.status(404).json({ message: 'Study group not found' });
        }

        // Return the group details in the response
        res.status(200).json(group);
    } catch (error) {
        // Capture the error using Sentry and log it
        Sentry.captureException(error);
        console.error('Error fetching study group details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


// Delete a study group by ID
const deleteStudyGroup = async (req, res) => {
    try {
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
  
      const group = await StudyGroup.findById(req.params.id);
  
      if (!group) {
        return res.status(404).json({ message: 'Study group not found' });
      }
  
      // Ensure the current user is one of the admins
      if (!group.admins.includes(decoded.userId)) {
        return res.status(403).json({ message: 'You are not authorized to delete this group.' });
      }
  
      // Delete the study group
      await StudyGroup.deleteOne({ _id: req.params.id });
  
      res.status(200).json({ message: 'Study group deleted successfully' });
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error deleting study group:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
  
  // Get all study groups
  const getAllStudyGroups = async (req, res) => {
    try {
      const groups = await StudyGroup.find().populate('members admins');
      res.status(200).json(groups);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error fetching study groups:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
  const updateMembersInStudyGroup = async (req, res) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
  
      let { addMembers = [], removeMembers = [] } = req.body;
  
      const group = await StudyGroup.findById(req.params.id);
  
      if (!group) {
        return res.status(404).json({ message: 'Study group not found' });
      }
  
      // Ensure the current user is one of the admins
      if (!group.admins.includes(decoded.userId)) {
        return res.status(403).json({ message: 'You are not authorized to update members in this group.' });
      }
  
      // Add new members to the group, only if they are not already members
      addMembers = addMembers.filter(member => !group.members.includes(member));
      group.members = [...new Set([...group.members, ...addMembers])];
  
      // Remove specified members from the group
      group.members = group.members.filter(member => !removeMembers.includes(member.toString()));
  
      const updatedGroup = await group.save();
      res.status(200).json(updatedGroup);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error updating members in study group:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
 // Promote members to admin or demote admins to member in a study group
const updateAdminsInStudyGroup = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);

        const { promoteToAdmins = [], demoteToMembers = [] } = req.body;

        const group = await StudyGroup.findById(req.params.id);

        if (!group) {
            return res.status(404).json({ message: 'Study group not found' });
        }

        // Ensure the current user is one of the admins
        if (!group.admins.includes(decoded.userId)) {
            return res.status(403).json({ message: 'You are not authorized to update admins in this group.' });
        }

        // Promote specified members to admins, but only if they are already members of the group
        const validPromotions = promoteToAdmins.filter(member => group.members.includes(member));
        group.admins = [...new Set([...group.admins, ...validPromotions])];

        // Demote specified admins to regular members, but only if they are currently admins
        const validDemotions = demoteToMembers.filter(admin => group.admins.includes(admin));

        // Ensure demoted admins are still part of the members
        validDemotions.forEach(admin => {
            if (!group.members.includes(admin)) {
                group.members.push(admin);
            }
        });

        // Remove demoted admins from the admins list
        group.admins = group.admins.filter(admin => !validDemotions.includes(admin.toString()));

        const updatedGroup = await group.save();
        res.status(200).json(updatedGroup);
    } catch (error) {
        Sentry.captureException(error);
        console.error('Error updating admins in study group:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const requestToJoinStudyGroup = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        const { groupId } = req.body;
        const userId = decoded.userId;
  
        const group = await StudyGroup.findById(groupId);
  
        if (!group) {
            return res.status(404).json({ message: 'Study group not found' });
        }
  
        if (group.members.includes(userId)) {
            return res.status(400).json({ message: 'You are already a member of this group.' });
        }
  
        const user = await User.findById(userId); // Fetch user details
  
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
  
        if (group.privacy === 'public') {
            group.members.push(userId);
            await group.save();
            return res.status(200).json({ message: 'You have joined the group.' });
        } else {
            const existingRequest = group.joinRequests.find(request => request.userId.toString() === userId);
            if (existingRequest) {
                return res.status(400).json({ message: 'You have already requested to join this group.' });
            }
  
            group.joinRequests.push({ userId });
            await group.save();
  
            for (let adminId of group.admins) {
                await createNotification(
                    adminId,  // recipientId
                    userId,   // senderId
                    'joinRequest',  // type
                    `User ${user.username} has requested to join the group "${group.name}".`,  // content
                    `/groups/${groupId}/requests`  // link
                );
            }
  
            return res.status(200).json({ message: 'Your request to join the group has been sent to the admins.' });
        }
    } catch (error) {
        Sentry.captureException(error);
        console.error('Error requesting to join study group:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


const searchStudyGroups = async (req, res) => {
    try {
      const { query } = req.query;
  
      const searchCriteria = {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { topics: { $regex: query, $options: 'i' } }
        ]
      };
  
      const groups = await StudyGroup.find(searchCriteria)
        .populate('members', 'username email') // Select only username and email from members
        .populate('admins', 'username email') // Select only username and email from admins
        .select('name description topics privacy profilePicture createdDate'); // Select only these fields from StudyGroup
  
      res.status(200).json(groups);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error searching study groups:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  

const handleJoinRequest = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        const { groupId, userId, action } = req.body;

        const group = await StudyGroup.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: 'Study group not found' });
        }

        if (!group.admins.includes(decoded.userId)) {
            return res.status(403).json({ message: 'You are not authorized to manage join requests in this group.' });
        }

        const request = group.joinRequests.find(req => req.userId.toString() === userId);

        if (!request) {
            return res.status(400).json({ message: 'Join request not found.' });
        }

        const requestingUser = await User.findById(userId);  // Fetch user who requested to join
        const adminUser = await User.findById(decoded.userId); // Fetch admin who is handling the request

        if (!requestingUser || !adminUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (action === 'approve') {
            request.status = 'approved';
            group.members.push(userId);
            await group.save();

            await createNotification(
                userId,  // recipientId (user who requested to join)
                decoded.userId,  // senderId (admin handling the request)
                'joinAccepted',  // type
                `Your request to join the group "${group.name}" has been accepted by the Admin.`,  // content
                `/groups/${groupId}`  // link
            );

            return res.status(200).json({ message: 'User has been added to the group.' });
        } else if (action === 'reject') {
            request.status = 'rejected';
            await group.save();

            await createNotification(
                userId,  // recipientId (user who requested to join)
                decoded.userId,  // senderId (admin handling the request)
                'joinRejected',  // type
                `Your request to join the group "${group.name}" has been rejected by the Admin.`,  // content
                `/groups/${groupId}`  // link
            );

            return res.status(200).json({ message: 'Join request has been rejected.' });
        } else {
            return res.status(400).json({ message: 'Invalid action.' });
        }
    } catch (error) {
        Sentry.captureException(error);
        console.error('Error handling join request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const sendGroupMessage = async (req, res) => {
  try {
    const { groupId, message } = req.body;
    const files = req.files; // Assume that the attachments are sent as files
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const senderId = decoded.userId;

    // Fetch the sender's user details to get the username
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ message: 'User not found' });
    }

    const group = await StudyGroup.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Study group not found' });
    }

    if (!group.members.includes(senderId)) {
      return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    // Array to store attachment URLs
    let attachments = [];

    // Upload each file to S3
    if (files && files.length > 0) {
      for (const file of files) {
        const params = {
          Bucket: 'scaleupbucket',
          Key: `study-groups/${groupId}/messages/${Date.now()}_${file.originalname}`,
          Body: file.buffer,
          ACL: 'public-read', // Optional: define the access level
          ContentType: file.mimetype,
        };

        const uploadResult = await s3.upload(params).promise();
        attachments.push(uploadResult.Location); // Save the S3 URL to the attachments array
      }
    }

    const newMessage = {
      sender: senderId,
      content: message,
      attachments,
    };

    group.messages.push(newMessage);
    await group.save();

    // Emit the message to all connected clients in the group
    io.to(groupId).emit("receiveMessage", newMessage);

    // Parse the message content to detect mentions and notify mentioned users
    const mentionedUsernames = message.match(/@(\w+)/g);
    if (mentionedUsernames) {
      for (const mentionedUsername of mentionedUsernames) {
        const username = mentionedUsername.slice(1); // Remove the "@" symbol
        const mentionedUser = await User.findOne({ username });

        if (mentionedUser && mentionedUser._id.toString() !== senderId) {
          const recipientId = mentionedUser._id;
          const type = 'mention';
          const notificationContent = `${sender.username} mentioned you in a group message.`;
          const link = `/api/groups/${groupId}/messages`;

          await createNotification(recipientId, senderId, type, notificationContent, link);
        }
      }
    }

    res.status(200).json({ message: 'Message sent successfully', newMessage });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Retrieving messages from the study group
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await StudyGroup.findById(groupId).populate('messages.sender', 'username profilePicture');

    if (!group) {
      return res.status(404).json({ message: 'Study group not found' });
    }

    // Filter out deleted messages
    const visibleMessages = group.messages.filter(message => !message.deleted);

    res.status(200).json(visibleMessages);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching group messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

  
const addReaction = async (req, res) => {
  try {
      const { groupId, messageId } = req.params;
      const { emoji } = req.body;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId;

      const group = await StudyGroup.findById(groupId);
      if (!group) {
          return res.status(404).json({ message: 'Study group not found' });
      }

      const message = group.messages.id(messageId);
      if (!message) {
          return res.status(404).json({ message: 'Message not found' });
      }

      // Check if the message is deleted
      if (message.deleted) {
          return res.status(403).json({ message: 'Cannot react to a deleted message' });
      }

      // Find if the reaction already exists
      let reaction = message.reactions.find(r => r.emoji === emoji);

      if (reaction) {
          // Add user to the reaction if not already present
          if (!reaction.users.includes(userId)) {
              reaction.users.push(userId);
          }
      } else {
          // Create a new reaction if it doesn't exist
          message.reactions.push({
              emoji,
              users: [userId]
          });
      }

      await group.save();

      // Emit the reaction to all connected clients in the group
      io.to(groupId).emit("reactionAdded", { messageId, emoji, userId });

      res.status(200).json({ message: 'Reaction added successfully', reactions: message.reactions });
  } catch (error) {
      Sentry.captureException(error);
      console.error('Error adding reaction:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};


const editGroupMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const { content } = req.body;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    const group = await StudyGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Study group not found" });
    }

    const message = group.messages.id(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if the message is deleted
    if (message.deleted) {
      return res.status(403).json({ message: "Cannot edit a deleted message" });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized to edit this message" });
    }

    const now = new Date();
    if ((now - message.timestamp) > 10 * 60 * 1000) { // 10 minutes
      return res.status(403).json({ message: "Cannot edit message after 10 minutes" });
    }

    message.content = content;
    message.edited = true;

    await group.save();

    // Emit the edited message to all connected clients in the group
    io.to(groupId).emit("messageEdited", { messageId, content });

    // Parse the content to detect mentions and notify mentioned users
    const mentionedUsernames = content.match(/@(\w+)/g);
    if (mentionedUsernames) {
      for (const mentionedUsername of mentionedUsernames) {
        const username = mentionedUsername.slice(1); // Remove the "@" symbol
        const mentionedUser = await User.findOne({ username });

        if (mentionedUser && mentionedUser._id.toString() !== userId) {
          const recipientId = mentionedUser._id;
          const senderId = decoded.userId;
          const type = 'mention';
          const notificationContent = `${sender.username} mentioned you in a group message.`;
          const link = `/api/groups/${groupId}/messages`;

          await createNotification(recipientId, senderId, type, notificationContent, link);
        }
      }
    }

    res.status(200).json({ message: "Message edited successfully", message });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error editing message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



const deleteGroupMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId;

    const group = await StudyGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Study group not found" });
    }

    const message = group.messages.id(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized to delete this message" });
    }

    const now = new Date();
    if ((now - message.timestamp) > 10 * 60 * 1000) { // 10 minutes
      return res.status(403).json({ message: "Cannot delete message after 10 minutes" });
    }

    message.content = "This message was deleted";
    message.deleted = true;

    await group.save();

    io.to(groupId).emit("messageDeleted", { messageId });

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error deleting message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
  

  module.exports = {
    createStudyGroup,
    updateStudyGroup,
    deleteStudyGroup,
    getAllStudyGroups,
    updateMembersInStudyGroup,
    updateAdminsInStudyGroup,
    requestToJoinStudyGroup,
    searchStudyGroups,
    handleJoinRequest,
    getStudyGroupDetailsById,
    sendGroupMessage,
    getGroupMessages,
    setSocketIo,
    addReaction,
    editGroupMessage,
    deleteGroupMessage
  };