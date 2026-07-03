const express = require('express');
const router = express.Router();
const medicionesController = require('../controllers/mediciones.controller');

router.post('/mediciones', medicionesController.registrarMedicion);
router.get('/mediciones/paciente/:idPaciente', medicionesController.getMedicionesPaciente);
router.get('/mediciones/paciente/:idPaciente/ultima', medicionesController.getUltimaMedicionPaciente);

module.exports = router;