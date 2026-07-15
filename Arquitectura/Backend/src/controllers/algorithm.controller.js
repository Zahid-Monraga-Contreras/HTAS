// src/controllers/algorithmController.js
const pythonService = require('../services/python.service');
const fs = require('fs');
const path = require('path');

class AlgorithmController {
    /**
     * Analiza un paciente usando un archivo PDF subido
     */
    static async analizarConPDF(req, res) {
        try {
            console.log('[AlgorithmController] Analizando paciente con PDF...');

            // Validar que se subió el archivo
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No se subió ningún archivo PDF'
                });
            }

            // Validar datos requeridos
            const { edad, sistolica, diastolica, tomaMedicamento, cedulaMedico } = req.body;

            if (!edad || !sistolica || !diastolica) {
                // Eliminar archivo subido
                fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    success: false,
                    error: 'Faltan datos requeridos: edad, sistolica, diastolica'
                });
            }

            console.log(`[AlgorithmController] Archivo recibido: ${req.file.originalname}`);
            console.log(`[AlgorithmController] Tamaño: ${req.file.size} bytes`);
            console.log(`[AlgorithmController] Datos: Edad=${edad}, Sistolica=${sistolica}, Diastolica=${diastolica}`);

            // Leer el PDF y convertirlo a Base64
            const pdfBuffer = fs.readFileSync(req.file.path);
            const pdfBase64 = pdfBuffer.toString('base64');

            // Eliminar archivo temporal
            fs.unlinkSync(req.file.path);

            // Construir payload para Python
            const datosPaciente = {
                edad: parseInt(edad),
                sistolica: parseInt(sistolica),
                diastolica: parseInt(diastolica),
                tomaMedicamento: parseInt(tomaMedicamento) || 0,
                cedulaMedico: cedulaMedico || '1234567',
                cedulaPdfBase64: '', // No tenemos cédula, usar dummy
                diagnosticoPdfBase64: pdfBase64
            };

            // Ejecutar análisis en Python
            const resultado = await pythonService.analizarPaciente(datosPaciente);

            return res.status(200).json({
                success: true,
                data: resultado,
                mensaje: 'Paciente analizado exitosamente'
            });

        } catch (error) {
            console.error('[AlgorithmController] Error:', error);

            // Limpiar archivo si existe
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(500).json({
                success: false,
                error: error.message || 'Error al analizar el paciente'
            });
        }
    }

    /**
     * Analiza un paciente con múltiples PDFs (cédula + diagnóstico)
     */
    static async analizarConMultiplesPDFs(req, res) {
        try {
            console.log('[AlgorithmController] Analizando con múltiples PDFs...');

            const { edad, sistolica, diastolica, tomaMedicamento, cedulaMedico } = req.body;

            if (!req.files || !req.files.cedula || !req.files.diagnostico) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requieren dos PDFs: cedula y diagnostico'
                });
            }

            // Leer y convertir PDFs a Base64
            const cedulaBuffer = fs.readFileSync(req.files.cedula[0].path);
            const diagnosticoBuffer = fs.readFileSync(req.files.diagnostico[0].path);

            const cedulaBase64 = cedulaBuffer.toString('base64');
            const diagnosticoBase64 = diagnosticoBuffer.toString('base64');

            // Eliminar archivos temporales
            fs.unlinkSync(req.files.cedula[0].path);
            fs.unlinkSync(req.files.diagnostico[0].path);

            const datosPaciente = {
                edad: parseInt(edad),
                sistolica: parseInt(sistolica),
                diastolica: parseInt(diastolica),
                tomaMedicamento: parseInt(tomaMedicamento) || 0,
                cedulaMedico: cedulaMedico || '1234567',
                cedulaPdfBase64: cedulaBase64,
                diagnosticoPdfBase64: diagnosticoBase64
            };

            const resultado = await pythonService.analizarPaciente(datosPaciente);

            return res.status(200).json({
                success: true,
                data: resultado,
                mensaje: 'Paciente analizado exitosamente'
            });

        } catch (error) {
            console.error('[AlgorithmController] Error:', error);

            // Limpiar archivos
            if (req.files) {
                Object.values(req.files).forEach(fileArray => {
                    fileArray.forEach(file => {
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path);
                        }
                    });
                });
            }

            return res.status(500).json({
                success: false,
                error: error.message || 'Error al analizar el paciente'
            });
        }
    }

    /**
     * Verifica el estado del sistema
     */
    static async verificarEstado(req, res) {
        try {
            const estado = await pythonService.verificarEstado();

            return res.status(200).json({
                success: true,
                data: estado,
                servidor: 'Activo'
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = AlgorithmController;