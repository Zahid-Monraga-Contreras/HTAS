const db = require("../db/database");

const citasController = {
    // ==========================================================================
    // AGENDAR CITA - CON VALIDACIONES DE DISPONIBILIDAD
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
            sintomas
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
            // VALIDACIÓN 1: LÍMITE DE 3 CITAS POR HORA
            const citasEnHora = await db.query(
                `SELECT COUNT(*) as total 
                 FROM citas 
                 WHERE fechacita = $1 
                   AND horacita = $2 
                   AND estado NOT IN ('Cancelada', 'No Asistió')`,
                [fechaCita, horaCita]
            );

            const totalCitasEnHora = parseInt(citasEnHora.rows[0].total);

            if (totalCitasEnHora >= 3) {
                return res.status(409).json({
                    error: "Horario no disponible, ya hay 3 citas agendadas para esa hora",
                    disponible: false,
                    detalles: {
                        totalCitasEnHora: totalCitasEnHora,
                        maximoPermitido: 3,
                        cuposDisponibles: 0
                    }
                });
            }

            // VALIDACIÓN 2: VERIFICAR SI ALGUIEN YA AGENDÓ ESTA FECHA Y HORA
            const citaExistente = await db.query(
                `SELECT COUNT(*) as total
                 FROM citas 
                 WHERE fechacita = $1 
                   AND horacita = $2 
                   AND estado NOT IN ('Cancelada', 'No Asistió')`,
                [fechaCita, horaCita]
            );

            const totalCitas = parseInt(citaExistente.rows[0].total);

            if (totalCitas > 0) {
                return res.status(409).json({
                    error: `Este horario ya está ocupado. Por favor, selecciona otra fecha u hora.`,
                    disponible: false,
                    detalles: {
                        yaAgendado: true,
                        fecha: fechaCita,
                        hora: horaCita
                    }
                });
            }

            // VALIDACIÓN 3: USUARIO NO TENGA CITA EN MISMA FECHA Y HORA
            if (correoPaciente) {
                const citaUsuario = await db.query(
                    `SELECT COUNT(*) as total 
                     FROM citas 
                     WHERE fechacita = $1 
                       AND horacita = $2 
                       AND correopaciente ILIKE $3
                       AND estado NOT IN ('Cancelada', 'No Asistió')`,
                    [fechaCita, horaCita, correoPaciente]
                );

                if (parseInt(citaUsuario.rows[0].total) > 0) {
                    return res.status(409).json({
                        error: `Ya tienes una cita agendada para el ${fechaCita} a las ${horaCita}`,
                        disponible: false,
                        detalles: {
                            yaTieneCita: true,
                            fecha: fechaCita,
                            hora: horaCita
                        }
                    });
                }
            }

            // VALIDACIÓN 4: LÍMITE DE 2 CITAS POR DÍA POR USUARIO
            if (correoPaciente) {
                const citasMismoDia = await db.query(
                    `SELECT COUNT(*) as total 
                     FROM citas 
                     WHERE fechacita = $1 
                       AND correopaciente ILIKE $2
                       AND estado NOT IN ('Cancelada', 'No Asistió')`,
                    [fechaCita, correoPaciente]
                );

                if (parseInt(citasMismoDia.rows[0].total) >= 2) {
                    return res.status(409).json({
                        error: "Ya tienes 2 citas agendadas para este día. No puedes agendar más de 2 citas por día.",
                        disponible: false,
                        detalles: {
                            citasHoy: parseInt(citasMismoDia.rows[0].total),
                            maximoPorDia: 2
                        }
                    });
                }
            }

            // CREAR LA CITA
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
                success: true,
                message: "Cita agendada con éxito",
                cita: result.rows[0],
                mensajeAdicional: "Se enviará un recordatorio 24 horas antes"
            });

        } catch (error) {
            console.error("Error al agendar cita:", error);
            res.status(500).json({
                error: "Error al agendar la cita",
                details: error.message
            });
        }
    },

    // ==========================================================================
    // VERIFICAR DISPONIBILIDAD DE CITA - CORREGIDO
    // ==========================================================================
    verificarDisponibilidad: async (req, res) => {
        const { fecha, hora, email } = req.query;

        if (!fecha || !hora) {
            return res.status(400).json({
                error: "Fecha y hora son requeridos"
            });
        }

        try {
            // 1. Verificar si ALGUIEN ya tiene cita en esa fecha y hora
            const citaExistente = await db.query(
                `SELECT COUNT(*) as total
                 FROM citas 
                 WHERE fechacita = $1 
                   AND horacita = $2 
                   AND estado NOT IN ('Cancelada', 'No Asistió')`,
                [fecha, hora]
            );

            const totalCitas = parseInt(citaExistente.rows[0].total);
            const yaAgendado = totalCitas > 0;
            const horaLlena = totalCitas >= 3;

            let usuarioYaTieneCita = false;
            let mensaje = '';
            let correoExistente = null;

            // Si hay citas, obtener el correo del ocupante
            if (yaAgendado) {
                const correoResult = await db.query(
                    `SELECT correopaciente 
                     FROM citas 
                     WHERE fechacita = $1 
                       AND horacita = $2 
                       AND estado NOT IN ('Cancelada', 'No Asistió')
                     LIMIT 1`,
                    [fecha, hora]
                );
                correoExistente = correoResult.rows.length > 0 ? correoResult.rows[0].correopaciente : null;
            }

            let detalles = {
                totalCitasEnHora: totalCitas,
                maximoPermitido: 3,
                horaLlena: horaLlena,
                cuposDisponibles: Math.max(0, 3 - totalCitas),
                yaAgendado: yaAgendado,
                correoExistente: correoExistente
            };

            // 2. Verificar si el usuario ya tiene cita en ese horario
            if (email) {
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
                detalles.usuarioYaTieneCita = usuarioYaTieneCita;

                if (usuarioYaTieneCita) {
                    mensaje = 'Ya tienes una cita agendada para este horario';
                } else if (yaAgendado) {
                    mensaje = `Este horario ya está ocupado por ${correoExistente || 'otro usuario'}`;
                } else if (horaLlena) {
                    mensaje = 'Este horario ya está completo (3 citas agendadas)';
                } else {
                    mensaje = 'Horario disponible';
                }
            } else {
                if (yaAgendado) {
                    mensaje = `Este horario ya está ocupado por ${correoExistente || 'otro usuario'}`;
                } else if (horaLlena) {
                    mensaje = 'Este horario ya está completo (3 citas agendadas)';
                } else {
                    mensaje = 'Horario disponible';
                }
            }

            // 3. Verificar límite de citas por día
            let citasHoy = 0;
            let limiteDiaAlcanzado = false;

            if (email) {
                const citasDia = await db.query(
                    `SELECT COUNT(*) as total 
                     FROM citas 
                     WHERE fechacita = $1 
                       AND correopaciente ILIKE $2
                       AND estado NOT IN ('Cancelada', 'No Asistió')`,
                    [fecha, email]
                );
                citasHoy = parseInt(citasDia.rows[0].total);
                limiteDiaAlcanzado = citasHoy >= 2;

                if (limiteDiaAlcanzado && !yaAgendado && !usuarioYaTieneCita) {
                    mensaje = 'Has alcanzado el límite de 2 citas para este día';
                }
            }

            const disponible = !yaAgendado && !usuarioYaTieneCita && !limiteDiaAlcanzado;

            res.json({
                disponible: disponible,
                mensaje: mensaje,
                detalles: {
                    ...detalles,
                    citasHoy: citasHoy,
                    limiteDiaAlcanzado: limiteDiaAlcanzado,
                    maximoPorDia: 2
                }
            });

        } catch (error) {
            console.error("Error al verificar disponibilidad:", error);
            res.status(500).json({
                error: "Error al verificar disponibilidad de la cita",
                details: error.message
            });
        }
    },

    // ==========================================================================
    // OBTENER HORARIOS DISPONIBLES PARA UNA FECHA
    // ==========================================================================
    getHorariosDisponibles: async (req, res) => {
        const { fecha, email } = req.query;

        if (!fecha) {
            return res.status(400).json({
                error: "Fecha es requerida"
            });
        }

        try {
            const todosLosHorarios = [];
            for (let h = 8; h < 20; h++) {
                const horaStr = h.toString().padStart(2, '0') + ':00';
                todosLosHorarios.push(horaStr);
            }

            const horariosOcupadosResult = await db.query(
                `SELECT horacita, correopaciente
                 FROM citas 
                 WHERE fechacita = $1 
                   AND estado NOT IN ('Cancelada', 'No Asistió')`,
                [fecha]
            );

            const horariosOcupados = new Map();
            horariosOcupadosResult.rows.forEach(row => {
                if (!horariosOcupados.has(row.horacita)) {
                    horariosOcupados.set(row.horacita, []);
                }
                horariosOcupados.get(row.horacita).push(row.correopaciente);
            });

            const horariosCompletosResult = await db.query(
                `SELECT horacita, COUNT(*) as total
                 FROM citas 
                 WHERE fechacita = $1 
                   AND estado NOT IN ('Cancelada', 'No Asistió')
                 GROUP BY horacita
                 HAVING COUNT(*) >= 3`,
                [fecha]
            );
            const horariosCompletos = horariosCompletosResult.rows.map(row => row.horacita);

            let horariosUsuario = [];
            let citasUsuario = [];
            if (email) {
                const citasUsuarioResult = await db.query(
                    `SELECT idcita, horacita, estado
                     FROM citas 
                     WHERE fechacita = $1 
                       AND correopaciente ILIKE $2
                       AND estado NOT IN ('Cancelada', 'No Asistió')`,
                    [fecha, email]
                );
                citasUsuario = citasUsuarioResult.rows;
                horariosUsuario = citasUsuario.map(row => row.horacita);
            }

            const horariosDisponibles = todosLosHorarios.filter(hora => {
                if (horariosCompletos.includes(hora)) return false;
                if (horariosUsuario.includes(hora)) return false;
                if (horariosOcupados.has(hora) && horariosOcupados.get(hora).length > 0) return false;
                return true;
            });

            const horariosOcupadosInfo = {};
            horariosOcupados.forEach((emails, hora) => {
                horariosOcupadosInfo[hora] = {
                    ocupado: true,
                    por: emails.length > 1 ? `${emails.length} usuarios` : emails[0]
                };
            });

            res.json({
                success: true,
                fecha: fecha,
                horariosDisponibles: horariosDisponibles,
                horariosCompletos: horariosCompletos,
                horariosUsuario: horariosUsuario,
                horariosOcupados: horariosOcupadosInfo,
                citasUsuario: citasUsuario,
                totalDisponibles: horariosDisponibles.length,
                totalHorarios: todosLosHorarios.length,
                mensaje: horariosDisponibles.length > 0 ?
                    `Hay ${horariosDisponibles.length} horarios disponibles` :
                    'No hay horarios disponibles para esta fecha'
            });

        } catch (error) {
            console.error("Error al obtener horarios disponibles:", error);
            res.status(500).json({
                error: "Error al obtener horarios disponibles",
                details: error.message
            });
        }
    },

    // ==========================================================================
    // OBTENER CITAS DE USUARIO CON FILTROS MEJORADOS
    // ==========================================================================
    getCitasUsuario: async (req, res) => {
        const { email } = req.params;
        const { estado, fechaInicio, fechaFin, soloFuturas } = req.query;

        try {
            let query = `
                SELECT 
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
                    CASE 
                        WHEN fechacita < CURRENT_DATE AND estado NOT IN ('Cancelada', 'Completada', 'No Asistió') 
                        THEN 'Vencida'
                        WHEN fechacita = CURRENT_DATE THEN 'Hoy'
                        ELSE 'Futura'
                    END AS categoriafecha
                FROM citas
                WHERE correopaciente ILIKE $1
            `;

            const params = [email];
            let paramCount = 2;

            if (estado) {
                query += ` AND estado = $${paramCount}`;
                params.push(estado);
                paramCount++;
            }

            if (fechaInicio) {
                query += ` AND fechacita >= $${paramCount}`;
                params.push(fechaInicio);
                paramCount++;
            }

            if (fechaFin) {
                query += ` AND fechacita <= $${paramCount}`;
                params.push(fechaFin);
                paramCount++;
            }

            if (soloFuturas === 'true') {
                query += ` AND fechacita >= CURRENT_DATE AND estado NOT IN ('Cancelada', 'Completada', 'No Asistió')`;
            }

            query += ` ORDER BY fechacita DESC, horacita DESC`;

            const result = await db.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener citas:", error);
            res.status(500).json({ error: "Error al obtener el historial de citas" });
        }
    },

    // ==========================================================================
    // OBTENER TODAS LAS CITAS
    // ==========================================================================
    getAllCitas: async (req, res) => {
        const { fecha, estado, modalidad, busqueda } = req.query;

        try {
            let query = `
                SELECT 
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
                    CASE 
                        WHEN fechacita < CURRENT_DATE AND estado NOT IN ('Cancelada', 'Completada', 'No Asistió') 
                        THEN 'Vencida'
                        WHEN fechacita = CURRENT_DATE THEN 'Hoy'
                        WHEN fechacita = CURRENT_DATE + INTERVAL '1 day' THEN 'Mañana'
                        ELSE 'Futura'
                    END AS categoriafecha,
                    CASE 
                        WHEN estado = 'Programada' AND fechacita < CURRENT_DATE THEN 'Atención Urgente'
                        WHEN estado = 'Confirmada' AND fechacita < CURRENT_DATE THEN 'Atención Urgente'
                        ELSE 'Normal'
                    END AS prioridad
                FROM citas
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 1;

            if (fecha) {
                query += ` AND fechacita = $${paramCount}`;
                params.push(fecha);
                paramCount++;
            }

            if (estado) {
                query += ` AND estado = $${paramCount}`;
                params.push(estado);
                paramCount++;
            }

            if (modalidad) {
                query += ` AND modalidad = $${paramCount}`;
                params.push(modalidad);
                paramCount++;
            }

            if (busqueda) {
                query += ` AND (
                    nombrepaciente ILIKE $${paramCount} OR 
                    appaternopaciente ILIKE $${paramCount} OR 
                    correopaciente ILIKE $${paramCount}
                )`;
                params.push(`%${busqueda}%`);
                paramCount++;
            }

            query += ` ORDER BY fechacita DESC, horacita DESC`;

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
                    CASE 
                        WHEN fechacita < CURRENT_DATE AND estado NOT IN ('Cancelada', 'Completada', 'No Asistió') 
                        THEN 'Vencida'
                        WHEN fechacita = CURRENT_DATE THEN 'Hoy'
                        ELSE 'Futura'
                    END AS categoriafecha
                FROM citas
                WHERE idcita = $1
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
    // OBTENER CITAS POR FECHA
    // ==========================================================================
    getCitasByFecha: async (req, res) => {
        const { fecha } = req.params;

        try {
            const query = `
                SELECT 
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
                    EXTRACT(HOUR FROM horacita) AS hora,
                    EXTRACT(MINUTE FROM horacita) AS minuto,
                    CASE 
                        WHEN estado = 'Programada' THEN '#FFA726'
                        WHEN estado = 'Confirmada' THEN '#66BB6A'
                        WHEN estado = 'Completada' THEN '#42A5F5'
                        WHEN estado = 'Cancelada' THEN '#EF5350'
                        WHEN estado = 'No Asistió' THEN '#AB47BC'
                        ELSE '#78909C'
                    END AS colorevento
                FROM citas
                WHERE fechacita = $1
                ORDER BY horacita ASC
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
                    CASE 
                        WHEN horacita < CURRENT_TIME THEN 'Pasada'
                        ELSE 'Pendiente'
                    END AS estadotiempo,
                    EXTRACT(HOUR FROM horacita) AS hora,
                    EXTRACT(MINUTE FROM horacita) AS minuto
                FROM citas
                WHERE fechacita = CURRENT_DATE
                  AND estado NOT IN ('Cancelada', 'Completada')
                ORDER BY horacita ASC
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
    // CANCELAR CITA - CON fechacancelacion
    // ==========================================================================
    cancelarCita: async (req, res) => {
        const { idCita } = req.params;
        const { motivoCancelacion } = req.body;

        if (!idCita) {
            return res.status(400).json({ error: "ID de cita requerido" });
        }

        const idNumerico = typeof idCita === 'string' ? parseInt(idCita) : idCita;

        if (isNaN(idNumerico) || idNumerico <= 0) {
            return res.status(400).json({ error: "ID de cita inválido" });
        }

        try {
            const citaExistente = await db.query(
                `SELECT idcita, estado, fechacita FROM citas WHERE idcita = $1`,
                [idNumerico]
            );

            if (citaExistente.rows.length === 0) {
                return res.status(404).json({ error: "Cita no encontrada" });
            }

            const cita = citaExistente.rows[0];
            const estadoActual = cita.estado.toLowerCase();

            if (estadoActual === 'cancelada') {
                return res.status(400).json({ error: "Esta cita ya ha sido cancelada" });
            }

            if (estadoActual === 'completada' || estadoActual === 'realizada' || estadoActual === 'finalizada') {
                return res.status(400).json({ error: "No se puede cancelar una cita completada" });
            }

            const motivo = (motivoCancelacion || 'Cancelada por el paciente').trim();

            const result = await db.query(
                `UPDATE citas 
                SET 
                    estado = 'Cancelada',
                    notasdoctor = $1,
                    fechacancelacion = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE idcita = $2 
                RETURNING *`,
                [motivo, idNumerico]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "No se pudo cancelar la cita" });
            }

            res.json({
                success: true,
                message: "Cita cancelada con éxito",
                cita: result.rows[0]
            });

        } catch (error) {
            console.error("Error al cancelar cita:", error);
            res.status(500).json({
                error: "Error interno del servidor al cancelar la cita",
                details: error.message
            });
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

            const estadoActual = citaExists.rows[0].estado.toLowerCase();
            if (estadoActual === 'cancelada' || estadoActual === 'completada') {
                return res.status(400).json({
                    error: `No se puede modificar una cita que ya está ${estadoActual}`
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
    },

    // ==========================================================================
    // OBTENER CITAS DISPONIBLES PARA HOY (CON CUPOS)
    // ==========================================================================
    getCitasDisponiblesHoy: async (req, res) => {
        try {
            const query = `
                SELECT 
                    horacita,
                    COUNT(*) as total,
                    CASE 
                        WHEN COUNT(*) >= 3 THEN 'Completo'
                        WHEN COUNT(*) >= 2 THEN 'Casi completo'
                        ELSE 'Disponible'
                    END AS disponibilidad
                FROM citas 
                WHERE fechacita = CURRENT_DATE
                  AND estado NOT IN ('Cancelada', 'No Asistió')
                GROUP BY horacita
                ORDER BY horacita ASC
            `;

            const result = await db.query(query);

            const todosLosHorarios = [];
            for (let h = 8; h < 20; h++) {
                const horaStr = h.toString().padStart(2, '0') + ':00';
                const encontrado = result.rows.find(r => r.horacita === horaStr);
                todosLosHorarios.push({
                    horacita: horaStr,
                    total: encontrado ? parseInt(encontrado.total) : 0,
                    disponibilidad: encontrado ? encontrado.disponibilidad : 'Disponible',
                    cupos: encontrado ? Math.max(0, 3 - parseInt(encontrado.total)) : 3
                });
            }

            res.json({
                fecha: new Date().toISOString().split('T')[0],
                horarios: todosLosHorarios,
                totalHorarios: todosLosHorarios.length,
                horariosDisponibles: todosLosHorarios.filter(h => h.cupos > 0).length
            });
        } catch (error) {
            console.error("Error al obtener citas disponibles:", error);
            res.status(500).json({ error: "Error al obtener citas disponibles" });
        }
    }
};

module.exports = citasController;