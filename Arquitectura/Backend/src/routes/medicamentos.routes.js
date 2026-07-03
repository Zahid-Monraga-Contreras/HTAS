const express = require('express');
const router = express.Router();
const medicamentosController = require('../controllers/medicamentos.controller');

router.get('/medicamentos', medicamentosController.getMedicamentos);
router.post('/medicamentos', medicamentosController.crearMedicamento);
router.put('/medicamentos/:id', medicamentosController.actualizarMedicamento);
router.delete('/medicamentos/:id', medicamentosController.eliminarMedicamento);

module.exports = router;