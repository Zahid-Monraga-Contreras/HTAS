const express = require('express');
const router = express.Router();
const medicamentosController = require('../controllers/medicamentos.controller');

// Rutas existentes
router.get('/medicamentos', medicamentosController.getMedicamentos);
router.post('/medicamentos', medicamentosController.crearMedicamento);
router.put('/medicamentos/:id', medicamentosController.actualizarMedicamento);
router.delete('/medicamentos/:id', medicamentosController.eliminarMedicamento);

// ✅ NUEVA RUTA: Estadísticas del medicamento
router.get('/medicamento/:idMedicamento/estadisticas', medicamentosController.getEstadisticasMedicamento);

module.exports = router;