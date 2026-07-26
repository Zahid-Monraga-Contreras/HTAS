const express = require('express');
const router = express.Router();
const tomasController = require('../controllers/tomas.controller');

// ==========================================================================
// RUTAS DE TOMAS
// ==========================================================================

// Obtener todas las tomas de un tratamiento
router.get('/tratamiento/:idTratamiento', tomasController.getTomasByTratamiento);

// Obtener estadísticas de tomas de un tratamiento
router.get('/tratamiento/:idTratamiento/estadisticas', tomasController.getEstadisticasTomas);

// Registrar una nueva toma
router.post('/', tomasController.registrarToma);

// Generar tomas programadas automáticamente
router.post('/generar', tomasController.generarTomasProgramadas);

// Actualizar estado de una toma
router.put('/:id', tomasController.actualizarEstadoToma);

// Eliminar una toma
router.delete('/:id', tomasController.eliminarToma);

// NUEVA RUTA: Eliminar todas las tomas de un tratamiento
router.delete('/tratamiento/:idTratamiento/todas', tomasController.eliminarTodasTomas);

module.exports = router;