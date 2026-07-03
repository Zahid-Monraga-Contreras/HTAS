const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citas.controller');

router.get('/todas-las-citas', citasController.getAllCitas);
router.post('/agendar-cita', citasController.agendarCita);
router.get('/mis-citas/:email', citasController.getCitasUsuario);
router.put('/actualizar-cita/:idCita', citasController.actualizarEstadoCita);

module.exports = router;