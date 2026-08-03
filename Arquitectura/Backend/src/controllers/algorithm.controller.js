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
                    error: 'No se subio ningun archivo PDF'
                });
            }

            // Validar datos requeridos
            const { edad, sistolica, diastolica, tomaMedicamento, cedulaMedico, idPaciente, idDoctor } = req.body;

            if (!edad || !sistolica || !diastolica) {
                // Eliminar archivo subido
                fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    success: false,
                    error: 'Faltan datos requeridos: edad, sistolica, diastolica'
                });
            }

            if (!idPaciente) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere el ID del paciente'
                });
            }

            console.log(`[AlgorithmController] Archivo recibido: ${req.file.originalname}`);
            console.log(`[AlgorithmController] Tamanio: ${req.file.size} bytes`);
            console.log(`[AlgorithmController] Datos: Edad=${edad}, Sistolica=${sistolica}, Diastolica=${diastolica}`);
            console.log(`[AlgorithmController] ID Paciente: ${idPaciente}`);

            // Leer el PDF y convertirlo a Base64
            const pdfBuffer = fs.readFileSync(req.file.path);
            const pdfBase64 = pdfBuffer.toString('base64');

            // Eliminar archivo temporal
            fs.unlinkSync(req.file.path);

            // Construir payload para Python
            const datosPaciente = {
                idPaciente: parseInt(idPaciente),
                idDoctor: idDoctor ? parseInt(idDoctor) : null,
                edad: parseInt(edad),
                sistolica: parseInt(sistolica),
                diastolica: parseInt(diastolica),
                tomaMedicamento: parseInt(tomaMedicamento) || 0,
                cedulaMedico: cedulaMedico || '',
                cedulaPdfBase64: '',
                diagnosticoPdfBase64: pdfBase64
            };

            // Ejecutar analisis en Python
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
     * Analiza un paciente con multiples PDFs (cedula + diagnostico)
     */
    static async analizarConMultiplesPDFs(req, res) {
        try {
            console.log('[AlgorithmController] Analizando con multiples PDFs...');

            const { edad, sistolica, diastolica, tomaMedicamento, cedulaMedico, idPaciente, idDoctor } = req.body;

            if (!req.files || !req.files.cedula || !req.files.diagnostico) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requieren dos PDFs: cedula y diagnostico'
                });
            }

            if (!idPaciente) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere el ID del paciente'
                });
            }

            console.log(`[AlgorithmController] ID Paciente: ${idPaciente}`);

            // Leer y convertir PDFs a Base64
            const cedulaBuffer = fs.readFileSync(req.files.cedula[0].path);
            const diagnosticoBuffer = fs.readFileSync(req.files.diagnostico[0].path);

            const cedulaBase64 = cedulaBuffer.toString('base64');
            const diagnosticoBase64 = diagnosticoBuffer.toString('base64');

            // Eliminar archivos temporales
            fs.unlinkSync(req.files.cedula[0].path);
            fs.unlinkSync(req.files.diagnostico[0].path);

            const datosPaciente = {
                idPaciente: parseInt(idPaciente),
                idDoctor: idDoctor ? parseInt(idDoctor) : null,
                edad: parseInt(edad),
                sistolica: parseInt(sistolica),
                diastolica: parseInt(diastolica),
                tomaMedicamento: parseInt(tomaMedicamento) || 0,
                cedulaMedico: cedulaMedico || '',
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
     * Obtiene el ultimo expediente de un paciente
     */
    static async obtenerUltimoExpediente(req, res) {
        try {
            const { idPaciente } = req.params;

            if (!idPaciente) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere el ID del paciente'
                });
            }

            console.log(`[AlgorithmController] Obteniendo ultimo expediente para paciente: ${idPaciente}`);

            // Crear payload para Python
            const payload = {
                accion: 'obtener_ultimo_expediente_paciente',
                id_paciente: parseInt(idPaciente)
            };

            const resultado = await pythonService.ejecutarAccionPersonalizada(payload);

            return res.status(200).json({
                success: true,
                data: resultado
            });

        } catch (error) {
            console.error('[AlgorithmController] Error obteniendo expediente:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error al obtener el expediente'
            });
        }
    }

    /**
     * Obtiene los PDFs de un expediente por su folio
     */
    static async obtenerPDFExpediente(req, res) {
        try {
            const { folio } = req.params;

            if (!folio) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere el folio del expediente'
                });
            }

            console.log(`[AlgorithmController] Obteniendo PDF para folio: ${folio}`);

            const resultado = await pythonService.obtenerPdfPorFolio(parseInt(folio));

            if (resultado && resultado.pdf_diagnostico_base64) {
                const pdfBuffer = Buffer.from(resultado.pdf_diagnostico_base64, 'base64');
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=expediente_${folio}.pdf`);
                return res.send(pdfBuffer);
            } else {
                return res.status(404).json({
                    success: false,
                    error: 'PDF no encontrado'
                });
            }

        } catch (error) {
            console.error('[AlgorithmController] Error obteniendo PDF:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error al obtener el PDF'
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