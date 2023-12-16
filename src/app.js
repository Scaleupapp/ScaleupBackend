const express = require("express");
const mongoose = require("mongoose");
const app = express();
const aws = require("aws-sdk");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken"); // Import JWT module
const userRoute = require("./routes/userRoute"); // Import userRoute
const authRoute = require("./routes/authRoute");
const contentRoute = require("./routes/contentRoutes");
const cors = require("cors");
const twilio = require("twilio");
const chatRouter = require("./routes/chatRoute");
const conversationRouter = require("./routes/conversationRoute");
const Sentry = require("@sentry/node");
require("dotenv").config();

const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const awsRegion = process.env.AWS_REGION;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const mongodbUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;

const PORT = process.env.PORT || 3000;

// Configure AWS SDK with your credentials
aws.config.update({
  accessKeyId: awsAccessKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: awsRegion,
});

const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
Sentry.init({
  dsn: "https://70a3fa133c98e18ff07f83ec9eb6e281@o4506403653222400.ingest.sentry.io/4506404787781632",
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
    
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

app.use(bodyParser.json());
app.use(cors());
app.use((err, req, res, next) => {
  Sentry.captureException(err);
  res.status(500).json({ message: "Something went wrong." });
});


app.set("view engine", "ejs");

// Connect to your MongoDB database
mongoose
  .connect(mongodbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB: " + error);
  });

// Define your routes and middleware
app.use("/api/auth", authRoute); // Use the auth route
app.use("/api/users", userRoute); // Use the user route
app.use("/api/content", contentRoute);
app.use("/api/chat", chatRouter);
app.use("/api/conversation", conversationRouter);
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
