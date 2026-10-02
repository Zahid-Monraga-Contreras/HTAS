const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');

/**
 * @swagger
 * /api/pagos/create-checkout-session:
 *   post:
 *     summary: Endpoint for POST /create-checkout-session
 *     tags: [Pagos]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/create-checkout-session', pagosController.createCheckoutSession);

module.exports = router;