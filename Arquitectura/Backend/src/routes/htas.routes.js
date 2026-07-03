// routes/htas.routes.js
const express = require('express');
const router = express.Router();
const htasController = require('../controllers/htas.controller');

// Definimos la ruta POST y le asignamos la función del controlador
router.post('/evaluar', htasController.evaluarCrisisHTAS);

module.exports = router;