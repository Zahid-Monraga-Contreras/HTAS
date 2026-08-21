// src/services/pythonService.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class PythonService {
    constructor() {
        this.pythonPath = process.env.PYTHON_PATH || 'python';
        this.scriptPath = path.join(
            process.cwd(),
            'python',
            'algorithm',
            'hipertension_analyzer.py'
        );
    }

    /**
     * Extrae el JSON de una cadena de texto que puede contener otros mensajes
     * Busca la primera '{' y encuentra el '}' que cierra correctamente
     */
    extractJSON(text) {
        if (!text) return null;

        // Buscar la primera ocurrencia de '{'
        const firstBrace = text.indexOf('{');
        if (firstBrace === -1) return null;

        // Contar brackets para encontrar el cierre correcto
        let braceCount = 0;
        let lastBrace = -1;

        for (let i = firstBrace; i < text.length; i++) {
            if (text[i] === '{') braceCount++;
            if (text[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    lastBrace = i;
                    break;
                }
            }
        }

        if (lastBrace === -1) return null;

        // Extraer el JSON
        const jsonString = text.substring(firstBrace, lastBrace + 1);

        // Validar que sea un JSON válido intentando parsearlo
        try {
            JSON.parse(jsonString);
            return jsonString;
        } catch (e) {
            // Si falla, intentar limpiar caracteres problemáticos
            const cleaned = jsonString
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Eliminar caracteres de control
                .replace(/\\(?!["\\\/bfnrtu])/g, '\\\\'); // Escapar backslashes sueltos
            try {
                JSON.parse(cleaned);
                return cleaned;
            } catch (e2) {
                console.error('[PythonService] No se pudo extraer JSON válido');
                return null;
            }
        }
    }

    /**
     * Ejecuta el script Python para analizar un paciente con PDF
     */
    async analizarPaciente(datosPaciente) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.scriptPath)) {
                reject(new Error(`Script no encontrado: ${this.scriptPath}`));
                return;
            }

            console.log('[PythonService] Ejecutando analisis...');
            console.log(`[PythonService] Script: ${this.scriptPath}`);

            const payload = {
                accion: 'analizar_paciente',
                id_paciente: datosPaciente.idPaciente || null,
                id_doctor: datosPaciente.idDoctor || null,
                edad: datosPaciente.edad,
                sistolica: datosPaciente.sistolica,
                diastolica: datosPaciente.diastolica,
                toma_medicamento: datosPaciente.tomaMedicamento || 0,
                cedula_medico: datosPaciente.cedulaMedico || '',
                cedula_pdf_base64: datosPaciente.cedulaPdfBase64 || '',
                diagnostico_pdf_base64: datosPaciente.diagnosticoPdfBase64 || ''
            };

            const payloadJson = JSON.stringify(payload);
            console.log(`[PythonService] Tamano del payload: ${payloadJson.length} caracteres`);

            const useStdin = payloadJson.length > 10000;
            let pythonProcess;

            if (useStdin) {
                console.log('[PythonService] Usando stdin para enviar datos (payload grande)');
                pythonProcess = spawn(this.pythonPath, [this.scriptPath, '--stdin']);
                pythonProcess.stdin.write(payloadJson);
                pythonProcess.stdin.end();
            } else {
                console.log('[PythonService] Usando argumentos para enviar datos (payload pequeno)');
                pythonProcess = spawn(this.pythonPath, [
                    this.scriptPath,
                    '--json',
                    payloadJson
                ]);
            }

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                // Filtrar mensajes de inicialización para no saturar
                const lines = chunk.trim().split('\n');
                lines.forEach(line => {
                    if (line.startsWith('{')) {
                        console.log(`[Python STDOUT] ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
                    } else if (!line.includes('[INIT]') && !line.includes('python-dotenv')) {
                        console.log(`[Python STDOUT] ${line}`);
                    }
                });
            });

            pythonProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                // Filtrar warnings de deprecación para no saturar
                if (!chunk.includes('DeprecationWarning') && !chunk.includes('PydanticDeprecatedSince20')) {
                    console.error(`[Python STDERR] ${chunk.trim()}`);
                }
            });

            pythonProcess.on('close', (code) => {
                console.log(`[PythonService] Proceso finalizado con codigo: ${code}`);

                if (code === 0) {
                    try {
                        // Usar extractJSON para obtener el JSON correctamente
                        const jsonString = this.extractJSON(output);
                        let resultado = null;

                        if (jsonString) {
                            resultado = JSON.parse(jsonString);
                            console.log('[PythonService] Respuesta parseada exitosamente');
                        } else {
                            console.warn('[PythonService] No se encontro JSON en la salida');
                            console.warn(`[PythonService] Salida: ${output.substring(0, 500)}...`);
                            resolve({
                                exitoso: true,
                                mensaje: 'Analisis completado',
                                salida: output
                            });
                            return;
                        }

                        // Manejar diferentes estructuras de respuesta
                        if (resultado.exitoso === false) {
                            reject(new Error(resultado.error || 'Error en el analisis'));
                        } else if (resultado.exitoso === true) {
                            // Si tiene estructura {exitoso, data}
                            if (resultado.data !== undefined) {
                                resolve(resultado.data);
                            } else {
                                resolve(resultado);
                            }
                        } else if (resultado.folio_expediente_db !== undefined) {
                            // Si es la respuesta de analizar_paciente
                            resolve(resultado);
                        } else {
                            // Cualquier otra respuesta válida
                            resolve(resultado);
                        }
                    } catch (error) {
                        console.error(`[PythonService] Error al parsear respuesta: ${error.message}`);
                        console.error(`[PythonService] Output completo: ${output}`);
                        reject(new Error(`Error al parsear respuesta: ${error.message}`));
                    }
                } else {
                    console.error(`[PythonService] Error en Python: ${errorOutput || output}`);
                    reject(new Error(`Error en Python (codigo ${code}): ${errorOutput || output}`));
                }
            });

            const timeout = setTimeout(() => {
                console.error('[PythonService] Timeout: El analisis tardo demasiado tiempo');
                pythonProcess.kill();
                reject(new Error('Timeout: El analisis tardo demasiado tiempo'));
            }, 60000);

            pythonProcess.on('exit', () => {
                clearTimeout(timeout);
            });
        });
    }

    /**
     * Obtiene los PDFs de un expediente por su folio
     */
    async obtenerPdfPorFolio(folio) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.scriptPath)) {
                reject(new Error(`Script no encontrado: ${this.scriptPath}`));
                return;
            }

            console.log('[PythonService] Obteniendo PDF por folio...');
            console.log(`[PythonService] Folio: ${folio}`);

            const payload = {
                accion: 'obtener_pdf_por_folio',
                folio: folio
            };

            const payloadJson = JSON.stringify(payload);

            const pythonProcess = spawn(this.pythonPath, [
                this.scriptPath,
                '--json',
                payloadJson
            ]);

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                const lines = chunk.trim().split('\n');
                lines.forEach(line => {
                    if (line.startsWith('{')) {
                        console.log(`[Python STDOUT] ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
                    } else if (!line.includes('[INIT]') && !line.includes('python-dotenv')) {
                        console.log(`[Python STDOUT] ${line}`);
                    }
                });
            });

            pythonProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                if (!chunk.includes('DeprecationWarning') && !chunk.includes('PydanticDeprecatedSince20')) {
                    console.error(`[Python STDERR] ${chunk.trim()}`);
                }
            });

            pythonProcess.on('close', (code) => {
                console.log(`[PythonService] Proceso finalizado con codigo: ${code}`);

                if (code === 0) {
                    try {
                        // Usar extractJSON para obtener el JSON correctamente
                        const jsonString = this.extractJSON(output);
                        let resultado = null;

                        if (jsonString) {
                            resultado = JSON.parse(jsonString);
                        } else {
                            reject(new Error('No se pudo parsear la respuesta como JSON'));
                            return;
                        }

                        if (resultado.exitoso === false) {
                            reject(new Error(resultado.error || 'Error al obtener PDF'));
                        } else {
                            // Si tiene estructura {exitoso, data}
                            if (resultado.data !== undefined) {
                                resolve(resultado.data);
                            } else {
                                resolve(resultado);
                            }
                        }
                    } catch (error) {
                        reject(new Error(`Error al parsear respuesta: ${error.message}`));
                    }
                } else {
                    reject(new Error(`Error en Python (codigo ${code}): ${errorOutput || output}`));
                }
            });

            const timeout = setTimeout(() => {
                console.error('[PythonService] Timeout: La obtencion del PDF tardo demasiado tiempo');
                pythonProcess.kill();
                reject(new Error('Timeout: La obtencion del PDF tardo demasiado tiempo'));
            }, 30000);

            pythonProcess.on('exit', () => {
                clearTimeout(timeout);
            });
        });
    }

    /**
     * Obtiene el ultimo analisis de un medico por su cedula
     */
    async obtenerUltimoAnalisis(cedulaMedico) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.scriptPath)) {
                reject(new Error(`Script no encontrado: ${this.scriptPath}`));
                return;
            }

            console.log('[PythonService] Obteniendo ultimo analisis...');
            console.log(`[PythonService] Cedula Medico: ${cedulaMedico}`);

            const payload = {
                accion: 'obtener_ultimo_analisis',
                cedula_medico: cedulaMedico
            };

            const payloadJson = JSON.stringify(payload);

            const pythonProcess = spawn(this.pythonPath, [
                this.scriptPath,
                '--json',
                payloadJson
            ]);

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                const lines = chunk.trim().split('\n');
                lines.forEach(line => {
                    if (line.startsWith('{')) {
                        console.log(`[Python STDOUT] ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
                    } else if (!line.includes('[INIT]') && !line.includes('python-dotenv')) {
                        console.log(`[Python STDOUT] ${line}`);
                    }
                });
            });

            pythonProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                if (!chunk.includes('DeprecationWarning') && !chunk.includes('PydanticDeprecatedSince20')) {
                    console.error(`[Python STDERR] ${chunk.trim()}`);
                }
            });

            pythonProcess.on('close', (code) => {
                console.log(`[PythonService] Proceso finalizado con codigo: ${code}`);

                if (code === 0) {
                    try {
                        // Usar extractJSON para obtener el JSON correctamente
                        const jsonString = this.extractJSON(output);
                        let resultado = null;

                        if (jsonString) {
                            resultado = JSON.parse(jsonString);
                        } else {
                            reject(new Error('No se pudo parsear la respuesta como JSON'));
                            return;
                        }

                        if (resultado.exitoso === false) {
                            reject(new Error(resultado.error || 'Error al obtener ultimo analisis'));
                        } else {
                            // Si tiene estructura {exitoso, data}
                            if (resultado.data !== undefined) {
                                resolve(resultado.data);
                            } else {
                                resolve(resultado);
                            }
                        }
                    } catch (error) {
                        reject(new Error(`Error al parsear respuesta: ${error.message}`));
                    }
                } else {
                    reject(new Error(`Error en Python (codigo ${code}): ${errorOutput || output}`));
                }
            });

            const timeout = setTimeout(() => {
                console.error('[PythonService] Timeout: La obtencion del ultimo analisis tardo demasiado tiempo');
                pythonProcess.kill();
                reject(new Error('Timeout: La obtencion del ultimo analisis tardo demasiado tiempo'));
            }, 30000);

            pythonProcess.on('exit', () => {
                clearTimeout(timeout);
            });
        });
    }

    /**
     * Obtiene el ultimo expediente de un paciente
     */
    async obtenerUltimoExpedientePaciente(idPaciente) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.scriptPath)) {
                reject(new Error(`Script no encontrado: ${this.scriptPath}`));
                return;
            }

            console.log('[PythonService] Obteniendo ultimo expediente del paciente...');
            console.log(`[PythonService] ID Paciente: ${idPaciente}`);

            const payload = {
                accion: 'obtener_ultimo_expediente_paciente',
                id_paciente: idPaciente
            };

            const payloadJson = JSON.stringify(payload);

            const pythonProcess = spawn(this.pythonPath, [
                this.scriptPath,
                '--json',
                payloadJson
            ]);

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                const lines = chunk.trim().split('\n');
                lines.forEach(line => {
                    if (line.startsWith('{')) {
                        console.log(`[Python STDOUT] ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
                    } else if (!line.includes('[INIT]') && !line.includes('python-dotenv')) {
                        console.log(`[Python STDOUT] ${line}`);
                    }
                });
            });

            pythonProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                if (!chunk.includes('DeprecationWarning') && !chunk.includes('PydanticDeprecatedSince20')) {
                    console.error(`[Python STDERR] ${chunk.trim()}`);
                }
            });

            pythonProcess.on('close', (code) => {
                console.log(`[PythonService] Proceso finalizado con codigo: ${code}`);

                if (code === 0) {
                    try {
                        // Usar extractJSON para obtener el JSON correctamente
                        const jsonString = this.extractJSON(output);
                        let resultado = null;

                        if (jsonString) {
                            resultado = JSON.parse(jsonString);
                        } else {
                            reject(new Error('No se pudo parsear la respuesta como JSON'));
                            return;
                        }

                        if (resultado.exitoso === false) {
                            reject(new Error(resultado.error || 'Error al obtener expediente'));
                        } else {
                            // Si tiene estructura {exitoso, data}
                            if (resultado.data !== undefined) {
                                resolve(resultado.data);
                            } else {
                                resolve(resultado);
                            }
                        }
                    } catch (error) {
                        reject(new Error(`Error al parsear respuesta: ${error.message}`));
                    }
                } else {
                    reject(new Error(`Error en Python (codigo ${code}): ${errorOutput || output}`));
                }
            });

            const timeout = setTimeout(() => {
                console.error('[PythonService] Timeout: La obtencion del expediente tardo demasiado tiempo');
                pythonProcess.kill();
                reject(new Error('Timeout: La obtencion del expediente tardo demasiado tiempo'));
            }, 30000);

            pythonProcess.on('exit', () => {
                clearTimeout(timeout);
            });
        });
    }

    /**
     * Ejecuta una accion personalizada en Python
     */
    async ejecutarAccionPersonalizada(payload) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.scriptPath)) {
                reject(new Error(`Script no encontrado: ${this.scriptPath}`));
                return;
            }

            console.log('[PythonService] Ejecutando accion personalizada...');
            console.log(`[PythonService] Accion: ${payload.accion}`);

            const payloadJson = JSON.stringify(payload);

            const pythonProcess = spawn(this.pythonPath, [
                this.scriptPath,
                '--json',
                payloadJson
            ]);

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                const lines = chunk.trim().split('\n');
                lines.forEach(line => {
                    if (line.startsWith('{')) {
                        console.log(`[Python STDOUT] ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
                    } else if (!line.includes('[INIT]') && !line.includes('python-dotenv')) {
                        console.log(`[Python STDOUT] ${line}`);
                    }
                });
            });

            pythonProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                if (!chunk.includes('DeprecationWarning') && !chunk.includes('PydanticDeprecatedSince20')) {
                    console.error(`[Python STDERR] ${chunk.trim()}`);
                }
            });

            pythonProcess.on('close', (code) => {
                console.log(`[PythonService] Proceso finalizado con codigo: ${code}`);

                if (code === 0) {
                    try {
                        // Usar extractJSON para obtener el JSON correctamente
                        const jsonString = this.extractJSON(output);
                        let resultado = null;

                        if (jsonString) {
                            resultado = JSON.parse(jsonString);
                        } else {
                            reject(new Error('No se pudo parsear la respuesta como JSON'));
                            return;
                        }

                        // Verificar si la respuesta es exitosa
                        if (resultado.exitoso === false) {
                            reject(new Error(resultado.error || 'Error en la operacion'));
                        } else {
                            // Si la respuesta tiene la estructura {exitoso, data}, extraer data
                            if (resultado.data !== undefined) {
                                resolve(resultado.data);
                            } else {
                                resolve(resultado);
                            }
                        }
                    } catch (error) {
                        reject(new Error(`Error al parsear respuesta: ${error.message}`));
                    }
                } else {
                    reject(new Error(`Error en Python (codigo ${code}): ${errorOutput || output}`));
                }
            });

            const timeout = setTimeout(() => {
                console.error('[PythonService] Timeout en ejecutarAccionPersonalizada');
                pythonProcess.kill();
                reject(new Error('Timeout: La operacion tardo demasiado tiempo'));
            }, 30000);

            pythonProcess.on('exit', () => {
                clearTimeout(timeout);
            });
        });
    }

    /**
     * Verifica el estado del sistema Python
     */
    async verificarEstado() {
        return new Promise((resolve) => {
            const exists = fs.existsSync(this.scriptPath);
            resolve({
                scriptExist: exists,
                scriptPath: this.scriptPath,
                pythonPath: this.pythonPath
            });
        });
    }
}

module.exports = new PythonService();