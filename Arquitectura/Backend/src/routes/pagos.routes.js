const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');

router.post('/create-checkout-session', pagosController.createCheckoutSession);

module.exports = router;