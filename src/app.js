const express = require('express');
const mongoose = require('mongoose');
const app = express();
const aws = require('aws-sdk');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken'); // Import JWT module
const userRoute = require('./routes/userRoute'); // Import userRoute
const authRoute = require('./routes/authRoute');

const PORT = process.env.PORT || 3000;

// Configure AWS SDK with your credentials
aws.config.update({
  accessKeyId: 'AKIA4OBHVFBJP4K3I5MX',
  secretAccessKey: 'wYrxeM9CCHQSUwQRtrYEr0wiWPk2KJ7gZI3PLP2R',
  region: 'ap-southeast-2',
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
app.use('/api/auth', authRoute); // Use the auth route
app.use('/api/users', userRoute); // Use the user route

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
