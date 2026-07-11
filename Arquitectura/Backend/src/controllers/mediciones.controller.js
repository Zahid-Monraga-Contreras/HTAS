const db = require("../db/database");
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const medicionesController = {
    // ==========================================================================
    // REGISTRAR UNA NUEVA MEDICIÓN
    // ==========================================================================
    registrarMedicion: async (req, res) => {
        const {
            idPaciente,
            sistolica,
            diastolica,
            pulso,
            metodoSincronizacion
        } = req.body;

        // Validación estricta de campos requeridos
        if (!idPaciente || !sistolica || !diastolica || pulso === undefined || pulso === null) {
            return res.status(400).json({
                error: "Todos los campos de la medición (idPaciente, sistolica, diastolica, pulso) son obligatorios.",
            });
        }

        try {
            // Validar que el paciente existe y está activo
            const pacienteExists = await db.query(
                `SELECT u.IdUsuario, u.Nombre, u.ApPaterno 
             FROM USUARIOS u 
             JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario 
             WHERE u.IdUsuario = $1 AND u.Activo = true AND u.deleted_at IS NULL`,
                [idPaciente]
            );

            if (pacienteExists.rows.length === 0) {
                return res.status(404).json({
                    error: "Paciente no encontrado o inactivo"
                });
            }

            // ✅ Validar rangos fisiológicos (pulso puede ser 0)
            const pulsoValido = (pulso === 0) || (30 <= pulso && pulso <= 220);

            if (
                sistolica < 40 || sistolica > 260 ||
                diastolica < 30 || diastolica > 200 ||
                !pulsoValido
            ) {
                return res.status(400).json({
                    error: "Los valores de la medición están fuera de los rangos fisiológicos permitidos.",
                    detalles: {
                        sistolica: sistolica,
                        diastolica: diastolica,
                        pulso: pulso,
                        mensaje: "El pulso puede ser 0 (no detectado) o estar entre 30 y 220 bpm"
                    }
                });
            }

            // INSERTAR SOLO LAS COLUMNAS QUE EXISTEN EN LA TABLA
            const query = `
            INSERT INTO MEDICIONES_PRESION (
                IdPaciente, 
                Sistolica, 
                Diastolica, 
                Pulso, 
                MetodoSincronizacion
            ) VALUES ($1, $2, $3, $4, $5) 
            RETURNING *`;

            const result = await db.query(query, [
                idPaciente,
                sistolica,
                diastolica,
                pulso || 0,  // Si es null o undefined, usar 0
                metodoSincronizacion || "Bluetooth"
            ]);

            // Obtener la medición completa con información del paciente
            const medicionCompleta = await db.query(
                `SELECT 
                m.*,
                u.Nombre AS NombrePaciente,
                u.ApPaterno AS ApPaternoPaciente,
                u.ApMaterno AS ApMaternoPaciente
            FROM MEDICIONES_PRESION m
            JOIN USUARIOS u ON m.IdPaciente = u.IdUsuario
            WHERE m.IdMedicion = $1`,
                [result.rows[0].idmedicion]
            );

            res.status(201).json({
                message: "¡Medición registrada con éxito!",
                medicion: medicionCompleta.rows[0],
            });
        } catch (error) {
            console.error("Error crítico al registrar medición:", error);
            res.status(500).json({
                error: "Error interno del servidor al guardar la lectura médica.",
            });
        }
    },

    // ==========================================================================
    // OBTENER TODAS LAS MEDICIONES DE UN PACIENTE
    // ==========================================================================
    getMedicionesPaciente: async (req, res) => {
        const { idPaciente } = req.params;
        const { limite } = req.query;

        try {
            // Verificar que el paciente existe
            const pacienteExists = await db.query(
                `SELECT IdUsuario FROM USUARIOS 
                 WHERE IdUsuario = $1 AND deleted_at IS NULL`,
                [idPaciente]
            );

            if (pacienteExists.rows.length === 0) {
                return res.status(404).json({
                    error: "Paciente no encontrado"
                });
            }

            let query = `
                SELECT 
                    m.IdMedicion,
                    m.Sistolica,
                    m.Diastolica,
                    m.Pulso,
                    m.Unidad,
                    m.MetodoSincronizacion,
                    m.FechaHoraLectura,
                    m.created_at,
                    u.Nombre AS NombrePaciente,
                    u.ApPaterno AS ApPaternoPaciente,
                    u.ApMaterno AS ApMaternoPaciente,
                    CASE 
                        WHEN m.Sistolica < 120 AND m.Diastolica < 80 THEN 'Normal'
                        WHEN m.Sistolica BETWEEN 120 AND 129 AND m.Diastolica < 80 THEN 'Elevada'
                        WHEN m.Sistolica BETWEEN 130 AND 139 OR m.Diastolica BETWEEN 80 AND 89 THEN 'Hipertensión Grado 1'
                        WHEN m.Sistolica >= 140 OR m.Diastolica >= 90 THEN 'Hipertensión Grado 2'
                        ELSE 'Crisis Hipertensiva'
                    END AS ClasificacionPresion
                FROM MEDICIONES_PRESION m
                JOIN USUARIOS u ON m.IdPaciente = u.IdUsuario
                WHERE m.IdPaciente = $1
                ORDER BY m.FechaHoraLectura DESC
            `;

            const params = [idPaciente];

            if (limite && !isNaN(limite)) {
                query += ` LIMIT $${params.length + 1}`;
                params.push(parseInt(limite));
            }

            const result = await db.query(query, params);

            if (result.rows.length > 0) {
                const mediciones = result.rows;
                const total = mediciones.length;
                const sistolicaPromedio = mediciones.reduce((sum, m) => sum + m.sistolica, 0) / total;
                const diastolicaPromedio = mediciones.reduce((sum, m) => sum + m.diastolica, 0) / total;
                const pulsoPromedio = mediciones.reduce((sum, m) => sum + m.pulso, 0) / total;

                res.json({
                    mediciones: result.rows,
                    estadisticas: {
                        totalMediciones: total,
                        sistolicaPromedio: Math.round(sistolicaPromedio),
                        diastolicaPromedio: Math.round(diastolicaPromedio),
                        pulsoPromedio: Math.round(pulsoPromedio),
                        ultimaMedicion: result.rows[0]?.FechaHoraLectura || null
                    }
                });
            } else {
                res.json({
                    mediciones: [],
                    estadisticas: {
                        totalMediciones: 0,
                        sistolicaPromedio: null,
                        diastolicaPromedio: null,
                        pulsoPromedio: null,
                        ultimaMedicion: null
                    }
                });
            }
        } catch (error) {
            console.error("Error al obtener mediciones:", error);
            res.status(500).json({
                error: "Error al obtener el historial de mediciones."
            });
        }
    },

    // ==========================================================================
    // OBTENER LA ÚLTIMA MEDICIÓN DE UN PACIENTE
    // ==========================================================================
    getUltimaMedicionPaciente: async (req, res) => {
        const { idPaciente } = req.params;

        try {
            const query = `
                SELECT 
                    m.IdMedicion,
                    m.Sistolica,
                    m.Diastolica,
                    m.Pulso,
                    m.Unidad,
                    m.MetodoSincronizacion,
                    m.FechaHoraLectura,
                    m.created_at,
                    u.Nombre AS NombrePaciente,
                    u.ApPaterno AS ApPaternoPaciente,
                    u.ApMaterno AS ApMaternoPaciente,
                    CASE 
                        WHEN m.Sistolica < 120 AND m.Diastolica < 80 THEN 'Normal'
                        WHEN m.Sistolica BETWEEN 120 AND 129 AND m.Diastolica < 80 THEN 'Elevada'
                        WHEN m.Sistolica BETWEEN 130 AND 139 OR m.Diastolica BETWEEN 80 AND 89 THEN 'Hipertensión Grado 1'
                        WHEN m.Sistolica >= 140 OR m.Diastolica >= 90 THEN 'Hipertensión Grado 2'
                        ELSE 'Crisis Hipertensiva'
                    END AS ClasificacionPresion
                FROM MEDICIONES_PRESION m
                JOIN USUARIOS u ON m.IdPaciente = u.IdUsuario
                WHERE m.IdPaciente = $1
                ORDER BY m.FechaHoraLectura DESC
                LIMIT 1`;

            const result = await db.query(query, [idPaciente]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "No se encontraron mediciones previas para este paciente.",
                });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error al obtener la última medición:", error);
            res.status(500).json({
                error: "Error al obtener la última lectura médica."
            });
        }
    },

    // ==========================================================================
    // OBTENER MEDICIONES POR RANGO DE FECHAS
    // ==========================================================================
    getMedicionesPorRango: async (req, res) => {
        const { idPaciente } = req.params;
        const { fechaInicio, fechaFin } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: "Se requieren las fechas de inicio y fin (fechaInicio, fechaFin)"
            });
        }

        try {
            const query = `
                SELECT 
                    m.IdMedicion,
                    m.Sistolica,
                    m.Diastolica,
                    m.Pulso,
                    m.Unidad,
                    m.MetodoSincronizacion,
                    m.FechaHoraLectura,
                    m.created_at,
                    u.Nombre AS NombrePaciente,
                    u.ApPaterno AS ApPaternoPaciente,
                    u.ApMaterno AS ApMaternoPaciente,
                    CASE 
                        WHEN m.Sistolica < 120 AND m.Diastolica < 80 THEN 'Normal'
                        WHEN m.Sistolica BETWEEN 120 AND 129 AND m.Diastolica < 80 THEN 'Elevada'
                        WHEN m.Sistolica BETWEEN 130 AND 139 OR m.Diastolica BETWEEN 80 AND 89 THEN 'Hipertensión Grado 1'
                        WHEN m.Sistolica >= 140 OR m.Diastolica >= 90 THEN 'Hipertensión Grado 2'
                        ELSE 'Crisis Hipertensiva'
                    END AS ClasificacionPresion
                FROM MEDICIONES_PRESION m
                JOIN USUARIOS u ON m.IdPaciente = u.IdUsuario
                WHERE m.IdPaciente = $1 
                    AND m.FechaHoraLectura BETWEEN $2 AND $3
                ORDER BY m.FechaHoraLectura DESC`;

            const result = await db.query(query, [idPaciente, fechaInicio, fechaFin]);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener mediciones por rango:", error);
            res.status(500).json({
                error: "Error al obtener las mediciones en el rango de fechas"
            });
        }
    },

    // ==========================================================================
    // OBTENER ESTADÍSTICAS DE MEDICIONES POR PERÍODO
    // ==========================================================================
    getEstadisticasMediciones: async (req, res) => {
        const { idPaciente } = req.params;
        const { periodo } = req.query;

        try {
            let intervalo;
            switch (periodo) {
                case 'dia':
                    intervalo = "INTERVAL '1 day'";
                    break;
                case 'semana':
                    intervalo = "INTERVAL '7 days'";
                    break;
                case 'mes':
                    intervalo = "INTERVAL '30 days'";
                    break;
                case 'trimestre':
                    intervalo = "INTERVAL '90 days'";
                    break;
                default:
                    intervalo = "INTERVAL '30 days'";
            }

            const query = `
                SELECT 
                    DATE(FechaHoraLectura) AS Fecha,
                    COUNT(*) AS TotalMediciones,
                    AVG(Sistolica) AS SistolicaPromedio,
                    AVG(Diastolica) AS DiastolicaPromedio,
                    AVG(Pulso) AS PulsoPromedio,
                    MIN(Sistolica) AS SistolicaMin,
                    MAX(Sistolica) AS SistolicaMax,
                    MIN(Diastolica) AS DiastolicaMin,
                    MAX(Diastolica) AS DiastolicaMax
                FROM MEDICIONES_PRESION
                WHERE IdPaciente = $1 
                    AND FechaHoraLectura >= NOW() - ${intervalo}
                GROUP BY DATE(FechaHoraLectura)
                ORDER BY Fecha DESC`;

            const result = await db.query(query, [idPaciente]);

            res.json({
                periodo: periodo || 'mes',
                estadisticas: result.rows,
                totalDias: result.rows.length
            });
        } catch (error) {
            console.error("Error al obtener estadísticas:", error);
            res.status(500).json({
                error: "Error al obtener estadísticas de mediciones"
            });
        }
    },

    // ==========================================================================
    // ELIMINAR UNA MEDICIÓN ESPECÍFICA
    // ==========================================================================
    eliminarMedicion: async (req, res) => {
        const { idMedicion } = req.params;

        try {
            const medicionExists = await db.query(
                `SELECT IdMedicion FROM MEDICIONES_PRESION WHERE IdMedicion = $1`,
                [idMedicion]
            );

            if (medicionExists.rows.length === 0) {
                return res.status(404).json({
                    error: "Medición no encontrada"
                });
            }

            const result = await db.query(
                `DELETE FROM MEDICIONES_PRESION WHERE IdMedicion = $1 RETURNING *`,
                [idMedicion]
            );

            res.json({
                message: "Medición eliminada correctamente",
                medicion: result.rows[0]
            });
        } catch (error) {
            console.error("Error al eliminar medición:", error);
            res.status(500).json({
                error: "Error al eliminar la medición"
            });
        }
    },

    // ==========================================================================
    // REGISTRAR MÚLTIPLES MEDICIONES (BATCH)
    // ==========================================================================
    registrarMultiplesMediciones: async (req, res) => {
        const { mediciones } = req.body;

        if (!mediciones || !Array.isArray(mediciones) || mediciones.length === 0) {
            return res.status(400).json({
                error: "Se requiere un arreglo de mediciones para registrar"
            });
        }

        try {
            const results = [];
            for (const medicion of mediciones) {
                const {
                    idPaciente,
                    sistolica,
                    diastolica,
                    pulso,
                    metodoSincronizacion
                } = medicion;

                if (!idPaciente || !sistolica || !diastolica || !pulso) {
                    continue;
                }

                const query = `
                    INSERT INTO MEDICIONES_PRESION (
                        IdPaciente, Sistolica, Diastolica, Pulso, 
                        MetodoSincronizacion
                    ) VALUES ($1, $2, $3, $4, $5) 
                    RETURNING *`;

                const result = await db.query(query, [
                    idPaciente,
                    sistolica,
                    diastolica,
                    pulso,
                    metodoSincronizacion || "Bluetooth"
                ]);

                results.push(result.rows[0]);
            }

            res.status(201).json({
                message: `${results.length} mediciones registradas con éxito`,
                mediciones: results,
                totalRegistradas: results.length,
                totalEnviadas: mediciones.length
            });
        } catch (error) {
            console.error("Error al registrar múltiples mediciones:", error);
            res.status(500).json({
                error: "Error al registrar las mediciones"
            });
        }
    },

    // ==========================================================================
    // OBTENER MEDICION DEL TENSIOMETRO (Ejecuta script Python)
    // ==========================================================================
    obtenerMedicionTensiometro: async (req, res) => {
        const { idPaciente } = req.params;

        if (!idPaciente) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere el ID del paciente'
            });
        }

        try {
            // 1. Verificar que el paciente existe y esta activo
            const pacienteExists = await db.query(
                `SELECT u.IdUsuario, u.Nombre, u.ApPaterno 
             FROM USUARIOS u 
             JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario 
             WHERE u.IdUsuario = $1 AND u.Activo = true AND u.deleted_at IS NULL`,
                [idPaciente]
            );

            if (pacienteExists.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Paciente no encontrado o inactivo'
                });
            }

            // 2. Ruta al script Python - CORREGIDO
            const scriptPath = path.join(__dirname, '../../Dispositivo/monitoreo_wearable.py');

            console.log('Script path:', scriptPath);
            console.log('Existe?', fs.existsSync(scriptPath));

            if (!fs.existsSync(scriptPath)) {
                return res.status(500).json({
                    success: false,
                    error: 'Script Python no encontrado',
                    details: `No se encontro el archivo en: ${scriptPath}`
                });
            }

            console.log(`Ejecutando script para paciente ID: ${idPaciente}`);

            // 3. Usar 'python' o 'python3' dependiendo del sistema
            // En Windows, generalmente es 'python'
            const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
            const command = `${pythonCommand} "${scriptPath}" ${idPaciente}`;
            console.log('Comando:', command);

            // 4. Ejecutar el script Python con timeout mejorado
            const resultado = await new Promise((resolve) => {
                let stdoutData = '';
                let stderrData = '';
                let resolved = false;

                const pythonProcess = exec(command, {
                    timeout: 120000, // Aumentado a 2 minutos
                    maxBuffer: 1024 * 1024 * 10,
                    cwd: path.dirname(scriptPath),
                    shell: true,
                    env: {
                        ...process.env,
                        PYTHONIOENCODING: 'utf-8',
                        PYTHONUNBUFFERED: '1'
                    }
                });

                // Capturar stdout en tiempo real
                pythonProcess.stdout.on('data', (data) => {
                    const str = data.toString();
                    stdoutData += str;
                    console.log(`[Python STDOUT] ${str}`);
                });

                pythonProcess.stderr.on('data', (data) => {
                    const str = data.toString();
                    stderrData += str;
                    console.log(`[Python STDERR] ${str}`);
                });

                // Timeout de seguridad
                const timeoutId = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        pythonProcess.kill('SIGTERM');
                        resolve({
                            code: -1,
                            stdout: stdoutData,
                            stderr: stderrData || 'Timeout: El script tardo demasiado en ejecutarse'
                        });
                    }
                }, 120000);

                pythonProcess.on('close', (code) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        console.log(`Script Python finalizado con codigo: ${code}`);
                        resolve({ code, stdout: stdoutData, stderr: stderrData });
                    }
                });

                pythonProcess.on('error', (error) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        console.error('Error al ejecutar Python:', error);
                        resolve({
                            code: -1,
                            stdout: stdoutData,
                            stderr: error.message
                        });
                    }
                });
            });

            // 5. Verificar si el script se ejecutó correctamente
            if (resultado.code !== 0 && resultado.code !== -1) {
                return res.status(500).json({
                    success: false,
                    error: 'Error al ejecutar el script Python',
                    details: resultado.stderr || 'Codigo de salida no cero',
                    stdout: resultado.stdout
                });
            }

            // 6. Buscar la medicion en la salida - MEJORADO
            const fullOutput = resultado.stdout;
            let medicion = null;

            // Patrones de búsqueda (ordenados por prioridad)
            const patterns = [
                // Patrón 1: "Presion Sistolica: 159 mmHg, Presion Diastolica: 40 mmHg, Pulso: 0 bpm"
                {
                    regex: /Presion Sistolica:\s*(\d+).*?Presion Diastolica:\s*(\d+).*?Pulso:\s*(\d+)/i,
                    extract: (m) => ({ sistolica: parseInt(m[1]), diastolica: parseInt(m[2]), pulso: parseInt(m[3]) })
                },
                // Patrón 2: "SYS=159, DIA=40, PULSO=0"
                {
                    regex: /SYS=(\d+),\s*DIA=(\d+),\s*PULSO=(\d+)/i,
                    extract: (m) => ({ sistolica: parseInt(m[1]), diastolica: parseInt(m[2]), pulso: parseInt(m[3]) })
                },
                // Patrón 3: "SYS=159 DIA=40 PULSO=0"
                {
                    regex: /SYS=(\d+)\s+DIA=(\d+)\s+PULSO=(\d+)/i,
                    extract: (m) => ({ sistolica: parseInt(m[1]), diastolica: parseInt(m[2]), pulso: parseInt(m[3]) })
                },
                // Patrón 4: "159/40 mmHg, Pulso: 0"
                {
                    regex: /(\d{2,3})\/(\d{2,3}).*?Pulso:\s*(\d+)/i,
                    extract: (m) => ({ sistolica: parseInt(m[1]), diastolica: parseInt(m[2]), pulso: parseInt(m[3]) })
                },
                // Patrón 5: "159 / 40"
                {
                    regex: /(\d{2,3})\s*\/\s*(\d{2,3})/,
                    extract: (m) => {
                        const sys = parseInt(m[1]);
                        const dia = parseInt(m[2]);
                        // Buscar pulso en toda la salida
                        const pulseMatch = fullOutput.match(/Pulso:\s*(\d+)/i);
                        const pulso = pulseMatch ? parseInt(pulseMatch[1]) : 0;
                        return { sistolica: sys, diastolica: dia, pulso };
                    }
                }
            ];

            // Intentar cada patrón
            for (const pattern of patterns) {
                const match = fullOutput.match(pattern.regex);
                if (match) {
                    medicion = pattern.extract(match);
                    console.log('Medicion encontrada con patrón:', pattern.regex);
                    break;
                }
            }

            // Si no se encontró con patrones específicos, buscar en todo el texto
            if (!medicion) {
                // Buscar números en formato "X/Y"
                const altMatch = fullOutput.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
                if (altMatch) {
                    const sys = parseInt(altMatch[1]);
                    const dia = parseInt(altMatch[2]);
                    if (40 <= sys && sys <= 260 && 30 <= dia && dia <= 200) {
                        const pulseMatch = fullOutput.match(/Pulso:\s*(\d+)/i);
                        medicion = {
                            sistolica: sys,
                            diastolica: dia,
                            pulso: pulseMatch ? parseInt(pulseMatch[1]) : 0
                        };
                        console.log('Medicion encontrada con formato alternativo:', medicion);
                    }
                }
            }

            // Si no hay medición, error
            if (!medicion) {
                console.error('No se encontro ninguna medicion en la salida');
                return res.status(404).json({
                    success: false,
                    error: 'No se encontro ninguna medicion en la salida del script',
                    detalles: fullOutput
                });
            }

            console.log('Medicion final encontrada:', medicion);

            // 7. Validar valores
            const pulsoValido = (medicion.pulso === 0) || (30 <= medicion.pulso && medicion.pulso <= 220);

            if (medicion.sistolica < 40 || medicion.sistolica > 260 ||
                medicion.diastolica < 30 || medicion.diastolica > 200 ||
                !pulsoValido) {
                return res.status(400).json({
                    success: false,
                    error: 'Valores de medicion fuera de rango',
                    medicion: medicion,
                    detalles: {
                        sistolica: medicion.sistolica,
                        diastolica: medicion.diastolica,
                        pulso: medicion.pulso,
                        mensaje: "El pulso puede ser 0 (no detectado) o estar entre 30 y 220 bpm"
                    }
                });
            }

            // 8. Guardar la medicion
            const pulsoFinal = medicion.pulso || 0;
            console.log(`Insertando en DB: idPaciente=${idPaciente}, SYS=${medicion.sistolica}, DIA=${medicion.diastolica}, PULSO=${pulsoFinal}`);

            const query = `
            INSERT INTO MEDICIONES_PRESION (
                IdPaciente, 
                Sistolica, 
                Diastolica, 
                Pulso, 
                MetodoSincronizacion
            ) VALUES ($1, $2, $3, $4, $5) 
            RETURNING *`;

            const result = await db.query(query, [
                parseInt(idPaciente),
                medicion.sistolica,
                medicion.diastolica,
                pulsoFinal,
                'Bluetooth'
            ]);

            console.log('Medicion guardada en DB:', result.rows[0]);

            // 9. Obtener la medicion completa
            const medicionCompleta = await db.query(
                `SELECT 
                m.*,
                u.Nombre AS NombrePaciente,
                u.ApPaterno AS ApPaternoPaciente,
                u.ApMaterno AS ApMaternoPaciente
            FROM MEDICIONES_PRESION m
            JOIN USUARIOS u ON m.IdPaciente = u.IdUsuario
            WHERE m.IdMedicion = $1`,
                [result.rows[0].idmedicion]
            );

            res.status(201).json({
                success: true,
                message: 'Medicion registrada con exito',
                medicion: medicionCompleta.rows[0]
            });

        } catch (error) {
            console.error('Error en obtenerMedicionTensiometro:', error);
            res.status(500).json({
                success: false,
                error: 'Error en el servidor',
                details: error.message
            });
        }
    }
};

module.exports = medicionesController;