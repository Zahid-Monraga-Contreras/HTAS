const db = require("../db/database");

const medicionesController = {
    registrarMedicion: async (req, res) => {
        const { idPaciente, sistolica, diastolica, pulso, metodoSincronizacion } =
            req.body;

        // Validación estricta de campos requeridos
        if (!idPaciente || !sistolica || !diastolica || !pulso) {
            return res.status(400).json({
                error:
                    "Todos los campos de la medición (idPaciente, sistolica, diastolica, pulso) son obligatorios.",
            });
        }

        try {
            // Validamos que los rangos numéricos sean lógicos antes de tocar la BD
            // (así evitamos que falle por los CHECK de la tabla si el Bluetooth mandó basura)
            if (
                sistolica < 40 ||
                sistolica > 260 ||
                diastolica < 30 ||
                diastolica > 200 ||
                pulso < 30 ||
                pulso > 220
            ) {
                return res.status(400).json({
                    error:
                        "Los valores de la medición están fuera de los rangos fisiológicos permitidos.",
                });
            }

            const query = `
        INSERT INTO MEDICIONES_PRESION (IdPaciente, Sistolica, Diastolica, Pulso, MetodoSincronizacion)
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING *`;

            const result = await db.query(query, [
                idPaciente,
                sistolica,
                diastolica,
                pulso,
                metodoSincronizacion || "Bluetooth", // Si no se manda, por defecto es Bluetooth
            ]);

            res.status(201).json({
                message: "¡Medición del baumanómetro registrada con éxito!",
                medicion: result.rows[0],
            });
        } catch (error) {
            console.error("Error crítico al registrar medición:", error);
            res.status(500).json({
                error: "Error interno del servidor al guardar la lectura médica.",
            });
        }
    },

    getMedicionesPaciente: async (req, res) => {
        const { idPaciente } = req.params;

        try {
            // Obtenemos el historial ordenado de la más reciente a la más antigua
            const query = `
        SELECT IdMedicion, Sistolica, Diastolica, Pulso, Unidad, MetodoSincronizacion, FechaHoraLectura
        FROM MEDICIONES_PRESION
        WHERE IdPaciente = $1
        ORDER BY FechaHoraLectura DESC`;

            const result = await db.query(query, [idPaciente]);

            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener mediciones:", error);
            res
                .status(500)
                .json({ error: "Error al obtener el historial de mediciones." });
        }
    },

    getUltimaMedicionPaciente: async (req, res) => {
        const { idPaciente } = req.params;

        try {
            // Trae únicamente la última fila usando LIMIT 1
            const query = `
        SELECT IdMedicion, Sistolica, Diastolica, Pulso, Unidad, MetodoSincronizacion, FechaHoraLectura
        FROM MEDICIONES_PRESION
        WHERE IdPaciente = $1
        ORDER BY FechaHoraLectura DESC
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
            res
                .status(500)
                .json({ error: "Error al obtener la última lectura médica." });
        }
    },
};

module.exports = medicionesController;