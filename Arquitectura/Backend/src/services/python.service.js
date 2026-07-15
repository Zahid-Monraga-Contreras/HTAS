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
     * Ejecuta el script Python para analizar un paciente con PDF
     */
    async analizarPaciente(datosPaciente) {
        return new Promise((resolve, reject) => {
            // Validar que el script existe
            if (!fs.existsSync(this.scriptPath)) {
                reject(new Error(`Script no encontrado: ${this.scriptPath}`));
                return;
            }

            console.log('[PythonService] Ejecutando análisis...');
            console.log(`[PythonService] Script: ${this.scriptPath}`);

            // Crear payload para Python
            const payload = {
                accion: 'analizar_paciente',
                edad: datosPaciente.edad,
                sistolica: datosPaciente.sistolica,
                diastolica: datosPaciente.diastolica,
                toma_medicamento: datosPaciente.tomaMedicamento || 0,
                cedula_medico: datosPaciente.cedulaMedico || '1234567',
                cedula_pdf_base64: datosPaciente.cedulaPdfBase64 || '',
                diagnostico_pdf_base64: datosPaciente.diagnosticoPdfBase64
            };

            // Ejecutar Python con el payload como JSON
            const pythonProcess = spawn(this.pythonPath, [
                this.scriptPath,
                '--json',
                JSON.stringify(payload)
            ]);

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log(`[Python STDOUT] ${data.toString().trim()}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.error(`[Python STDERR] ${data.toString().trim()}`);
            });

            pythonProcess.on('close', (code) => {
                console.log(`[PythonService] Proceso finalizado con código: ${code}`);

                if (code === 0) {
                    try {
                        // Intentar parsear la salida como JSON
                        const jsonMatch = output.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const resultado = JSON.parse(jsonMatch[0]);
                            resolve(resultado);
                        } else {
                            // Si no es JSON, devolver la salida como texto
                            resolve({
                                exitoso: true,
                                mensaje: 'Análisis completado',
                                salida: output
                            });
                        }
                    } catch (error) {
                        reject(new Error(`Error al parsear respuesta: ${error.message}`));
                    }
                } else {
                    reject(new Error(`Error en Python: ${errorOutput || output}`));
                }
            });

            // Timeout de 60 segundos
            const timeout = setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Timeout: El análisis tardó demasiado tiempo'));
            }, 60000);

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