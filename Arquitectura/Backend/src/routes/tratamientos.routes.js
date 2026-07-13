const express = require('express');
const router = express.Router();
const tratamientosController = require('../controllers/tratamientos.controller');

// Listado general y estadísticas
router.get('/tratamientos', tratamientosController.getTratamientos);
router.get('/estadisticas-tratamientos', tratamientosController.getEstadisticasTratamientos);

// CRUD por id de tratamiento
router.get('/tratamiento/:id', tratamientosController.getTratamientoById);
router.post('/tratamientos', tratamientosController.crearTratamiento);
router.put('/tratamientos/:id', tratamientosController.actualizarTratamiento);
router.patch('/tratamiento/:id/estado', tratamientosController.toggleEstadoTratamiento);
router.delete('/tratamientos/:id', tratamientosController.eliminarTratamiento);

// Tratamientos por paciente
router.get('/paciente/:idPaciente/tratamientos', tratamientosController.getTratamientosByPaciente);
router.get('/paciente/:idPaciente/tratamientos/activos', tratamientosController.getTratamientosActivosByPaciente);

// ✅ Tratamientos por medicamento
router.get('/medicamento/:idMedicamento', tratamientosController.getTratamientosByMedicamento);

module.exports = router;