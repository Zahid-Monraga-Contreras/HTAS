const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citas.controller');
const db = require('../db/database');

// ==========================================================================
// RUTAS EXISTENTES
// (sin cambios aquí: el idDoctor ya se maneja dentro del controlador,
//  que lee req.query.idDoctor / req.body.idDoctor automáticamente)
// ==========================================================================
/**
 * @swagger
 * /api/citas/todas-las-citas:
 *   get:
 *     summary: Endpoint for GET /todas-las-citas
 *     tags: [Citas]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/todas-las-citas', citasController.getAllCitas);
/**
 * @swagger
 * /api/citas/agendar-cita:
 *   post:
 *     summary: Endpoint for POST /agendar-cita
 *     tags: [Citas]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/agendar-cita', citasController.agendarCita);
/**
 * @swagger
 * /api/citas/mis-citas/{email}:
 *   get:
 *     summary: Endpoint for GET /mis-citas/:email
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/mis-citas/:email', citasController.getCitasUsuario);
/**
 * @swagger
 * /api/citas/actualizar-cita/{idCita}:
 *   put:
 *     summary: Endpoint for PUT /actualizar-cita/:idCita
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: idCita
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.put('/actualizar-cita/:idCita', citasController.actualizarEstadoCita);

// ==========================================================================
// RUTAS PARA GESTIÓN DE CITAS (sin cambios)
// ==========================================================================
/**
 * @swagger
 * /api/citas/cita/{idCita}:
 *   put:
 *     summary: Endpoint for PUT /cita/:idCita
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: idCita
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.put('/cita/:idCita', citasController.actualizarCita);
/**
 * @swagger
 * /api/citas/cita/{idCita}:
 *   get:
 *     summary: Endpoint for GET /cita/:idCita
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: idCita
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/cita/:idCita', citasController.getCitaById);
/**
 * @swagger
 * /api/citas/citas/fecha/{fecha}:
 *   get:
 *     summary: Endpoint for GET /citas/fecha/:fecha
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/citas/fecha/:fecha', citasController.getCitasByFecha);
/**
 * @swagger
 * /api/citas/citas/hoy:
 *   get:
 *     summary: Endpoint for GET /citas/hoy
 *     tags: [Citas]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/citas/hoy', citasController.getCitasHoy);
/**
 * @swagger
 * /api/citas/cita/{idCita}/cancelar:
 *   patch:
 *     summary: Endpoint for PATCH /cita/:idCita/cancelar
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: idCita
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.patch('/cita/:idCita/cancelar', citasController.cancelarCita);
/**
 * @swagger
 * /api/citas/cita/{idCita}:
 *   delete:
 *     summary: Endpoint for DELETE /cita/:idCita
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: idCita
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.delete('/cita/:idCita', citasController.eliminarCita);
/**
 * @swagger
 * /api/citas/citas/estadisticas:
 *   get:
 *     summary: Endpoint for GET /citas/estadisticas
 *     tags: [Citas]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/citas/estadisticas', citasController.getEstadisticasCitas);

// ==========================================================================
// RUTAS PARA VALIDACIÓN DE DISPONIBILIDAD (sin cambios aquí)
// ==========================================================================
/**
 * @swagger
 * /api/citas/verificar-disponibilidad:
 *   get:
 *     summary: Endpoint for GET /verificar-disponibilidad
 *     tags: [Citas]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/verificar-disponibilidad', citasController.verificarDisponibilidad);
/**
 * @swagger
 * /api/citas/horarios-disponibles:
 *   get:
 *     summary: Endpoint for GET /horarios-disponibles
 *     tags: [Citas]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/horarios-disponibles', citasController.getHorariosDisponibles);
/**
 * @swagger
 * /api/citas/disponibles/hoy:
 *   get:
 *     summary: Endpoint for GET /disponibles/hoy
 *     tags: [Citas]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/disponibles/hoy', citasController.getCitasDisponiblesHoy);

// ==========================================================================
// RUTAS ADICIONALES PARA REPORTES Y CONSULTAS ESPECIALIZADAS
// ==========================================================================

// ⭐ CORREGIDO: columnas en minúsculas (antes usaba "FechaCita" con comillas
//    y mayúsculas, que no existen así en tu tabla real) + soporte de idDoctor
/**
 * @swagger
 * /api/citas/consultas/disponibilidad-masiva:
 *   post:
 *     summary: Endpoint for POST /consultas/disponibilidad-masiva
 *     tags: [Citas]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/consultas/disponibilidad-masiva', async (req, res) => {
    try {
        const { citas } = req.body;
        if (!citas || !Array.isArray(citas)) {
            return res.status(400).json({ error: "Se requiere un array de citas" });
        }

        const resultados = [];
        for (const cita of citas) {
            const { fecha, hora, email, idDoctor } = cita; // ⭐ NUEVO: idDoctor opcional por item

            try {
                const citaExistente = await db.query(
                    `SELECT COUNT(*) as total, correopaciente as correo
                     FROM citas 
                     WHERE fechacita = $1 
                       AND horacita = $2 
                       AND iddoctor = $3
                       AND estado NOT IN ('Cancelada', 'No Asistió')`,
                    [fecha, hora, idDoctor || null]
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
                         WHERE fechacita = $1 
                           AND horacita = $2 
                           AND correopaciente ILIKE $3
                           AND estado NOT IN ('Cancelada', 'No Asistió')`,
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

// ⭐ CORREGIDO: columnas en minúsculas (antes tenía "IdCita", "NombrePaciente", etc.
//    con comillas y mayúsculas, que hubieran tronado con "columna no existe")
/**
 * @swagger
 * /api/citas/consultas/proximas/{email}:
 *   get:
 *     summary: Endpoint for GET /consultas/proximas/:email
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/consultas/proximas/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const result = await db.query(
            `SELECT 
                idcita,
                nombrepaciente,
                appaternopaciente,
                apmaternopaciente,
                telefonopaciente,
                correopaciente,
                fechacita,
                horacita,
                motivo,
                sintomas,
                estado,
                modalidad,
                notasdoctor,
                fechacancelacion,
                created_at,
                updated_at,
                iddoctor
             FROM citas 
             WHERE correopaciente ILIKE $1 
               AND fechacita >= CURRENT_DATE 
               AND estado NOT IN ('Cancelada', 'Completada', 'No Asistió')
             ORDER BY fechacita ASC, horacita ASC
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

// ⭐ CORREGIDO: columnas en minúsculas
/**
 * @swagger
 * /api/citas/consultas/historial/{email}:
 *   get:
 *     summary: Endpoint for GET /consultas/historial/:email
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/consultas/historial/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { limite = 10, offset = 0 } = req.query;

        const limit = parseInt(limite);
        const offsetNum = parseInt(offset);

        const result = await db.query(
            `SELECT 
                idcita,
                nombrepaciente,
                appaternopaciente,
                apmaternopaciente,
                telefonopaciente,
                correopaciente,
                fechacita,
                horacita,
                motivo,
                sintomas,
                estado,
                modalidad,
                notasdoctor,
                fechacancelacion,
                created_at,
                updated_at,
                iddoctor
             FROM citas 
             WHERE correopaciente ILIKE $1 
             ORDER BY fechacita DESC, horacita DESC
             LIMIT $2 OFFSET $3`,
            [email, limit, offsetNum]
        );

        const total = await db.query(
            `SELECT COUNT(*) as total FROM citas WHERE correopaciente ILIKE $1`,
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
// (se dejan GLOBALES a propósito: el admin necesita ver el total de
//  toda la clínica, no de un solo doctor. Solo se corrige el bug
//  de columnas con mayúsculas/comillas)
// ==========================================================================

// ⭐ CORREGIDO: columnas en minúsculas
/**
 * @swagger
 * /api/citas/admin/resumen:
 *   get:
 *     summary: Endpoint for GET /admin/resumen
 *     tags: [Citas]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/admin/resumen', async (req, res) => {
    try {
        const resultado = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN estado = 'Programada' THEN 1 END) as programadas,
                COUNT(CASE WHEN estado = 'Confirmada' THEN 1 END) as confirmadas,
                COUNT(CASE WHEN estado = 'Completada' THEN 1 END) as completadas,
                COUNT(CASE WHEN estado = 'Cancelada' THEN 1 END) as canceladas,
                COUNT(CASE WHEN estado = 'No Asistió' THEN 1 END) as no_asistio,
                COUNT(CASE WHEN fechacita >= CURRENT_DATE AND estado NOT IN ('Cancelada', 'Completada') THEN 1 END) as proximas,
                COUNT(CASE WHEN fechacita < CURRENT_DATE AND estado NOT IN ('Cancelada', 'Completada') THEN 1 END) as vencidas,
                COUNT(CASE WHEN modalidad = 'Presencial' THEN 1 END) as presenciales,
                COUNT(CASE WHEN modalidad = 'Virtual' THEN 1 END) as virtuales
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

// ⭐ CORREGIDO: columnas en minúsculas
/**
 * @swagger
 * /api/citas/admin/cupos-por-hora/{fecha}:
 *   get:
 *     summary: Endpoint for GET /admin/cupos-por-hora/:fecha
 *     tags: [Citas]
 *     parameters:
 *       - in: path
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/admin/cupos-por-hora/:fecha', async (req, res) => {
    try {
        const { fecha } = req.params;
        const result = await db.query(`
            SELECT 
                horacita,
                COUNT(*) as total,
                CASE 
                    WHEN COUNT(*) >= 3 THEN 0
                    ELSE 3 - COUNT(*)
                END as cupos_disponibles,
                array_agg(estado) as estados,
                array_agg(correopaciente) as correos
            FROM citas 
            WHERE fechacita = $1
              AND estado NOT IN ('Cancelada', 'No Asistió')
            GROUP BY horacita
            ORDER BY horacita ASC
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