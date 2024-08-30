// models/areaOfImprovementModel.js
const mongoose = require('mongoose');

const areaOfImprovementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic: { type: String, required: true },
  count: { type: Number, default: 1 }
});

areaOfImprovementSchema.index({ userId: 1, topic: 1 }, { unique: true });

const AreaOfImprovement = mongoose.model('AreaOfImprovement', areaOfImprovementSchema);

module.exports = AreaOfImprovement;
