const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citas.controller');
const db = require('../db/database');

// ==========================================================================
// RUTAS EXISTENTES
// ==========================================================================
router.get('/todas-las-citas', citasController.getAllCitas);
router.post('/agendar-cita', citasController.agendarCita);
router.get('/mis-citas/:email', citasController.getCitasUsuario);
router.put('/actualizar-cita/:idCita', citasController.actualizarEstadoCita);

// ==========================================================================
// RUTAS PARA GESTIÓN DE CITAS
// ==========================================================================
router.put('/cita/:idCita', citasController.actualizarCita);
router.get('/cita/:idCita', citasController.getCitaById);
router.get('/citas/fecha/:fecha', citasController.getCitasByFecha);
router.get('/citas/hoy', citasController.getCitasHoy);
router.patch('/cita/:idCita/cancelar', citasController.cancelarCita);
router.delete('/cita/:idCita', citasController.eliminarCita);
router.get('/citas/estadisticas', citasController.getEstadisticasCitas);

// ==========================================================================
// NUEVAS RUTAS PARA VALIDACIÓN DE DISPONIBILIDAD
// ==========================================================================

router.get('/verificar-disponibilidad', citasController.verificarDisponibilidad);
router.get('/horarios-disponibles', citasController.getHorariosDisponibles);
router.get('/disponibles/hoy', citasController.getCitasDisponiblesHoy);

// ==========================================================================
// RUTAS ADICIONALES PARA REPORTES Y CONSULTAS ESPECIALIZADAS
// ==========================================================================

router.post('/consultas/disponibilidad-masiva', async (req, res) => {
    try {
        const { citas } = req.body;
        if (!citas || !Array.isArray(citas)) {
            return res.status(400).json({ error: "Se requiere un array de citas" });
        }

        const resultados = [];
        for (const cita of citas) {
            const { fecha, hora, email } = cita;

            try {
                const citaExistente = await db.query(
                    `SELECT COUNT(*) as total, "CorreoPaciente" as correo
                     FROM citas 
                     WHERE "FechaCita" = $1 
                       AND "HoraCita" = $2 
                       AND "Estado" NOT IN ('Cancelada', 'No Asistió')`,
                    [fecha, hora]
                );

                const totalCitas = parseInt(citaExistente.rows[0].total);
                const yaAgendado = totalCitas > 0;
                const correoExistente = yaAgendado ? citaExistente.rows[0].correo : null;
                const horaLlena = totalCitas >= 3;

                let usuarioYaTieneCita = false;
                if (email && !yaAgendado) {
                    const citaUsuario = await db.query(
                        `SELECT COUNT(*) as total 
                         FROM citas 
                         WHERE "FechaCita" = $1 
                           AND "HoraCita" = $2 
                           AND "CorreoPaciente" ILIKE $3
                           AND "Estado" NOT IN ('Cancelada', 'No Asistió')`,
                        [fecha, hora, email]
                    );
                    usuarioYaTieneCita = parseInt(citaUsuario.rows[0].total) > 0;
                }

                let disponible = false;
                let mensaje = '';

                if (yaAgendado) {
                    mensaje = `Horario ocupado por ${correoExistente || 'otro usuario'}`;
                    disponible = false;
                } else if (usuarioYaTieneCita) {
                    mensaje = 'Ya tienes una cita agendada para este horario';
                    disponible = false;
                } else if (horaLlena) {
                    mensaje = 'Horario completo (3 citas agendadas)';
                    disponible = false;
                } else {
                    mensaje = 'Horario disponible';
                    disponible = true;
                }

                resultados.push({
                    fecha,
                    hora,
                    email: email || null,
                    disponible: disponible,
                    mensaje: mensaje,
                    detalles: {
                        yaAgendado: yaAgendado,
                        correoExistente: correoExistente,
                        horaLlena: horaLlena,
                        usuarioYaTieneCita: usuarioYaTieneCita
                    }
                });
            } catch (error) {
                resultados.push({
                    fecha,
                    hora,
                    email: email || null,
                    disponible: false,
                    mensaje: 'Error al verificar disponibilidad',
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            total: resultados.length,
            resultados
        });
    } catch (error) {
        console.error("Error en disponibilidad masiva:", error);
        res.status(500).json({
            error: "Error al verificar disponibilidad masiva",
            details: error.message
        });
    }
});

router.get('/consultas/proximas/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const result = await db.query(
            `SELECT 
                "IdCita" as idcita,
                "NombrePaciente" as nombrepaciente,
                "ApPaternoPaciente" as appaternopaciente,
                "ApMaternoPaciente" as apmaternopaciente,
                "TelefonoPaciente" as telefonopaciente,
                "CorreoPaciente" as correopaciente,
                "FechaCita" as fechacita,
                "HoraCita" as horacita,
                "Motivo" as motivo,
                "Sintomas" as sintomas,
                "Estado" as estado,
                "Modalidad" as modalidad,
                "NotasDoctor" as notasdoctor,
                fechacancelacion,
                created_at,
                updated_at
             FROM citas 
             WHERE "CorreoPaciente" ILIKE $1 
               AND "FechaCita" >= CURRENT_DATE 
               AND "Estado" NOT IN ('Cancelada', 'Completada', 'No Asistió')
             ORDER BY "FechaCita" ASC, "HoraCita" ASC
             LIMIT 5`,
            [email]
        );
        res.json({
            success: true,
            citas: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error("Error al obtener próximas citas:", error);
        res.status(500).json({
            error: "Error al obtener próximas citas",
            details: error.message
        });
    }
});

router.get('/consultas/historial/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { limite = 10, offset = 0 } = req.query;

        const limit = parseInt(limite);
        const offsetNum = parseInt(offset);

        const result = await db.query(
            `SELECT 
                "IdCita" as idcita,
                "NombrePaciente" as nombrepaciente,
                "ApPaternoPaciente" as appaternopaciente,
                "ApMaternoPaciente" as apmaternopaciente,
                "TelefonoPaciente" as telefonopaciente,
                "CorreoPaciente" as correopaciente,
                "FechaCita" as fechacita,
                "HoraCita" as horacita,
                "Motivo" as motivo,
                "Sintomas" as sintomas,
                "Estado" as estado,
                "Modalidad" as modalidad,
                "NotasDoctor" as notasdoctor,
                fechacancelacion,
                created_at,
                updated_at
             FROM citas 
             WHERE "CorreoPaciente" ILIKE $1 
             ORDER BY "FechaCita" DESC, "HoraCita" DESC
             LIMIT $2 OFFSET $3`,
            [email, limit, offsetNum]
        );

        const total = await db.query(
            `SELECT COUNT(*) as total FROM citas WHERE "CorreoPaciente" ILIKE $1`,
            [email]
        );

        res.json({
            success: true,
            citas: result.rows,
            total: parseInt(total.rows[0].total),
            limite: limit,
            offset: offsetNum,
            totalPaginas: Math.ceil(parseInt(total.rows[0].total) / limit)
        });
    } catch (error) {
        console.error("Error al obtener historial:", error);
        res.status(500).json({
            error: "Error al obtener historial de citas",
            details: error.message
        });
    }
});

