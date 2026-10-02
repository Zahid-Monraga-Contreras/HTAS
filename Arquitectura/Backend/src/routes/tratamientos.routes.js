const express = require('express');
const router = express.Router();
const tratamientosController = require('../controllers/tratamientos.controller');

// Listado general y estadísticas
/**
 * @swagger
 * /api/tratamientos/tratamientos:
 *   get:
 *     summary: Endpoint for GET /tratamientos
 *     tags: [Tratamientos]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/tratamientos', tratamientosController.getTratamientos);
/**
 * @swagger
 * /api/tratamientos/estadisticas-tratamientos:
 *   get:
 *     summary: Endpoint for GET /estadisticas-tratamientos
 *     tags: [Tratamientos]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/estadisticas-tratamientos', tratamientosController.getEstadisticasTratamientos);

// CRUD por id de tratamiento
/**
 * @swagger
 * /api/tratamientos/tratamiento/{id}:
 *   get:
 *     summary: Endpoint for GET /tratamiento/:id
 *     tags: [Tratamientos]
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
router.get('/tratamiento/:id', tratamientosController.getTratamientoById);
/**
 * @swagger
 * /api/tratamientos/tratamientos:
 *   post:
 *     summary: Endpoint for POST /tratamientos
 *     tags: [Tratamientos]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/tratamientos', tratamientosController.crearTratamiento);
/**
 * @swagger
 * /api/tratamientos/tratamientos/{id}:
 *   put:
 *     summary: Endpoint for PUT /tratamientos/:id
 *     tags: [Tratamientos]
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
router.put('/tratamientos/:id', tratamientosController.actualizarTratamiento);
/**
 * @swagger
 * /api/tratamientos/tratamiento/{id}/estado:
 *   patch:
 *     summary: Endpoint for PATCH /tratamiento/:id/estado
 *     tags: [Tratamientos]
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
router.patch('/tratamiento/:id/estado', tratamientosController.toggleEstadoTratamiento);
/**
 * @swagger
 * /api/tratamientos/tratamientos/{id}:
 *   delete:
 *     summary: Endpoint for DELETE /tratamientos/:id
 *     tags: [Tratamientos]
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
router.delete('/tratamientos/:id', tratamientosController.eliminarTratamiento);

// Tratamientos por paciente
/**
 * @swagger
 * /api/tratamientos/paciente/{idPaciente}/tratamientos:
 *   get:
 *     summary: Endpoint for GET /paciente/:idPaciente/tratamientos
 *     tags: [Tratamientos]
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
router.get('/paciente/:idPaciente/tratamientos', tratamientosController.getTratamientosByPaciente);
/**
 * @swagger
 * /api/tratamientos/paciente/{idPaciente}/tratamientos/activos:
 *   get:
 *     summary: Endpoint for GET /paciente/:idPaciente/tratamientos/activos
 *     tags: [Tratamientos]
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
router.get('/paciente/:idPaciente/tratamientos/activos', tratamientosController.getTratamientosActivosByPaciente);

// ✅ Tratamientos por medicamento
/**
 * @swagger
 * /api/tratamientos/medicamento/{idMedicamento}:
 *   get:
 *     summary: Endpoint for GET /medicamento/:idMedicamento
 *     tags: [Tratamientos]
 *     parameters:
 *       - in: path
 *         name: idMedicamento
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/medicamento/:idMedicamento', tratamientosController.getTratamientosByMedicamento);

module.exports = router;