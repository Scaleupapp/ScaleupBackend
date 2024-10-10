// utils/getActivityLogModel.js
const mongoose = require('mongoose');
const activityLogSchema = require('../models/activityLogModel');

const getActivityLogModel = (monthYear) => {
  const modelName = `ActivityLog_${monthYear}`;
  
  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }

  return mongoose.model(modelName, activityLogSchema.schema);
};

module.exports = getActivityLogModel;
