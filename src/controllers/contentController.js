const aws = require('aws-sdk');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const jwt = require('jsonwebtoken'); // Import JWT library

aws.config.update({
    accessKeyId: 'AKIA4OBHVFBJP4K3I5MX',
    secretAccessKey: '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',
    region: 'ap-southeast-2',
  });

const s3 = new aws.S3();

exports.addContent = async (req, res) => {
  try {
    const { captions, hashtags, heading, verify, relatedTopics } = req.body;
    const contentFile = req.file;

    // Verify the user's identity using the JWT token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'scaleupkey'); // Replace with your actual secret key

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
      ContentType: contentFile.mimetype
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
       

      });

      await newContent.save();

      return res.status(200).json({ message: 'Content added successfully' });
    });
  } catch (error) {
    console.error('Content creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.listPendingVerificationContent = async (req, res) => {
    try {
        // Verify the user's identity using the JWT token
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, 'scaleupkey'); // Replace with your actual secret key

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
            .select('username postdate relatedTopics hashtags _id captions heading contentURL rating smeVerify smeComments userId')
            .populate('userId', 'username totalRating'); // Populate user data for content author

        res.json({ pendingContent });
    } catch (error) {
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
        const decoded = jwt.verify(token, 'scaleupkey'); // Replace with your actual secret key

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

            await contentAuthor.save();
        }

        res.json({ message: 'Content rating and verification updated successfully' });
    } catch (error) {
        console.error('Content rating and verification update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Controller function to get content details by content ID
exports.getContentDetails = async (req, res) => {
    try {
      const { contentId } = req.params;
  
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'scaleupkey'); // Replace with your actual secret key
  
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
      };
  
      res.json({ contentDetails });
    } catch (error) {
      console.error('Error getting content details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.getAllContent = async (req, res) => {
    try {
      // Verify the user's identity using the JWT token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'scaleupkey'); // Replace with your actual secret key
  
      // Get the user's ID from the decoded token
      const userId = decoded.userId;
  
      // Find the user by ID in the database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Get the user's bio interests
      const userBioInterests = user.bio.bioInterests;
  
      // Query for content matching bio interests
      const filteredContent = await Content.find({
        $or: [
          { hashtags: { $in: userBioInterests.map(tag => tag.replace('#', '')) } }, // Match hashtags
          { relatedTopics: { $in: userBioInterests } }, // Match related topics
        ],
      })
        .select('username postdate heading hashtags relatedTopics captions contentURL likes comments smeVerify')
        .populate('userId', 'username')
        .sort({ postdate: -1 }); // Sort by posting date in descending order
  
      // Add a "Verified" tag to content with smeVerify = "Accepted"
      const contentWithVerification = filteredContent.map(content => ({
        ...content.toObject(),
        isVerified: content.smeVerify === 'Accepted',
      }));
  
      res.json({ content: contentWithVerification });
    } catch (error) {
      console.error('Error getting filtered content:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

// Controller function to like a content item
exports.likeContent = async (req, res) => {
    try {
      const { contentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'scaleupkey'); // Replace with your actual secret key
      const userId = decoded.userId;
  
      // Find the content by ID and update the likes array
      const content = await Content.findByIdAndUpdate(
        contentId,
        { $addToSet: { likes: userId } }, // Add the user's ID to the likes array (no duplicates)
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
      console.error('Error liking content:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  // Controller function to unlike a content item
  exports.unlikeContent = async (req, res) => {
    try {
      const { contentId } = req.params;
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'scaleupkey'); // Replace with your actual secret key
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
      console.error('Error unliking content:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };