const express = require('express');
const router = express.Router();
const googleFitController = require('../controllers/googlefit.controller');

/**
 * @swagger
 * /api/googlefit/google-fit/auth:
 *   get:
 *     summary: Endpoint for GET /google-fit/auth
 *     tags: [Googlefit]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/google-fit/auth', googleFitController.googleFitAuth);
/**
 * @swagger
 * /api/googlefit/google-fit/callback:
 *   get:
 *     summary: Endpoint for GET /google-fit/callback
 *     tags: [Googlefit]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/google-fit/callback', googleFitController.googleFitCallback);
/**
 * @swagger
 * /api/googlefit/google-fit/data/{idPaciente}:
 *   get:
 *     summary: Endpoint for GET /google-fit/data/:idPaciente
 *     tags: [Googlefit]
 *     parameters:
 *       - in: path
 *         name: idPaciente
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/google-fit/data/:idPaciente', googleFitController.googleFitData);

module.exports = router;