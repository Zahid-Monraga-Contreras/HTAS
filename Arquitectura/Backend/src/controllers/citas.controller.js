const db = require("../db/database");

const citasController = {
    // ==========================================================================
    // AGENDAR CITA
    // ==========================================================================
    agendarCita: async (req, res) => {
        const {
            nombrePaciente,
            apPaternoPaciente,
            apMaternoPaciente,
            telefonoPaciente,
            correoPaciente,
            fechaCita,
            horaCita,
            motivo,
            modalidad,
            sintomas,
            idUsuarioPaciente
        } = req.body;

        if (!nombrePaciente || !apPaternoPaciente || !fechaCita || !horaCita) {
            return res.status(400).json({
                error: "Los campos nombre, apellido paterno, fecha y hora son obligatorios"
            });
        }

        const fechaActual = new Date();
        const fechaCitaDate = new Date(fechaCita);
        fechaCitaDate.setHours(0, 0, 0, 0);
        fechaActual.setHours(0, 0, 0, 0);

        if (fechaCitaDate < fechaActual) {
            return res.status(400).json({
                error: "No se pueden agendar citas en fechas pasadas"
            });
        }

        const hora = parseInt(horaCita.split(':')[0]);
        if (hora < 8 || hora >= 20) {
            return res.status(400).json({
                error: "El horario de atención es de 8:00 AM a 8:00 PM"
            });
        }

        try {
            const citasEnHora = await db.query(
                `SELECT COUNT(*) as total 
                 FROM citas 
                 WHERE fechacita = $1 
                   AND horacita = $2 
                   AND estado IN ('Programada', 'Confirmada')`,
                [fechaCita, horaCita]
            );

            if (parseInt(citasEnHora.rows[0].total) >= 3) {
                return res.status(409).json({
                    error: "Horario no disponible, ya hay 3 citas agendadas para esa hora"
                });
            }

            const result = await db.query(
                `INSERT INTO citas (
                    nombrepaciente, 
                    appaternopaciente, 
                    apmaternopaciente, 
                    telefonopaciente, 
                    correopaciente, 
                    fechacita, 
                    horacita, 
                    motivo, 
                    modalidad, 
                    sintomas,
                    estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                RETURNING *`,
                [
                    nombrePaciente.trim(),
                    apPaternoPaciente.trim(),
                    apMaternoPaciente || null,
                    telefonoPaciente || null,
                    correoPaciente || null,
                    fechaCita,
                    horaCita,
                    motivo || null,
                    modalidad || 'Presencial',
                    sintomas || null,
                    'Programada'
                ]
            );

            res.status(201).json({
                message: "Cita agendada con éxito",
                cita: result.rows[0],
                mensajeAdicional: "Se enviará un recordatorio 24 horas antes"
            });
        } catch (error) {
            console.error("Error al agendar cita:", error);
            res.status(500).json({ error: "Error al agendar la cita" });
        }
    },

    // ==========================================================================
    // OBTENER TODAS LAS CITAS - CORREGIDO
    // ==========================================================================
    getAllCitas: async (req, res) => {
        const { fecha, estado, modalidad, busqueda } = req.query;

        try {
            let query = `
                SELECT 
                    c.*,
                    CASE 
                        WHEN c.fechacita < CURRENT_DATE AND c.estado NOT IN ('Cancelada', 'Completada', 'No Asistió') 
                        THEN 'Vencida'
                        WHEN c.fechacita = CURRENT_DATE THEN 'Hoy'
                        WHEN c.fechacita = CURRENT_DATE + INTERVAL '1 day' THEN 'Mañana'
                        ELSE 'Futura'
                    END AS categoriafecha,
                    CASE 
                        WHEN c.estado = 'Programada' AND c.fechacita < CURRENT_DATE THEN 'Atención Urgente'
                        WHEN c.estado = 'Confirmada' AND c.fechacita < CURRENT_DATE THEN 'Atención Urgente'
                        ELSE 'Normal'
                    END AS prioridad
                FROM citas c
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 1;

            if (fecha) {
                query += ` AND c.fechacita = $${paramCount}`;
                params.push(fecha);
                paramCount++;
            }

            if (estado) {
                query += ` AND c.estado = $${paramCount}`;
                params.push(estado);
                paramCount++;
            }

            if (modalidad) {
                query += ` AND c.modalidad = $${paramCount}`;
                params.push(modalidad);
                paramCount++;
            }

            if (busqueda) {
                query += ` AND (
                    c.nombrepaciente ILIKE $${paramCount} OR 
                    c.appaternopaciente ILIKE $${paramCount} OR 
                    c.correopaciente ILIKE $${paramCount}
                )`;
                params.push(`%${busqueda}%`);
                paramCount++;
            }

            query += ` ORDER BY c.fechacita DESC, c.horacita DESC`;

            const result = await db.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener todas las citas:", error);
            res.status(500).json({ error: "Error al obtener el listado de citas" });
        }
    },

    // ==========================================================================
    // OBTENER CITA POR ID
    // ==========================================================================
    getCitaById: async (req, res) => {
        const { idCita } = req.params;

        try {
            const query = `
                SELECT 
                    c.*,
                    CASE 
                        WHEN c.fechacita < CURRENT_DATE AND c.estado NOT IN ('Cancelada', 'Completada', 'No Asistió') 
                        THEN 'Vencida'
                        WHEN c.fechacita = CURRENT_DATE THEN 'Hoy'
                        ELSE 'Futura'
                    END AS categoriafecha
                FROM citas c
                WHERE c.idcita = $1
            `;

            const result = await db.query(query, [idCita]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Cita no encontrada" });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error al obtener cita:", error);
            res.status(500).json({ error: "Error al obtener la cita" });
        }
    },

    // ==========================================================================
    // OBTENER CITAS DE USUARIO - CORREGIDO (eliminado EXTRACT)
    // ==========================================================================
    getCitasUsuario: async (req, res) => {
        const { email } = req.params;
        const { estado, fechaInicio, fechaFin } = req.query;

        try {
            let query = `
                SELECT 
                    c.*,
                    CASE 
                        WHEN c.fechacita < CURRENT_DATE AND c.estado NOT IN ('Cancelada', 'Completada', 'No Asistió') 
                        THEN 'Vencida'
                        WHEN c.fechacita = CURRENT_DATE THEN 'Hoy'
                        ELSE 'Futura'
                    END AS categoriafecha
                FROM citas c
                WHERE c.correopaciente ILIKE $1
            `;

            const params = [email];
            let paramCount = 2;

            if (estado) {
                query += ` AND c.estado = $${paramCount}`;
                params.push(estado);
                paramCount++;
            }

            if (fechaInicio) {
                query += ` AND c.fechacita >= $${paramCount}`;
                params.push(fechaInicio);
                paramCount++;
            }

            if (fechaFin) {
                query += ` AND c.fechacita <= $${paramCount}`;
                params.push(fechaFin);
                paramCount++;
            }

            query += ` ORDER BY c.fechacita DESC, c.horacita DESC`;

            const result = await db.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener citas:", error);
            res.status(500).json({ error: "Error al obtener el historial de citas" });
        }
    },

    // ==========================================================================
    // OBTENER CITAS POR FECHA
    // ==========================================================================
    getCitasByFecha: async (req, res) => {
        const { fecha } = req.params;

        try {
            const query = `
                SELECT 
                    c.*,
                    EXTRACT(HOUR FROM c.horacita) AS hora,
                    EXTRACT(MINUTE FROM c.horacita) AS minuto,
                    CASE 
                        WHEN c.estado = 'Programada' THEN '#FFA726'
                        WHEN c.estado = 'Confirmada' THEN '#66BB6A'
                        WHEN c.estado = 'Completada' THEN '#42A5F5'
                        WHEN c.estado = 'Cancelada' THEN '#EF5350'
                        WHEN c.estado = 'No Asistió' THEN '#AB47BC'
                        ELSE '#78909C'
                    END AS colorevento
                FROM citas c
                WHERE c.fechacita = $1
                ORDER BY c.horacita ASC
            `;

            const result = await db.query(query, [fecha]);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener citas por fecha:", error);
            res.status(500).json({ error: "Error al obtener citas del día" });
        }
    },

    // ==========================================================================
    // OBTENER CITAS DE HOY
    // ==========================================================================
    getCitasHoy: async (req, res) => {
        try {
            const query = `
                SELECT 
                    c.*,
                    CASE 
                        WHEN c.horacita < CURRENT_TIME THEN 'Pasada'
                        ELSE 'Pendiente'
                    END AS estadotiempo,
                    EXTRACT(HOUR FROM c.horacita) AS hora,
                    EXTRACT(MINUTE FROM c.horacita) AS minuto
                FROM citas c
                WHERE c.fechacita = CURRENT_DATE
                  AND c.estado NOT IN ('Cancelada', 'Completada')
                ORDER BY c.horacita ASC
            `;

            const result = await db.query(query);

            const citasPendientes = result.rows.filter(c => c.estadotiempo === 'Pendiente');
            const citasPasadas = result.rows.filter(c => c.estadotiempo === 'Pasada');

            res.json({
                total: result.rows.length,
                pendientes: citasPendientes.length,
                pasadas: citasPasadas.length,
                citas: result.rows
            });
        } catch (error) {
            console.error("Error al obtener citas de hoy:", error);
            res.status(500).json({ error: "Error al obtener citas del día" });
        }
    },

    // ==========================================================================
    // ACTUALIZAR ESTADO DE CITA
    // ==========================================================================
    actualizarEstadoCita: async (req, res) => {
        const { idCita } = req.params;
        const { estado, notasDoctor } = req.body;

        const estadosPermitidos = ['Programada', 'Confirmada', 'Completada', 'Cancelada', 'No Asistió'];
        if (!estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                error: `Estado inválido. Los estados permitidos son: ${estadosPermitidos.join(', ')}`
            });
        }

        try {
            const citaExists = await db.query(
                `SELECT idcita, estado, fechacita FROM citas WHERE idcita = $1`,
                [idCita]
            );

            if (citaExists.rows.length === 0) {
                return res.status(404).json({ error: "Cita no encontrada" });
            }

            const citaActual = citaExists.rows[0];

            if (citaActual.estado === 'Cancelada' || citaActual.estado === 'Completada') {
                return res.status(400).json({
                    error: `No se puede modificar una cita que ya está ${citaActual.estado.toLowerCase()}`
                });
            }

            if (estado === 'Completada' && new Date(citaActual.fechacita) > new Date()) {
                return res.status(400).json({
                    error: "No se puede completar una cita programada para el futuro"
                });
            }

            const result = await db.query(
                `UPDATE citas 
                SET estado = $1, 
                    notasdoctor = COALESCE($2, notasdoctor), 
                    updated_at = CURRENT_TIMESTAMP
                WHERE idcita = $3 
                RETURNING *`,
                [estado, notasDoctor, idCita]
            );

            res.json({
                message: `Cita ${estado.toLowerCase()} con éxito`,
                cita: result.rows[0]
            });
        } catch (error) {
            console.error("Error al actualizar cita:", error);
            res.status(500).json({ error: "Error al actualizar el estado de la cita" });
        }
    },

    // ==========================================================================
    // CANCELAR CITA
    // ==========================================================================
    cancelarCita: async (req, res) => {
        const { idCita } = req.params;
        const { motivoCancelacion } = req.body;

        try {
            const result = await db.query(
                `UPDATE citas 
                SET estado = 'Cancelada', 
                    notasdoctor = COALESCE($2, CONCAT('Cancelada por: ', $2)), 
                    updated_at = CURRENT_TIMESTAMP
                WHERE idcita = $1 
                RETURNING *`,
                [idCita, motivoCancelacion || 'Cancelada por el paciente']
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Cita no encontrada" });
            }

            res.json({
                message: "Cita cancelada con éxito",
                cita: result.rows[0]
            });
        } catch (error) {
            console.error("Error al cancelar cita:", error);
            res.status(500).json({ error: "Error al cancelar la cita" });
        }
    },

    // ==========================================================================
    // ACTUALIZAR CITA COMPLETA
    // ==========================================================================
    actualizarCita: async (req, res) => {
        const { idCita } = req.params;
        const {
            nombrePaciente,
            apPaternoPaciente,
            apMaternoPaciente,
            telefonoPaciente,
            correoPaciente,
            fechaCita,
            horaCita,
            motivo,
            modalidad,
            sintomas,
            notasDoctor
        } = req.body;

        try {
            const citaExists = await db.query(
                `SELECT idcita, estado FROM citas WHERE idcita = $1`,
                [idCita]
            );

            if (citaExists.rows.length === 0) {
                return res.status(404).json({ error: "Cita no encontrada" });
            }

            if (citaExists.rows[0].estado === 'Cancelada' || citaExists.rows[0].estado === 'Completada') {
                return res.status(400).json({
                    error: `No se puede modificar una cita que ya está ${citaExists.rows[0].estado.toLowerCase()}`
                });
            }

            if (fechaCita && new Date(fechaCita) < new Date()) {
                return res.status(400).json({
                    error: "No se puede reprogramar una cita en fecha pasada"
                });
            }

            const result = await db.query(
                `UPDATE citas 
                SET 
                    nombrepaciente = COALESCE($1, nombrepaciente),
                    appaternopaciente = COALESCE($2, appaternopaciente),
                    apmaternopaciente = $3,
                    telefonopaciente = $4,
                    correopaciente = $5,
                    fechacita = COALESCE($6, fechacita),
                    horacita = COALESCE($7, horacita),
                    motivo = $8,
                    modalidad = COALESCE($9, modalidad),
                    sintomas = $10,
                    notasdoctor = $11,
                    updated_at = CURRENT_TIMESTAMP
                WHERE idcita = $12 
                RETURNING *`,
                [
                    nombrePaciente || null,
                    apPaternoPaciente || null,
                    apMaternoPaciente || null,
                    telefonoPaciente || null,
                    correoPaciente || null,
                    fechaCita || null,
                    horaCita || null,
                    motivo || null,
                    modalidad || null,
                    sintomas || null,
                    notasDoctor || null,
                    idCita
                ]
            );

            res.json({
                message: "Cita actualizada con éxito",
                cita: result.rows[0]
            });
        } catch (error) {
            console.error("Error al actualizar cita:", error);
            res.status(500).json({ error: "Error al actualizar la cita" });
        }
    },

    // ==========================================================================
    // ELIMINAR CITA
    // ==========================================================================
    eliminarCita: async (req, res) => {
        const { idCita } = req.params;

        try {
            const citaExists = await db.query(
                `SELECT idcita, estado FROM citas WHERE idcita = $1`,
                [idCita]
            );

            if (citaExists.rows.length === 0) {
                return res.status(404).json({ error: "Cita no encontrada" });
            }

            const estado = citaExists.rows[0].estado;
            if (estado === 'Completada' || estado === 'Confirmada') {
                return res.status(400).json({
                    error: `No se puede eliminar una cita con estado '${estado}'. Considere cancelarla en su lugar.`
                });
            }

            const result = await db.query(
                `DELETE FROM citas WHERE idcita = $1 RETURNING *`,
                [idCita]
            );

            res.json({
                message: "Cita eliminada con éxito",
                cita: result.rows[0]
            });
        } catch (error) {
            console.error("Error al eliminar cita:", error);
            res.status(500).json({ error: "Error al eliminar la cita" });
        }
    },

    // ==========================================================================
    // OBTENER ESTADÍSTICAS DE CITAS
    // ==========================================================================
    getEstadisticasCitas: async (req, res) => {
        try {
            const query = `
                SELECT 
                    COUNT(*) AS totalcitas,
                    COUNT(CASE WHEN estado = 'Programada' THEN 1 END) AS programadas,
                    COUNT(CASE WHEN estado = 'Confirmada' THEN 1 END) AS confirmadas,
                    COUNT(CASE WHEN estado = 'Completada' THEN 1 END) AS completadas,
                    COUNT(CASE WHEN estado = 'Cancelada' THEN 1 END) AS canceladas,
                    COUNT(CASE WHEN estado = 'No Asistió' THEN 1 END) AS noasistio,
                    COUNT(CASE WHEN modalidad = 'Presencial' THEN 1 END) AS presenciales,
                    COUNT(CASE WHEN modalidad = 'Virtual' THEN 1 END) AS virtuales,
                    COUNT(CASE WHEN fechacita >= CURRENT_DATE AND estado IN ('Programada', 'Confirmada') THEN 1 END) AS citasfuturas,
                    COUNT(CASE WHEN fechacita < CURRENT_DATE AND estado IN ('Programada', 'Confirmada') THEN 1 END) AS citasvencidas
                FROM citas
            `;

            const result = await db.query(query);
            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error al obtener estadísticas:", error);
            res.status(500).json({ error: "Error al obtener estadísticas de citas" });
        }
    }
};

module.exports = citasController;