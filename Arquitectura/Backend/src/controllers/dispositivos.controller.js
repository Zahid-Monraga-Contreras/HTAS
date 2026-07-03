const db = require("../db/database");

const dispositivosController = {
    getDispositivos: async (req, res) => {
        try {
            const queryText = `
        SELECT d.*, u.Nombre AS NombrePaciente, u.ApPaterno AS ApPaternoPaciente 
        FROM DISPOSITIVOS d
        LEFT JOIN USUARIOS u ON d.IdPacienteAsociado = u.IdUsuario
        ORDER BY d.IdDispositivo DESC
      `;
            const result = await db.query(queryText);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener dispositivos:", error);
            res
                .status(500)
                .json({ error: "Error al obtener la lista de dispositivos" });
        }
    },

    crearDispositivo: async (req, res) => {
        const { nombre, direccionMac, idPacienteAsociado } = req.body;
        const macNormalizada = direccionMac
            ? direccionMac.trim().toUpperCase()
            : "";

        try {
            const result = await db.query(
                `INSERT INTO DISPOSITIVOS (Nombre, DireccionMac, IdPacienteAsociado) 
         VALUES ($1, $2, $3) RETURNING *`,
                [nombre, macNormalizada, idPacienteAsociado || null],
            );
            res.status(201).json({
                message: "Dispositivo vinculado con éxito",
                dispositivo: result.rows[0],
            });
        } catch (error) {
            console.error("Error al vincular dispositivo:", error);
            res.status(500).json({
                error:
                    "Error al registrar dispositivo. Verifique que la identificación (MAC/Serie) sea única.",
            });
        }
    },

    actualizarDispositivo: async (req, res) => {
        const { id } = req.params;
        const { nombre, direccionMac, idPacienteAsociado, activo } = req.body;
        const macNormalizada = direccionMac
            ? direccionMac.trim().toUpperCase()
            : "";

        try {
            const result = await db.query(
                `UPDATE DISPOSITIVOS 
         SET Nombre = $1, DireccionMac = $2, IdPacienteAsociado = $3, Activo = $4, updated_at = CURRENT_TIMESTAMP
         WHERE IdDispositivo = $5 RETURNING *`,
                [nombre, macNormalizada, idPacienteAsociado || null, activo, id],
            );
            if (result.rows.length === 0)
                return res.status(404).json({ error: "Dispositivo no encontrado" });

            res.json({
                message: "Dispositivo modificado con éxito",
                dispositivo: result.rows[0],
            });
        } catch (error) {
            console.error("Error al actualizar dispositivo:", error);
            res
                .status(500)
                .json({ error: "Error al actualizar los datos del dispositivo" });
        }
    },

    eliminarDispositivo: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await db.query(
                "DELETE FROM DISPOSITIVOS WHERE IdDispositivo = $1 RETURNING *",
                [id],
            );
            if (result.rows.length === 0)
                return res.status(404).json({ error: "Dispositivo no encontrado" });
            res.json({ message: "Dispositivo eliminado correctamente" });
        } catch (error) {
            console.error("Error al eliminar dispositivo:", error);
            res
                .status(500)
                .json({ error: "Error al eliminar dispositivo de la base de datos" });
        }
    },
};

module.exports = dispositivosController;