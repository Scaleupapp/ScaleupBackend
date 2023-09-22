const Story = require('../models/storyModel');
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');
const multer = require('multer');

aws.config.update({
    accessKeyId: 'AKIA4OBHVFBJP4K3I5MX',
    secretAccessKey: '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',
    region: 'ap-southeast-2',
  });

const s3 = new aws.S3();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

exports.addStory = upload.single('contentFile'), async (req, res) => {
  try {
    const {  durationInSeconds, contentUrl } = req.body;
    const contentFile = req.file; // Uploaded content file

    // Verify the user's identity using the JWT token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'scaleupkey'); // Replace with your actual secret key

    // Check if the user ID in the token matches the provided user ID
    if (userId !== decoded.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Upload the content file to AWS S3
    const folderKey = `${userId}/stories/`;
    const params = {
      Bucket: 'scaleupbucket',
      Key: `${folderKey}${contentFile.originalname}`,
      Body: contentFile.buffer,
      ContentType: contentFile.mimetype,
    };

    s3.upload(params, async (err, data) => {
      if (err) {
        console.error('S3 upload error:', err);
        return res.status(500).json({ error: 'Failed to upload content' });
      }
      contentUrl = data.Location;

      // Create a new Story document for the story with additional details
      const newStory = new Story({
        userId,
        contentUrl : contentUrl,
        durationInSeconds,
         });

      await newStory.save();

      res.status(201).json({ message: 'Story posted successfully' });
    });
  } catch (error) {
    console.error('Error posting Story:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
