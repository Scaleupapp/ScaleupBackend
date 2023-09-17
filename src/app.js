// src/app.js
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const aws = require('aws-sdk');
const PORT = process.env.PORT || 3000;

// Configure AWS SDK with your credentials
aws.config.update({
  accessKeyId: 'AKIA4OBHVFBJPGOAQOMZ',
  secretAccessKey: 'KcYQmRdwAF0nskBJguP+1L7wRjiRYnZBFJkH9NV6',
  region: 'ap-southeast-2'
});

app.use(bodyParser.json());

app.set('view engine', 'ejs');

// Connect to your MongoDB database
mongoose
  .connect('mongodb+srv://mongodb:Nirpstuti123@serverlessinstance0.cq2wkt3.mongodb.net/scaleup', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB: ' + error);
  });

// Define your routes and middleware
// Example:
// app.use('/api/users', require('./routes/users'));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
