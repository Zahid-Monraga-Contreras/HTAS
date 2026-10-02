const express = require('express');
const router = express.Router();
const tomasController = require('../controllers/tomas.controller');

// ==========================================================================
// RUTAS DE TOMAS
// ==========================================================================

// Obtener todas las tomas de un tratamiento
/**
 * @swagger
 * /api/tomas/tratamiento/{idTratamiento}:
 *   get:
 *     summary: Endpoint for GET /tratamiento/:idTratamiento
 *     tags: [Tomas]
 *     parameters:
 *       - in: path
 *         name: idTratamiento
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/tratamiento/:idTratamiento', tomasController.getTomasByTratamiento);

// Obtener estadísticas de tomas de un tratamiento
/**
 * @swagger
 * /api/tomas/tratamiento/{idTratamiento}/estadisticas:
 *   get:
 *     summary: Endpoint for GET /tratamiento/:idTratamiento/estadisticas
 *     tags: [Tomas]
 *     parameters:
 *       - in: path
 *         name: idTratamiento
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/tratamiento/:idTratamiento/estadisticas', tomasController.getEstadisticasTomas);

// Registrar una nueva toma
/**
 * @swagger
 * /api/tomas/:
 *   post:
 *     summary: Endpoint for POST /
 *     tags: [Tomas]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/', tomasController.registrarToma);

// Generar tomas programadas automáticamente
/**
 * @swagger
 * /api/tomas/generar:
 *   post:
 *     summary: Endpoint for POST /generar
 *     tags: [Tomas]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/generar', tomasController.generarTomasProgramadas);

// Actualizar estado de una toma
/**
 * @swagger
 * /api/tomas/{id}:
 *   put:
 *     summary: Endpoint for PUT /:id
 *     tags: [Tomas]
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
router.put('/:id', tomasController.actualizarEstadoToma);

// Eliminar una toma
/**
 * @swagger
 * /api/tomas/{id}:
 *   delete:
 *     summary: Endpoint for DELETE /:id
 *     tags: [Tomas]
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
router.delete('/:id', tomasController.eliminarToma);

// NUEVA RUTA: Eliminar todas las tomas de un tratamiento
/**
 * @swagger
 * /api/tomas/tratamiento/{idTratamiento}/todas:
 *   delete:
 *     summary: Endpoint for DELETE /tratamiento/:idTratamiento/todas
 *     tags: [Tomas]
 *     parameters:
 *       - in: path
 *         name: idTratamiento
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.delete('/tratamiento/:idTratamiento/todas', tomasController.eliminarTodasTomas);

module.exports = router;