const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transactionId: { type: String, required: true }, // Razorpay transaction id
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  orderId: { type: String, required: true }, // Razorpay order id
  paymentId: { type: String }, // Razorpay payment id (captured after payment)
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, required: true }, // E.g., 'created', 'captured', 'failed'
  type: { 
    type: String, 
    enum: ['Add Money', 'Withdraw', 'Quiz Payment', 'Quiz Entry Fee', 'Quiz Winnings'], 
    required: true 
  },
  method: { type: String }, // Razorpay payment method (e.g., 'card', 'netbanking')
  description: { type: String }, // Description of the transaction
  paymentGatewayResponse: { type: Object }, // Store full Razorpay response data
  createdAt: { type: Date, default: Date.now },
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
