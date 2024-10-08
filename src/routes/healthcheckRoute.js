const express = require('express');
const healthcheckContoller = require("../controllers/healthcheckController");
const router = express.Router();

router.get('/', healthcheckContoller.healthcheck);

module.exports = router;