// ==========================================================================
// RUTAS PARA ADMINISTRACIÓN
// ==========================================================================

router.get('/admin/resumen', async (req, res) => {
    try {
        const resultado = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN "Estado" = 'Programada' THEN 1 END) as programadas,
                COUNT(CASE WHEN "Estado" = 'Confirmada' THEN 1 END) as confirmadas,
                COUNT(CASE WHEN "Estado" = 'Completada' THEN 1 END) as completadas,
                COUNT(CASE WHEN "Estado" = 'Cancelada' THEN 1 END) as canceladas,
                COUNT(CASE WHEN "Estado" = 'No Asistió' THEN 1 END) as no_asistio,
                COUNT(CASE WHEN "FechaCita" >= CURRENT_DATE AND "Estado" NOT IN ('Cancelada', 'Completada') THEN 1 END) as proximas,
                COUNT(CASE WHEN "FechaCita" < CURRENT_DATE AND "Estado" NOT IN ('Cancelada', 'Completada') THEN 1 END) as vencidas,
                COUNT(CASE WHEN "Modalidad" = 'Presencial' THEN 1 END) as presenciales,
                COUNT(CASE WHEN "Modalidad" = 'Virtual' THEN 1 END) as virtuales
            FROM citas
        `);
        res.json({
            success: true,
            ...resultado.rows[0]
        });
    } catch (error) {
        console.error("Error al obtener resumen:", error);
        res.status(500).json({
            error: "Error al obtener resumen de citas",
            details: error.message
        });
    }
});

router.get('/admin/cupos-por-hora/:fecha', async (req, res) => {
    try {
        const { fecha } = req.params;
        const result = await db.query(`
            SELECT 
                "HoraCita" as horacita,
                COUNT(*) as total,
                CASE 
                    WHEN COUNT(*) >= 3 THEN 0
                    ELSE 3 - COUNT(*)
                END as cupos_disponibles,
                array_agg("Estado") as estados,
                array_agg("CorreoPaciente") as correos
            FROM citas 
            WHERE "FechaCita" = $1
              AND "Estado" NOT IN ('Cancelada', 'No Asistió')
            GROUP BY "HoraCita"
            ORDER BY "HoraCita" ASC
        `, [fecha]);

        const todosHorarios = [];
        for (let h = 8; h < 20; h++) {
            const horaStr = h.toString().padStart(2, '0') + ':00';
            const encontrado = result.rows.find(r => r.horacita === horaStr);
            todosHorarios.push({
                horacita: horaStr,
                total: encontrado ? parseInt(encontrado.total) : 0,
                cupos_disponibles: encontrado ? Math.max(0, 3 - parseInt(encontrado.total)) : 3,
                estados: encontrado ? encontrado.estados : [],
                correos: encontrado ? encontrado.correos : []
            });
        }

        res.json({
            success: true,
            fecha: fecha,
            horarios: todosHorarios,
            total_horarios: todosHorarios.length,
            horarios_disponibles: todosHorarios.filter(h => h.cupos_disponibles > 0).length
        });
    } catch (error) {
        console.error("Error al obtener cupos por hora:", error);
        res.status(500).json({
            error: "Error al obtener cupos por hora",
            details: error.message
        });
    }
});

module.exports = router;