const express = require('express');
const router = express.Router();
const dispositivosController = require('../controllers/dispositivos.controller');

/**
 * @swagger
 * /api/dispositivos/dispositivos:
 *   get:
 *     summary: Endpoint for GET /dispositivos
 *     tags: [Dispositivos]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/dispositivos', dispositivosController.getDispositivos);
/**
 * @swagger
 * /api/dispositivos/dispositivos/paciente/{idPaciente}/dispositivos:
 *   get:
 *     summary: Endpoint for GET /dispositivos/paciente/:idPaciente/dispositivos
 *     tags: [Dispositivos]
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
router.get('/dispositivos/paciente/:idPaciente/dispositivos', dispositivosController.getDispositivosByPaciente);
/**
 * @swagger
 * /api/dispositivos/dispositivos:
 *   post:
 *     summary: Endpoint for POST /dispositivos
 *     tags: [Dispositivos]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/dispositivos', dispositivosController.crearDispositivo);
/**
 * @swagger
 * /api/dispositivos/dispositivos/{id}:
 *   put:
 *     summary: Endpoint for PUT /dispositivos/:id
 *     tags: [Dispositivos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.put('/dispositivos/:id', dispositivosController.actualizarDispositivo);
/**
 * @swagger
 * /api/dispositivos/dispositivos/{id}:
 *   delete:
 *     summary: Endpoint for DELETE /dispositivos/:id
 *     tags: [Dispositivos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.delete('/dispositivos/:id', dispositivosController.eliminarDispositivo);

module.exports = router;