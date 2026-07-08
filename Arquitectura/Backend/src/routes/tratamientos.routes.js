const express = require('express');
const router = express.Router();
const tratamientosController = require('../controllers/tratamientos.controller');

router.get('/tratamientos', tratamientosController.getTratamientos);
router.post('/tratamientos', tratamientosController.crearTratamiento);
router.put('/tratamientos/:id', tratamientosController.actualizarTratamiento);
router.delete('/tratamientos/:id', tratamientosController.eliminarTratamiento);

// ✅ NUEVA RUTA: Tratamientos por medicamento
router.get('/medicamento/:idMedicamento', tratamientosController.getTratamientosByMedicamento);

module.exports = router;