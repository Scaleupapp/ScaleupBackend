const express = require("express");
const chatModel = require("../models/chatModel");
const chatRouter = express.Router();

//createChat
chatRouter.post("/sendMsg", async (req, res) => {
  const input = req.body;
  const out = await chatModel.create(input);
  console.log(out,'outt');
});

module.exports=chatRouter