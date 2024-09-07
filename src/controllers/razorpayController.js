const Razorpay = require('razorpay');
const jwt = require('jsonwebtoken');
const Quiz = require('../models/quizModel');
const Transaction = require('../models/transactionModel');
const User = require('../models/userModel');
require('dotenv').config();
const crypto = require('crypto');
const bodyParser = require('body-parser');

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// Create Razorpay Order with User Authentication
exports.createOrder = async (req, res) => {
  try {
    // Verify the user's identity using the JWT token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Replace with your actual secret key

    // Get the user's ID from the decoded token
    const userId = decoded.userId;

    // Extract quizId and currency from request body
    const { quizId, currency = 'INR', type = 'Quiz Entry Fee' } = req.body; // quizId from the frontend

    // Find the quiz by ID to get the entry fee
    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isPaid) {
      return res.status(404).json({ message: 'Quiz not found or is not a paid quiz' });
    }

    const entryFee = quiz.entryFee;
    const amountInPaisa = entryFee * 100; // Convert amount to paisa (Razorpay works with paisa)

    const options = {
      amount: amountInPaisa,
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    // Create a Razorpay order
    const order = await razorpayInstance.orders.create(options);

    // Save transaction details with 'created' status
    const transaction = new Transaction({
      userId,
      quizId, // Store quizId in the transaction
      transactionId: order.id,
      orderId: order.id,
      amount: entryFee,
      currency: order.currency,
      status: 'created',
      type,
      description: `Payment for quiz entry fee - ${quizId}`,
    });

    await transaction.save();

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      quizId,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

// Handle Razorpay Webhook for successful payment and add user as a participant
exports.handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; 
    const razorpaySignature = req.headers['x-razorpay-signature']; 

    // Verify the webhook signature to ensure it's from Razorpay
    const generatedSignature = crypto.createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const { event, payload } = req.body;

    //console.log('Received Webhook Payload:', req.body);


    if (event === 'payment.captured') {
        const { entity: { order_id, payment_id, amount, status, method } } = payload.payment;
     // console.log(order_id)

      // Find the corresponding transaction
      const transaction = await Transaction.findOne({ orderId: order_id });
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      // Ensure the payment status is captured
      if (transaction.status === 'captured') {
        return res.status(400).json({ message: 'Payment already captured' });
      }

      // Update transaction with payment details
      transaction.paymentId = payment_id;
      transaction.status = status;
      transaction.method = method;
      transaction.paymentGatewayResponse = payload.payment;

      await transaction.save();

      // Retrieve quizId and userId from the transaction (ensure these were saved during order creation)
      const { quizId, userId } = transaction;
     // console.log(quizId);
      // Add the user as a participant in the quiz, if not already added
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }

      // Check if the user is already a participant
      const isParticipant = quiz.participants.some(participant => participant.userId.toString() === userId);
      if (isParticipant) {
        return res.status(400).json({ message: 'User already a participant' });
      }

      // Add the user as a participant in the quiz
      quiz.participants.push({ userId, hasPaid: true, hasJoined: false });
    //  quiz.prizePool += quiz.entryFee;
      await quiz.save();

      res.status(200).json({ message: 'Payment captured and user added to the quiz successfully' });
    } else {
      res.status(400).json({ message: 'Unhandled event type' });
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook error' });
  }
};


