const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const socketIo = require("socket.io");
const aws = require("aws-sdk");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const Sentry = require("@sentry/node");
const multer = require("multer");

const userRoute = require("./routes/userRoute");
const authRoute = require("./routes/authRoute");
const contentRoute = require("./routes/contentRoutes");
const chatRoute = require("./routes/chatRoute");
const conversationRoute = require("./routes/conversationRoute");
const studyGroupController = require("./controllers/studyGroupController");
const chatController = require("./controllers/chatController");

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow any origin for simplicity. You can restrict this to specific origins as needed.
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;
const mongodbUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;

// AWS S3 Configuration
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://70a3fa133c98e18ff07f83ec9eb6e281@o4506403653222400.ingest.sentry.io/4506404787781632",
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

// Middleware setup
app.use(bodyParser.json());
app.use(cors());
app.use(Sentry.Handlers.errorHandler());

// MongoDB Connection
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

// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Routes setup
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/content", contentRoute);
app.use("/api/chat", chatRoute);
app.use("/api/conversation", conversationRoute);

// Socket.IO setup for real-time messaging
io.on("connection", (socket) => {
  console.log("New client connected");

  // Handle joining a one-to-one conversation
  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`User joined conversation: ${conversationId}`);
  });

  // Handle joining a study group
  socket.on("joinGroup", (groupId) => {
    socket.join(groupId);
    console.log(`User joined group: ${groupId}`);
  });

  // Handle sending messages (for both one-to-one and group chats)
  socket.on("sendMessage", async (data) => {
    const { conversationId, groupId, message, token } = data;
    const decoded = jwt.verify(token, jwtSecret);
    const sender = decoded.userId;

    if (conversationId) {
      // Handle one-to-one chat message
      io.to(conversationId).emit("receiveMessage", {
        conversationId,
        message,
        sender,
      });

      // Save the message in the database
      const newMessage = new chatController.Message({
        conversationId,
        sender,
        content: message,
      });

      await newMessage.save().catch((error) =>
        console.error("Error saving message:", error)
      );
    } else if (groupId) {
      // Handle group chat message
      io.to(groupId).emit("receiveMessage", {
        groupId,
        message,
        sender,
      });

      // Save the message in the group collection
      const group = await studyGroupController.StudyGroup.findById(groupId);
      if (group) {
        group.messages.push({
          sender,
          content: message,
        });
        await group.save().catch((error) =>
          console.error("Error saving group message:", error)
        );
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Expose the Socket.IO instance to controllers
chatController.setSocketIo(io);
studyGroupController.setSocketIo(io);  

// Error handling
app.use((err, req, res, next) => {
  Sentry.captureException(err);
  res.status(500).json({ message: "Something went wrong." });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
