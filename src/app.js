const express = require("express");
const mongoose = require("mongoose");
const app = express();
const http = require("http");
const socketIo = require("socket.io");
const aws = require("aws-sdk");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const userRoute = require("./routes/userRoute");
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
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

app.use(bodyParser.json());
app.use(cors());
app.use((err, req, res, next) => {
  Sentry.captureException(err);
  res.status(500).json({ message: "Something went wrong." });
});

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

app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/content", contentRoute);
app.use("/api/chat", chatRouter);
app.use("/api/conversation", conversationRouter);

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow any origin for simplicity. You can restrict this to specific origins as needed.
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`User joined conversation: ${conversationId}`);
  });

  socket.on("sendMessage", (data) => {
    const { conversationId, message, token } = data;
    const decoded = jwt.verify(token, jwtSecret);
    const sender = decoded.userId;

    // Emit to the conversation room
    io.to(conversationId).emit("receiveMessage", {
      conversationId,
      message,
      sender,
    });

    // Save the message in the database
    const newMessage = new Message({
      conversationId,
      sender,
      message,
    });

    newMessage.save().catch((error) => console.error("Error saving message:", error));
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const chatController = require("./controllers/chatController");
chatController.setSocketIo(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
