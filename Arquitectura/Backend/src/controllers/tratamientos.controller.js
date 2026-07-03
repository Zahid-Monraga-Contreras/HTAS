const db = require("../db/database");

const tratamientosController = {
    getTratamientos: async (req, res) => {
        try {
            // Traemos el tratamiento junto con el nombre del paciente y del medicamento para que se vea premium en tu tabla
            const queryText = `
        SELECT t.*, 
               u.Nombre AS NombrePaciente, u.ApPaterno AS ApPaternoPaciente,
               m.NombreComercial AS NombreMedicamento
        FROM TRATAMIENTOS t
        JOIN USUARIOS u ON t.IdPaciente = u.IdUsuario
        JOIN MEDICAMENTOS m ON t.IdMedicamento = m.IdMedicamento
        ORDER BY t.IdTratamiento DESC
      `;
            const result = await db.query(queryText);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener tratamientos:", error);
            res
                .status(500)
                .json({ error: "Error al obtener la lista de tratamientos" });
        }
    },

    crearTratamiento: async (req, res) => {
        const {
            idPaciente,
            idDoctor,
            idMedicamento,
            dosis,
            frecuenciaHoras,
            fechaInicio,
            fechaFin,
            notasInstrucciones,
            activo,
        } = req.body;
        try {
            const result = await db.query(
                `INSERT INTO TRATAMIENTOS (IdPaciente, IdDoctor, IdMedicamento, Dosis, FrecuenciaHoras, FechaInicio, FechaFin, NotasInstrucciones, Activo) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                    idPaciente,
                    idDoctor || null,
                    idMedicamento,
                    dosis,
                    frecuenciaHoras,
                    fechaInicio,
                    fechaFin,
                    notasInstrucciones,
                    activo ?? true,
                ],
            );
            res.status(201).json({
                message: "Tratamiento creado con éxito",
                tratamiento: result.rows[0],
            });
        } catch (error) {
            console.error("Error al crear tratamiento:", error);
            res.status(500).json({ error: "Error al registrar el tratamiento" });
        }
    },

    actualizarTratamiento: async (req, res) => {
        const { id } = req.params;
        const {
            dosis,
            frecuenciaHoras,
            fechaInicio,
            fechaFin,
            notasInstrucciones,
            activo,
        } = req.body;
        try {
            const result = await db.query(
                `UPDATE TRATAMIENTOS 
         SET Dosis = $1, FrecuenciaHoras = $2, FechaInicio = $3, FechaFin = $4, NotasInstrucciones = $5, Activo = $6, updated_at = CURRENT_TIMESTAMP
         WHERE IdTratamiento = $7 RETURNING *`,
                [
                    dosis,
                    frecuenciaHoras,
                    fechaInicio,
                    fechaFin,
                    notasInstrucciones,
                    activo,
                    id,
                ],
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Tratamiento no encontrado" });
            }
            res.json({
                message: "Tratamiento actualizado",
                tratamiento: result.rows[0],
            });
        } catch (error) {
            console.error("Error al actualizar tratamiento:", error);
            res.status(500).json({ error: "Error al actualizar el tratamiento" });
        }
    },

    eliminarTratamiento: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await db.query(
                "DELETE FROM TRATAMIENTOS WHERE IdTratamiento = $1 RETURNING *",
                [id],
            );
            if (result.rows.length === 0)
                return res.status(404).json({ error: "Tratamiento no encontrado" });
            res.json({ message: "Tratamiento eliminado correctamente" });
        } catch (error) {
            console.error("Error al eliminar tratamiento:", error);
            res.status(500).json({
                error:
                    "No se puede eliminar el tratamiento (posee registros asociados)",
            });
        }
    },
};

module.exports = tratamientosController;