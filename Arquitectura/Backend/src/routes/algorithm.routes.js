// src/routes/algorithmRoutes.js
const express = require('express');
const router = express.Router();
const AlgorithmController = require('../controllers/algorithm.controller');
const upload = require('../middleware/upload');

// Ruta para analizar con un solo PDF (diagnóstico)
router.post(
    '/algorithm/analizar',
    upload.single('pdf'),
    AlgorithmController.analizarConPDF
);

// Ruta para analizar con dos PDFs (cédula + diagnóstico)
router.post(
    '/algorithm/analizar-completo',
    upload.fields([
        { name: 'cedula', maxCount: 1 },
        { name: 'diagnostico', maxCount: 1 }
    ]),
    AlgorithmController.analizarConMultiplesPDFs
);

// Ruta para verificar estado del sistema
router.get(
    '/algorithm/estado',
    AlgorithmController.verificarEstado
);

module.exports = router;