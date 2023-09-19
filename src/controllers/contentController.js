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
        userId: user._id // Link the content to the user who created it
      });

      await newContent.save();

      return res.status(200).json({ message: 'Content added successfully' });
    });
  } catch (error) {
    console.error('Content creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
