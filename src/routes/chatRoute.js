const express = require("express");
const chatModel = require("../models/chatModel");
const chatRouter = express.Router();

//getConversation
chatRouter.get("/getMsgs", async (req, res) => {
  const { conversationId } = req.query;
  const findChat = await chatModel.find({ conversationId }).lean();
  res.json(findChat);
});
//createChat
chatRouter.post("/sendMsg", async (req, res) => {
  const input = req.body;
  const out = await chatModel.create(input);
  res.json(out);
});

module.exports = chatRouter;
