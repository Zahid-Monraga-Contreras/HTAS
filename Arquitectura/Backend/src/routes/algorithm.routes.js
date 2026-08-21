// src/routes/algorithmRoutes.js
const express = require('express');
const router = express.Router();
const AlgorithmController = require('../controllers/algorithm.controller');
const upload = require('../middleware/upload');

/**
 * @route POST /api/algorithm/analizar
 * @desc Analiza un paciente con un solo PDF (diagnóstico)
 * @access Public
 */
router.post(
    '/analizar',
    upload.single('pdf'),
    AlgorithmController.analizarConPDF
);

/**
 * @route POST /api/algorithm/analizar-completo
 * @desc Analiza un paciente con dos PDFs (cédula + diagnóstico)
 * @access Public
 */
router.post(
    '/analizar-completo',
    upload.fields([
        { name: 'cedula', maxCount: 1 },
        { name: 'diagnostico', maxCount: 1 }
    ]),
    AlgorithmController.analizarConMultiplesPDFs
);

/**
 * @route GET /api/algorithm/ultimo-expediente/:idPaciente
 * @desc Obtiene el ultimo expediente de un paciente
 * @access Public
 */
router.get(
    '/ultimo-expediente/:idPaciente',
    AlgorithmController.obtenerUltimoExpediente
);

/**
 * @route GET /api/algorithm/pdf/:folio
 * @desc Obtiene el PDF de un expediente por folio (descarga directa)
 * @access Public
 */
router.get(
    '/pdf/:folio',
    AlgorithmController.obtenerPDFExpediente
);

/**
 * @route GET /api/algorithm/pdf-base64/:folio
 * @desc Obtiene el PDF de un expediente en formato Base64
 * @access Public
 */
router.get(
    '/pdf-base64/:folio',
    AlgorithmController.obtenerPDFBase64
);

/**
 * @route GET /api/algorithm/ultimo-analisis/:cedulaMedico
 * @desc Obtiene el ultimo analisis de un medico por su cedula
 * @access Public
 */
router.get(
    '/ultimo-analisis/:cedulaMedico',
    AlgorithmController.obtenerUltimoAnalisis
);

/**
 * @route POST /api/algorithm/accion-personalizada
 * @desc Ejecuta una accion personalizada en Python (utilidad)
 * @access Public
 */
router.post(
    '/accion-personalizada',
    express.json(),
    AlgorithmController.ejecutarAccionPersonalizada
);

/**
 * @route GET /api/algorithm/estado
 * @desc Verifica el estado del sistema
 * @access Public
 */
router.get(
    '/estado',
    AlgorithmController.verificarEstado
);

module.exports = router;