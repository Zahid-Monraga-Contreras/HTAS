const db = require("../db/database");

const medicionesController = {
    // Registrar una nueva medición (con o sin dispositivo)
    registrarMedicion: async (req, res) => {
        const {
            idPaciente,
            sistolica,
            diastolica,
            pulso,
            metodoSincronizacion,
            idDispositivo,  // Nuevo: opcional, ID del dispositivo que tomó la medición
            notas           // Nuevo: observaciones adicionales
        } = req.body;

        // Validación estricta de campos requeridos
        if (!idPaciente || !sistolica || !diastolica || !pulso) {
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

            // Si se proporciona un dispositivo, validar que existe y está asignado al paciente
            if (idDispositivo) {
                const dispositivoExists = await db.query(
                    `SELECT IdDispositivo, Nombre, IdPacienteAsociado 
                     FROM DISPOSITIVOS 
                     WHERE IdDispositivo = $1 AND Activo = true`,
                    [idDispositivo]
                );

                if (dispositivoExists.rows.length === 0) {
                    return res.status(404).json({
                        error: "Dispositivo no encontrado o inactivo"
                    });
                }

                // Verificar que el dispositivo está asignado al paciente
                const dispositivoPaciente = dispositivoExists.rows[0];
                if (dispositivoPaciente.idpacienteasociado !== idPaciente) {
                    return res.status(400).json({
                        error: "El dispositivo no está asignado a este paciente"
                    });
                }

                // Actualizar la última sincronización del dispositivo
                await db.query(
                    `UPDATE DISPOSITIVOS 
                     SET UltimaSincronizacion = CURRENT_TIMESTAMP 
                     WHERE IdDispositivo = $1`,
                    [idDispositivo]
                );
            }

            // Validar rangos fisiológicos
            if (
                sistolica < 40 || sistolica > 260 ||
                diastolica < 30 || diastolica > 200 ||
                pulso < 30 || pulso > 220
            ) {
                return res.status(400).json({
                    error: "Los valores de la medición están fuera de los rangos fisiológicos permitidos.",
                });
            }

            // Insertar la medición con los nuevos campos
            const query = `
                INSERT INTO MEDICIONES_PRESION (
                    IdPaciente, 
                    Sistolica, 
                    Diastolica, 
                    Pulso, 
                    MetodoSincronizacion,
                    IdDispositivo,
                    Notas
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
                RETURNING *`;

            const result = await db.query(query, [
                idPaciente,
                sistolica,
                diastolica,
                pulso,
                metodoSincronizacion || "Bluetooth",
                idDispositivo || null,
                notas || null
            ]);

            // Obtener la medición completa con información del dispositivo
            const medicionCompleta = await db.query(
                `SELECT 
                    m.*,
                    u.Nombre AS NombrePaciente,
                    u.ApPaterno AS ApPaternoPaciente,
                    u.ApMaterno AS ApMaternoPaciente,
                    d.Nombre AS NombreDispositivo,
                    d.DireccionMac AS MacDispositivo
                FROM MEDICIONES_PRESION m
                JOIN USUARIOS u ON m.IdPaciente = u.IdUsuario
                LEFT JOIN DISPOSITIVOS d ON m.IdDispositivo = d.IdDispositivo
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

    // Obtener todas las mediciones de un paciente con información completa
    getMedicionesPaciente: async (req, res) => {
        const { idPaciente } = req.params;
        const { limite, orden } = req.query; // Parámetros opcionales para paginación

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
                    m.Notas,
                    m.created_at,
                    d.Nombre AS NombreDispositivo,
                    d.DireccionMac AS MacDispositivo,
                    -- Clasificación de la presión arterial
                    CASE 
                        WHEN m.Sistolica < 120 AND m.Diastolica < 80 THEN 'Normal'
                        WHEN m.Sistolica BETWEEN 120 AND 129 AND m.Diastolica < 80 THEN 'Elevada'
                        WHEN m.Sistolica BETWEEN 130 AND 139 OR m.Diastolica BETWEEN 80 AND 89 THEN 'Hipertensión Grado 1'
                        WHEN m.Sistolica >= 140 OR m.Diastolica >= 90 THEN 'Hipertensión Grado 2'
                        ELSE 'Crisis Hipertensiva'
                    END AS ClasificacionPresion
                FROM MEDICIONES_PRESION m
                LEFT JOIN DISPOSITIVOS d ON m.IdDispositivo = d.IdDispositivo
                WHERE m.IdPaciente = $1
                ORDER BY m.FechaHoraLectura DESC
            `;

            const params = [idPaciente];

            // Agregar límite si se especifica
            if (limite && !isNaN(limite)) {
                query += ` LIMIT $${params.length + 1}`;
                params.push(parseInt(limite));
            }

            const result = await db.query(query, params);

            // Calcular estadísticas básicas
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

    // Obtener la última medición de un paciente
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
                    m.Notas,
                    d.Nombre AS NombreDispositivo,
                    d.DireccionMac AS MacDispositivo,
                    CASE 
                        WHEN m.Sistolica < 120 AND m.Diastolica < 80 THEN 'Normal'
                        WHEN m.Sistolica BETWEEN 120 AND 129 AND m.Diastolica < 80 THEN 'Elevada'
                        WHEN m.Sistolica BETWEEN 130 AND 139 OR m.Diastolica BETWEEN 80 AND 89 THEN 'Hipertensión Grado 1'
                        WHEN m.Sistolica >= 140 OR m.Diastolica >= 90 THEN 'Hipertensión Grado 2'
                        ELSE 'Crisis Hipertensiva'
                    END AS ClasificacionPresion
                FROM MEDICIONES_PRESION m
                LEFT JOIN DISPOSITIVOS d ON m.IdDispositivo = d.IdDispositivo
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

    // Obtener mediciones por rango de fechas
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
                    m.Notas,
                    d.Nombre AS NombreDispositivo,
                    CASE 
                        WHEN m.Sistolica < 120 AND m.Diastolica < 80 THEN 'Normal'
                        WHEN m.Sistolica BETWEEN 120 AND 129 AND m.Diastolica < 80 THEN 'Elevada'
                        WHEN m.Sistolica BETWEEN 130 AND 139 OR m.Diastolica BETWEEN 80 AND 89 THEN 'Hipertensión Grado 1'
                        WHEN m.Sistolica >= 140 OR m.Diastolica >= 90 THEN 'Hipertensión Grado 2'
                        ELSE 'Crisis Hipertensiva'
                    END AS ClasificacionPresion
                FROM MEDICIONES_PRESION m
                LEFT JOIN DISPOSITIVOS d ON m.IdDispositivo = d.IdDispositivo
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

    // Obtener estadísticas de mediciones por período
    getEstadisticasMediciones: async (req, res) => {
        const { idPaciente } = req.params;
        const { periodo } = req.query; // 'dia', 'semana', 'mes', 'trimestre'

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

    // Eliminar una medición específica (solo si es necesario)
    eliminarMedicion: async (req, res) => {
        const { idMedicion } = req.params;

        try {
            // Verificar que la medición existe
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

    // Registrar múltiples mediciones (batch)
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
                    metodoSincronizacion,
                    idDispositivo,
                    notas
                } = medicion;

                // Validar cada medición
                if (!idPaciente || !sistolica || !diastolica || !pulso) {
                    continue; // Saltar mediciones inválidas
                }

                const query = `
                    INSERT INTO MEDICIONES_PRESION (
                        IdPaciente, Sistolica, Diastolica, Pulso, 
                        MetodoSincronizacion, IdDispositivo, Notas
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
                    RETURNING *`;

                const result = await db.query(query, [
                    idPaciente,
                    sistolica,
                    diastolica,
                    pulso,
                    metodoSincronizacion || "Bluetooth",
                    idDispositivo || null,
                    notas || null
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
    }
};

module.exports = medicionesController;