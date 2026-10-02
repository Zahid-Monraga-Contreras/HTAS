const express = require('express');
const router = express.Router();
const medicamentosController = require('../controllers/medicamentos.controller');

// Rutas existentes
/**
 * @swagger
 * /api/medicamentos/medicamentos:
 *   get:
 *     summary: Endpoint for GET /medicamentos
 *     tags: [Medicamentos]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/medicamentos', medicamentosController.getMedicamentos);
/**
 * @swagger
 * /api/medicamentos/medicamentos:
 *   post:
 *     summary: Endpoint for POST /medicamentos
 *     tags: [Medicamentos]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/medicamentos', medicamentosController.crearMedicamento);
/**
 * @swagger
 * /api/medicamentos/medicamentos/{id}:
 *   put:
 *     summary: Endpoint for PUT /medicamentos/:id
 *     tags: [Medicamentos]
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
router.put('/medicamentos/:id', medicamentosController.actualizarMedicamento);
/**
 * @swagger
 * /api/medicamentos/medicamentos/{id}:
 *   delete:
 *     summary: Endpoint for DELETE /medicamentos/:id
 *     tags: [Medicamentos]
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
router.delete('/medicamentos/:id', medicamentosController.eliminarMedicamento);

/**
 * @swagger
 * /api/medicamentos/medicamento/{id}:
 *   get:
 *     summary: Endpoint for GET /medicamento/:id
 *     tags: [Medicamentos]
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
router.get('/medicamento/:id', medicamentosController.getMedicamentoById);
/**
 * @swagger
 * /api/medicamentos/medicamento/{idMedicamento}/estadisticas:
 *   get:
 *     summary: Endpoint for GET /medicamento/:idMedicamento/estadisticas
 *     tags: [Medicamentos]
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
router.get('/medicamento/:idMedicamento/estadisticas', medicamentosController.getEstadisticasMedicamento);

module.exports = router;