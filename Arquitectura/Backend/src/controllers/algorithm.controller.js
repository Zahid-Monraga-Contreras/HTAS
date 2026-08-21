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

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No se subio ningun archivo PDF'
                });
            }

            const { edad, sistolica, diastolica, tomaMedicamento, cedulaMedico, idPaciente, idDoctor } = req.body;

            if (!edad || !sistolica || !diastolica) {
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(400).json({
                    success: false,
                    error: 'Faltan datos requeridos: edad, sistolica, diastolica'
                });
            }

            if (!idPaciente) {
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere el ID del paciente'
                });
            }

            console.log(`[AlgorithmController] Archivo recibido: ${req.file.originalname}`);
            console.log(`[AlgorithmController] ID Paciente: ${idPaciente}`);

            const pdfBuffer = fs.readFileSync(req.file.path);
            const pdfBase64 = pdfBuffer.toString('base64');

            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

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

            const resultado = await pythonService.analizarPaciente(datosPaciente);

            // Manejar diferentes estructuras de respuesta
            const responseData = resultado.data || resultado;

            return res.status(200).json({
                success: true,
                data: responseData,
                mensaje: 'Paciente analizado exitosamente'
            });

        } catch (error) {
            console.error('[AlgorithmController] Error:', error);

            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (unlinkError) {
                    console.error('[AlgorithmController] Error al eliminar archivo:', unlinkError);
                }
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

            if (!edad || !sistolica || !diastolica) {
                return res.status(400).json({
                    success: false,
                    error: 'Faltan datos requeridos: edad, sistolica, diastolica'
                });
            }

            console.log(`[AlgorithmController] ID Paciente: ${idPaciente}`);

            const cedulaBuffer = fs.readFileSync(req.files.cedula[0].path);
            const diagnosticoBuffer = fs.readFileSync(req.files.diagnostico[0].path);

            const cedulaBase64 = cedulaBuffer.toString('base64');
            const diagnosticoBase64 = diagnosticoBuffer.toString('base64');

            // Limpiar archivos temporales
            if (req.files.cedula[0] && fs.existsSync(req.files.cedula[0].path)) {
                fs.unlinkSync(req.files.cedula[0].path);
            }
            if (req.files.diagnostico[0] && fs.existsSync(req.files.diagnostico[0].path)) {
                fs.unlinkSync(req.files.diagnostico[0].path);
            }

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

            // Manejar diferentes estructuras de respuesta
            const responseData = resultado.data || resultado;

            return res.status(200).json({
                success: true,
                data: responseData,
                mensaje: 'Paciente analizado exitosamente'
            });

        } catch (error) {
            console.error('[AlgorithmController] Error:', error);

            // Limpiar archivos temporales en caso de error
            if (req.files) {
                Object.values(req.files).forEach(fileArray => {
                    fileArray.forEach(file => {
                        if (file && file.path && fs.existsSync(file.path)) {
                            try {
                                fs.unlinkSync(file.path);
                            } catch (unlinkError) {
                                console.error('[AlgorithmController] Error al eliminar archivo:', unlinkError);
                            }
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

            const resultado = await pythonService.obtenerUltimoExpedientePaciente(parseInt(idPaciente));

            // Verificar si el resultado tiene la estructura esperada
            if (resultado && resultado.error) {
                return res.status(200).json({
                    success: false,
                    error: resultado.error,
                    data: null,
                    mensaje: resultado.mensaje || 'Error al obtener el expediente'
                });
            } else if (resultado && resultado.data === null) {
                // No hay expediente
                return res.status(200).json({
                    success: true,
                    data: null,
                    mensaje: resultado.mensaje || 'El paciente no tiene expedientes'
                });
            } else if (resultado) {
                // Datos del expediente encontrados
                return res.status(200).json({
                    success: true,
                    data: resultado,
                    mensaje: 'Expediente encontrado exitosamente'
                });
            } else {
                return res.status(200).json({
                    success: true,
                    data: null,
                    mensaje: 'El paciente no tiene expedientes'
                });
            }

        } catch (error) {
            console.error('[AlgorithmController] Error obteniendo expediente:', error);

            // Manejar el error de forma amigable
            if (error.message && (error.message.includes('No hay expedientes') || error.message.includes('no tiene expedientes'))) {
                return res.status(200).json({
                    success: true,
                    data: null,
                    mensaje: 'El paciente no tiene expedientes'
                });
            }

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

            // Verificar si tiene el PDF en base64
            const pdfBase64 = resultado?.pdf_diagnostico_base64 || resultado?.data?.pdf_diagnostico_base64;

            if (pdfBase64) {
                const pdfBuffer = Buffer.from(pdfBase64, 'base64');
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=expediente_${folio}.pdf`);
                res.setHeader('Content-Length', pdfBuffer.length);
                return res.send(pdfBuffer);
            } else {
                return res.status(404).json({
                    success: false,
                    error: 'PDF no encontrado para este expediente'
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
     * Obtiene el ultimo analisis de un medico por su cedula
     */
    static async obtenerUltimoAnalisis(req, res) {
        try {
            const { cedulaMedico } = req.params;

            if (!cedulaMedico) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere la cedula del medico'
                });
            }

            console.log(`[AlgorithmController] Obteniendo ultimo analisis para medico: ${cedulaMedico}`);

            const resultado = await pythonService.obtenerUltimoAnalisis(cedulaMedico);

            // Manejar diferentes estructuras de respuesta
            const responseData = resultado.data || resultado;

            if (responseData && responseData.error) {
                return res.status(200).json({
                    success: false,
                    error: responseData.error,
                    data: null
                });
            } else if (responseData) {
                return res.status(200).json({
                    success: true,
                    data: responseData,
                    mensaje: 'Ultimo analisis encontrado exitosamente'
                });
            } else {
                return res.status(200).json({
                    success: true,
                    data: null,
                    mensaje: 'No hay analisis para esta cedula'
                });
            }

        } catch (error) {
            console.error('[AlgorithmController] Error obteniendo ultimo analisis:', error);

            if (error.message && error.message.includes('No hay analisis')) {
                return res.status(200).json({
                    success: true,
                    data: null,
                    mensaje: 'No hay analisis para esta cedula'
                });
            }

            return res.status(500).json({
                success: false,
                error: error.message || 'Error al obtener el ultimo analisis'
            });
        }
    }

    /**
     * Obtiene los PDFs de un expediente en formato Base64
     */
    static async obtenerPDFBase64(req, res) {
        try {
            const { folio } = req.params;

            if (!folio) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere el folio del expediente'
                });
            }

            console.log(`[AlgorithmController] Obteniendo PDF Base64 para folio: ${folio}`);

            const resultado = await pythonService.obtenerPdfPorFolio(parseInt(folio));

            const responseData = resultado.data || resultado;

            return res.status(200).json({
                success: true,
                data: {
                    folio: folio,
                    pdf_cedula_base64: responseData?.pdf_cedula_base64 || null,
                    pdf_diagnostico_base64: responseData?.pdf_diagnostico_base64 || null,
                    tiene_pdf_cedula: responseData?.tiene_pdf_cedula || false,
                    tiene_pdf_diagnostico: responseData?.tiene_pdf_diagnostico || false
                }
            });

        } catch (error) {
            console.error('[AlgorithmController] Error obteniendo PDF Base64:', error);
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
                servidor: 'Activo',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('[AlgorithmController] Error al verificar estado:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error al verificar el estado del sistema'
            });
        }
    }

    /**
     * Ejecuta una accion personalizada en Python (utilidad para depuracion)
     */
    static async ejecutarAccionPersonalizada(req, res) {
        try {
            const { accion, ...payload } = req.body;

            if (!accion) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere el campo "accion"'
                });
            }

            console.log(`[AlgorithmController] Ejecutando accion personalizada: ${accion}`);

            const resultado = await pythonService.ejecutarAccionPersonalizada({
                accion,
                ...payload
            });

            return res.status(200).json({
                success: true,
                data: resultado,
                mensaje: `Accion '${accion}' ejecutada exitosamente`
            });

        } catch (error) {
            console.error('[AlgorithmController] Error en accion personalizada:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error al ejecutar la accion'
            });
        }
    }
}

module.exports = AlgorithmController;