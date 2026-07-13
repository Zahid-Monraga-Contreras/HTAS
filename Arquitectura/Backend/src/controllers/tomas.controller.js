const db = require("../db/database");

const tomasController = {
    // ==========================================================================
    // OBTENER TODAS LAS TOMAS DE UN TRATAMIENTO
    // ==========================================================================
    getTomasByTratamiento: async (req, res) => {
        const { idTratamiento } = req.params;

        try {
            const query = `
                SELECT 
                    rt.IdTomar AS id,
                    rt.IdTratamiento AS "idTratamiento",
                    rt.IdAcompananteQueRegistro AS "idAcompanante",
                    rt.FechaHoraProgramada AS "fechaProgramada",
                    rt.FechaHoraRealizada AS "fechaRealizada",
                    rt.EstadoTomar AS estado,
                    rt.NotasTomas AS notas,
                    rt.created_at AS "createdAt"
                FROM REGISTRO_TOMAS rt
                WHERE rt.IdTratamiento = $1
                ORDER BY rt.FechaHoraProgramada DESC
            `;

            const result = await db.query(query, [idTratamiento]);
            return res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener tomas del tratamiento:", error);
            return res.status(500).json({
                error: "Error al obtener las tomas del tratamiento",
                detalle: error.message
            });
        }
    },

    // ==========================================================================
    // REGISTRAR NUEVA TOMA
    // ==========================================================================
    registrarToma: async (req, res) => {
        const {
            idTratamiento,
            fechaHoraProgramada,
            idAcompananteQueRegistro,
            notasTomas
        } = req.body;

        if (!idTratamiento || !fechaHoraProgramada) {
            return res.status(400).json({
                error: "Faltan campos obligatorios: idTratamiento, fechaHoraProgramada"
            });
        }

        try {
            const result = await db.query(
                `INSERT INTO REGISTRO_TOMAS (
                    IdTratamiento,
                    FechaHoraProgramada,
                    IdAcompananteQueRegistro,
                    NotasTomas,
                    EstadoTomar
                ) VALUES ($1, $2, $3, $4, 'Pendiente') RETURNING *`,
                [
                    idTratamiento,
                    fechaHoraProgramada,
                    idAcompananteQueRegistro || null,
                    notasTomas || null
                ]
            );

            res.status(201).json({
                message: "Toma registrada con éxito",
                toma: result.rows[0]
            });
        } catch (error) {
            console.error("Error al registrar toma:", error);
            res.status(500).json({
                error: "Error al registrar la toma",
                detalle: error.message
            });
        }
    },

    // ==========================================================================
    // ACTUALIZAR ESTADO DE UNA TOMA
    // ==========================================================================
    actualizarEstadoToma: async (req, res) => {
        const { id } = req.params;
        const { estado, fechaHoraRealizada, notasTomas } = req.body;

        const estadosPermitidos = ['Pendiente', 'Tomada', 'Omitida', 'Retrasada'];
        if (!estado || !estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                error: `Estado inválido. Los estados permitidos son: ${estadosPermitidos.join(', ')}`
            });
        }

        try {
            let fechaRealizada = fechaHoraRealizada;
            if (estado === 'Tomada' && !fechaRealizada) {
                fechaRealizada = new Date().toISOString();
            }

            const result = await db.query(
                `UPDATE REGISTRO_TOMAS 
                SET 
                    EstadoTomar = $1,
                    FechaHoraRealizada = COALESCE($2, FechaHoraRealizada),
                    NotasTomas = COALESCE($3, NotasTomas)
                WHERE IdTomar = $4 
                RETURNING *`,
                [estado, fechaRealizada, notasTomas, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Toma no encontrada" });
            }

            res.json({
                message: "Estado de la toma actualizado con éxito",
                toma: result.rows[0]
            });
        } catch (error) {
            console.error("Error al actualizar estado de toma:", error);
            res.status(500).json({
                error: "Error al actualizar el estado de la toma",
                detalle: error.message
            });
        }
    },

    // ==========================================================================
    // GENERAR TOMAS PROGRAMADAS AUTOMÁTICAMENTE
    // ==========================================================================
    generarTomasProgramadas: async (req, res) => {
        const { idTratamiento, fechaInicio, fechaFin, frecuenciaHoras } = req.body;

        if (!idTratamiento || !fechaInicio || !fechaFin || !frecuenciaHoras) {
            return res.status(400).json({
                error: "Faltan campos obligatorios: idTratamiento, fechaInicio, fechaFin, frecuenciaHoras"
            });
        }

        try {
            // Verificar que el tratamiento existe
            const tratamientoExists = await db.query(
                `SELECT IdTratamiento, Activo FROM TRATAMIENTOS WHERE IdTratamiento = $1`,
                [idTratamiento]
            );

            console.log('Tratamiento encontrado:', tratamientoExists.rows);

            if (tratamientoExists.rows.length === 0) {
                return res.status(404).json({
                    error: "Tratamiento no encontrado",
                    detalle: `No existe tratamiento con ID ${idTratamiento}`
                });
            }

            if (!tratamientoExists.rows[0].activo) {
                return res.status(400).json({ error: "El tratamiento está inactivo" });
            }

            const inicio = new Date(fechaInicio);
            const fin = new Date(fechaFin);
            const tomasGeneradas = [];
            const frecuenciaMs = frecuenciaHoras * 60 * 60 * 1000;

            // Ajustar la hora de inicio a las 8:00 AM
            let fechaActual = new Date(inicio);
            fechaActual.setHours(8, 0, 0, 0);

            let contador = 0;
            const maxTomas = 200;

            while (fechaActual <= fin && contador < maxTomas) {
                tomasGeneradas.push({
                    idTratamiento: idTratamiento,
                    fechaHoraProgramada: new Date(fechaActual)
                });

                fechaActual = new Date(fechaActual.getTime() + frecuenciaMs);
                contador++;
            }

            if (tomasGeneradas.length === 0) {
                return res.status(400).json({
                    error: "No se pudo generar ninguna toma. Verifique las fechas y frecuencia."
                });
            }

            const resultados = [];
            for (const toma of tomasGeneradas) {
                const result = await db.query(
                    `INSERT INTO REGISTRO_TOMAS (
                        IdTratamiento,
                        FechaHoraProgramada,
                        EstadoTomar
                    ) VALUES ($1, $2, 'Pendiente') RETURNING *`,
                    [toma.idTratamiento, toma.fechaHoraProgramada.toISOString()]
                );
                resultados.push(result.rows[0]);
            }

            res.status(201).json({
                message: `${resultados.length} tomas programadas con éxito`,
                totalGeneradas: resultados.length,
                tomas: resultados
            });
        } catch (error) {
            console.error("Error al generar tomas programadas:", error);
            res.status(500).json({
                error: "Error al generar las tomas programadas",
                detalle: error.message,
                stack: error.stack
            });
        }
    },

    // ==========================================================================
    // OBTENER ESTADÍSTICAS DE TOMAS
    // ==========================================================================
    getEstadisticasTomas: async (req, res) => {
        const { idTratamiento } = req.params;

        try {
            const query = `
                SELECT 
                    COUNT(*) AS total,
                    COUNT(CASE WHEN EstadoTomar = 'Tomada' THEN 1 END) AS tomadas,
                    COUNT(CASE WHEN EstadoTomar = 'Pendiente' THEN 1 END) AS pendientes,
                    COUNT(CASE WHEN EstadoTomar = 'Omitida' THEN 1 END) AS omitidas,
                    COUNT(CASE WHEN EstadoTomar = 'Retrasada' THEN 1 END) AS retrasadas,
                    COUNT(CASE WHEN EstadoTomar = 'Tomada' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) AS porcentajeCumplimiento
                FROM REGISTRO_TOMAS
                WHERE IdTratamiento = $1
            `;

            const result = await db.query(query, [idTratamiento]);
            const stats = result.rows[0] || {};

            res.json({
                totalTomas: parseInt(stats.total) || 0,
                tomasCompletadas: parseInt(stats.tomadas) || 0,
                tomasPendientes: parseInt(stats.pendientes) || 0,
                tomasOmitidas: parseInt(stats.omitidas) || 0,
                tomasRetrasadas: parseInt(stats.retrasadas) || 0,
                porcentajeCumplimiento: Math.round(parseFloat(stats.porcentajecumplimiento) || 0)
            });
        } catch (error) {
            console.error("Error al obtener estadísticas de tomas:", error);
            res.status(500).json({
                error: "Error al obtener estadísticas de tomas",
                detalle: error.message
            });
        }
    },

    // ==========================================================================
    // ELIMINAR UNA TOMA
    // ==========================================================================
    eliminarToma: async (req, res) => {
        const { id } = req.params;

        try {
            const result = await db.query(
                `DELETE FROM REGISTRO_TOMAS WHERE IdTomar = $1 RETURNING *`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Toma no encontrada" });
            }

            res.json({
                message: "Toma eliminada con éxito",
                toma: result.rows[0]
            });
        } catch (error) {
            console.error("Error al eliminar toma:", error);
            res.status(500).json({
                error: "Error al eliminar la toma",
                detalle: error.message
            });
        }
    }
};

module.exports = tomasController;