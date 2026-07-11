const express = require('express');
const router = express.Router();
const medicionesController = require('../controllers/mediciones.controller');

// ✅ RUTAS EXISTENTES
router.post('/', medicionesController.registrarMedicion);
router.get('/paciente/:idPaciente', medicionesController.getMedicionesPaciente);
router.get('/paciente/:idPaciente/ultima', medicionesController.getUltimaMedicionPaciente);

// ✅ CORREGIDO: Cambiar a GET porque solo usamos params, no body
router.get('/tensiometro/:idPaciente', medicionesController.obtenerMedicionTensiometro);

module.exports = router;