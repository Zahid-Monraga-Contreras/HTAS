const db = require("../db/database");

const medicamentosController = {
    getMedicamentos: async (req, res) => {
        try {
            const result = await db.query(
                "SELECT * FROM MEDICAMENTOS ORDER BY IdMedicamento DESC",
            );
            return res.json(result.rows);
        } catch (error) {
            console.error("❌ Error al obtener medicamentos:", error);
            return res
                .status(500)
                .json({ error: "Error al obtener la lista de medicamentos" });
        }
    },

    crearMedicamento: async (req, res) => {
        // Flexibilidad de mapeo: Soportamos tanto camelCase como minúsculas puras del Frontend
        const nombreComercial =
            req.body.nombreComercial || req.body.nombrecomercial;
        const sustanciaActiva =
            req.body.sustanciaActiva || req.body.sustanciaactiva;
        const presentacion = req.body.presentacion;
        const concentracion = req.body.concentracion;
        const laboratorio = req.body.laboratorio;
        const indicacionesGenerales =
            req.body.indicacionesGenerales || req.body.indicacionesgenerales;

        // Validación de seguridad para evitar inserciones vacías o nulas inesperadas
        if (!nombreComercial || nombreComercial.trim() === "") {
            return res
                .status(400)
                .json({ error: "El campo Nombre Comercial es obligatorio." });
        }

        try {
            const result = await db.query(
                `INSERT INTO MEDICAMENTOS (NombreComercial, SustanciaActiva, Presentacion, Concentracion, Laboratorio, IndicacionesGenerales) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [
                    nombreComercial,
                    sustanciaActiva || null,
                    presentacion || null,
                    concentracion || null,
                    laboratorio || null,
                    indicacionesGenerales || null,
                ],
            );

            // Retorna éxito explícito de inmediato para liberar los Spinners del frontend
            return res.status(201).json({
                message: "Medicamento creado con éxito",
                medicamento: result.rows[0],
            });
        } catch (error) {
            // Siempre responder con un código HTTP de error para evitar congelar la UI de Angular
            return res.status(500).json({
                error: "Error interno en el servidor al registrar el medicamento",
            });
        }
    },

    actualizarMedicamento: async (req, res) => {
        const { id } = req.params;

        const nombreComercial =
            req.body.nombreComercial || req.body.nombrecomercial;
        const sustanciaActiva =
            req.body.sustanciaActiva || req.body.sustanciaactiva;
        const presentacion = req.body.presentacion;
        const concentracion = req.body.concentracion;
        const laboratorio = req.body.laboratorio;
        const indicacionesGenerales =
            req.body.indicacionesGenerales || req.body.indicacionesgenerales;

        if (!nombreComercial || nombreComercial.trim() === "") {
            return res.status(400).json({
                error:
                    "El nombre comercial no puede estar vacío durante la actualización.",
            });
        }

        try {
            const result = await db.query(
                `UPDATE MEDICAMENTOS 
         SET NombreComercial = $1, SustanciaActiva = $2, Presentacion = $3, Concentracion = $4, Laboratorio = $5, IndicacionesGenerales = $6
         WHERE IdMedicamento = $7 RETURNING *`,
                [
                    nombreComercial,
                    sustanciaActiva || null,
                    presentacion || null,
                    concentracion || null,
                    laboratorio || null,
                    indicacionesGenerales || null,
                    id,
                ],
            );

            if (result.rows.length === 0) {
                return res
                    .status(404)
                    .json({ error: "El medicamento solicitado no existe." });
            }

            return res.json({
                message: "Medicamento actualizado con éxito",
                medicamento: result.rows[0],
            });
        } catch (error) {
            console.error("❌ Error crítico al actualizar medicamento:", error);
            return res.status(500).json({
                error: "Error interno en el servidor al actualizar el medicamento",
            });
        }
    },

    eliminarMedicamento: async (req, res) => {
        const { id } = req.params;
        console.log(`-> Petición de eliminación para ID: ${id}`);

        try {
            const result = await db.query(
                "DELETE FROM MEDICAMENTOS WHERE IdMedicamento = $1 RETURNING *",
                [id],
            );

            if (result.rows.length === 0) {
                return res
                    .status(404)
                    .json({ error: "Medicamento no encontrado para eliminar." });
            }

            return res.json({ message: "Medicamento eliminado correctamente" });
        } catch (error) {
            console.error("❌ Error crítico al eliminar medicamento:", error);
            return res.status(500).json({
                error:
                    "No se puede eliminar el medicamento debido a que está asociado a otros registros activos (restricción de llave foránea).",
            });
        }
    },
};

module.exports = medicamentosController;