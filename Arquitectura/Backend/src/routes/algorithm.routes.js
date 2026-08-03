// src/routes/algorithmRoutes.js
const express = require('express');
const router = express.Router();
const AlgorithmController = require('../controllers/algorithm.controller');
const upload = require('../middleware/upload');

// Ruta para analizar con un solo PDF (diagnóstico)
router.post(
    '/analizar',
    upload.single('pdf'),
    AlgorithmController.analizarConPDF
);

// Ruta para analizar con dos PDFs (cédula + diagnóstico)
router.post(
    '/analizar-completo',
    upload.fields([
        { name: 'cedula', maxCount: 1 },
        { name: 'diagnostico', maxCount: 1 }
    ]),
    AlgorithmController.analizarConMultiplesPDFs
);

// Ruta para obtener el ultimo expediente de un paciente
router.get(
    '/ultimo-expediente/:idPaciente',
    AlgorithmController.obtenerUltimoExpediente
);

// Ruta para obtener el PDF de un expediente por folio
router.get(
    '/pdf/:folio',
    AlgorithmController.obtenerPDFExpediente
);

// Ruta para verificar estado del sistema
router.get(
    '/estado',
    AlgorithmController.verificarEstado
);

module.exports = router;