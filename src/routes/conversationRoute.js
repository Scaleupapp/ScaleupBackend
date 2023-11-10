const express = require("express");
const conversationModel = require("../models/conversationModel");

const conversationRouter = express.Router();
//findConversation
conversationRouter.get("/getConversation", async (req, res) => {
  const { user, reciever } = req.query;
  console.log(user, reciever, "dadad");
  const conversation = await conversationModel
    .findOne({
      members: { $all: [user, reciever] },
    })
    .populate("members");
  res.json(conversation);
});

//createConverstaion
conversationRouter.post("/createConversation", async (req, res) => {
  const input = req.body;
  const conversation = await conversationModel.create(input);
  res.json(conversation);
});

module.exports = conversationRouter;
