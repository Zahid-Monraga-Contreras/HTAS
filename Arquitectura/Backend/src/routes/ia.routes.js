const { Router } = require('express');
const router = Router();
// Importamos el controlador desde donde lo tienes actualmente
const { analizarPresion } = require('../controllers/ia.controller'); 

// Definimos la ruta POST para recibir los datos de la presión
router.post('/analizar-presion', analizarPresion);

module.exports = router;