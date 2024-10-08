//controllers/healthcheckController.js
const mongoose = require("mongoose");

exports.healthcheck = async (req, res) => {
    const health = {
        uptime: process.uptime(),
        message: 'OK',
        mongoDbConnected : false,
        timestamp: Date.now()
    };

    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
        health.mongoDbConnected = true;
    } else {
        health.mongoDbConnected = false;
    }

    try {
        res.status(200).send(health);
    } catch (err) {
        health.message = error;
        res.status(503).send();
    }
};

