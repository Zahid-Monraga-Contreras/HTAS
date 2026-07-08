const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citas.controller');

// Rutas existentes
router.get('/todas-las-citas', citasController.getAllCitas);
router.post('/agendar-cita', citasController.agendarCita);
router.get('/mis-citas/:email', citasController.getCitasUsuario);
router.put('/actualizar-cita/:idCita', citasController.actualizarEstadoCita);

// ✅ NUEVA RUTA: Actualizar cita completa
router.put('/cita/:idCita', citasController.actualizarCita);

// ✅ NUEVAS RUTAS: Obtener cita por ID y otras funcionalidades
router.get('/cita/:idCita', citasController.getCitaById);
router.get('/citas/fecha/:fecha', citasController.getCitasByFecha);
router.get('/citas/hoy', citasController.getCitasHoy);
router.patch('/cita/:idCita/cancelar', citasController.cancelarCita);
router.delete('/cita/:idCita', citasController.eliminarCita);
router.get('/citas/estadisticas', citasController.getEstadisticasCitas);

module.exports = router;