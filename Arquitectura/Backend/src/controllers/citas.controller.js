const db = require("../db/database");

const citasController = {
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
        } = req.body;

        try {
            const result = await db.query(
                `INSERT INTO CITAS (
          NombrePaciente, ApPaternoPaciente, ApMaternoPaciente, 
          TelefonoPaciente, CorreoPaciente, 
          FechaCita, HoraCita, Motivo, Modalidad, Sintomas
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                [
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
                ],
            );
            res
                .status(201)
                .json({ message: "Cita agendada con éxito", cita: result.rows[0] });
        } catch (error) {
            console.error("Error al agendar cita:", error);
            res.status(500).json({ error: "Error al agendar la cita" });
        }
    },

    getAllCitas: async (req, res) => {
        try {
            const query = `
        SELECT * FROM CITAS 
        ORDER BY FechaCita DESC, HoraCita DESC`;

            const result = await db.query(query);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener todas las citas:", error);
            res.status(500).json({ error: "Error al obtener el listado de citas" });
        }
    },

    getCitasUsuario: async (req, res) => {
        const { email } = req.params; // Cambiamos UID por email para esta tabla plana
        try {
            // Al ser tabla plana, buscamos coincidencias por correo electrónico
            const query = `
        SELECT * FROM CITAS 
        WHERE CorreoPaciente = $1 
        ORDER BY FechaCita DESC, HoraCita DESC`;

            const result = await db.query(query, [email]);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener citas:", error);
            res.status(500).json({ error: "Error al obtener el historial de citas" });
        }
    },

    actualizarEstadoCita: async (req, res) => {
        const { idCita } = req.params;
        const { estado, notasDoctor } = req.body;
        try {
            const result = await db.query(
                `UPDATE CITAS 
         SET Estado = $1, NotasDoctor = COALESCE($2, NotasDoctor), updated_at = CURRENT_TIMESTAMP
         WHERE IdCita = $3 RETURNING *`,
                [estado, notasDoctor, idCita],
            );

            if (result.rows.length === 0)
                return res.status(404).json({ error: "Cita no encontrada" });

            res.json({ message: "Cita actualizada", cita: result.rows[0] });
        } catch (error) {
            console.error("Error al actualizar cita:", error);
            res
                .status(500)
                .json({ error: "Error al actualizar el estado de la cita" });
        }
    },
};

module.exports = citasController;