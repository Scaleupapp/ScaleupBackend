// utils/activityLogger.js
const activityQueue = require('./activityQueue');

const logActivity = (userId, activityType, activityDescription) => {
 // console.log(`Adding activity to queue: ${activityType} for user ${userId}`);
  activityQueue.add({ userId, activityType, activityDescription }, {
    attempts: 3,
    removeOnComplete: false,
    removeOnFail: false,
  }).then(() => {
   // console.log(`Activity successfully added to queue: ${activityType} for user ${userId}`);
  }).catch((error) => {
    console.error("Error adding activity to queue:", error);
  });
};

module.exports = logActivity;
