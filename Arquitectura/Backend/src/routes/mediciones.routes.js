const express = require('express');
const router = express.Router();
const medicionesController = require('../controllers/mediciones.controller');

// ✅ RUTAS EXISTENTES
/**
 * @swagger
 * /api/mediciones/:
 *   post:
 *     summary: Endpoint for POST /
 *     tags: [Mediciones]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/', medicionesController.registrarMedicion);
/**
 * @swagger
 * /api/mediciones/paciente/{idPaciente}:
 *   get:
 *     summary: Endpoint for GET /paciente/:idPaciente
 *     tags: [Mediciones]
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
router.get('/paciente/:idPaciente', medicionesController.getMedicionesPaciente);
/**
 * @swagger
 * /api/mediciones/paciente/{idPaciente}/ultima:
 *   get:
 *     summary: Endpoint for GET /paciente/:idPaciente/ultima
 *     tags: [Mediciones]
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
router.get('/paciente/:idPaciente/ultima', medicionesController.getUltimaMedicionPaciente);

// ✅ CORREGIDO: Cambiar a GET porque solo usamos params, no body
/**
 * @swagger
 * /api/mediciones/tensiometro/{idPaciente}:
 *   get:
 *     summary: Endpoint for GET /tensiometro/:idPaciente
 *     tags: [Mediciones]
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
router.get('/tensiometro/:idPaciente', medicionesController.obtenerMedicionTensiometro);

module.exports = router;