const express = require('express');
const router = express.Router();
const contactoController = require('../controllers/contacto.controller');

/**
 * @swagger
 * /api/contacto/:
 *   post:
 *     summary: Endpoint for POST /
 *     tags: [Contacto]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/', contactoController.enviarMensaje);

module.exports = router;