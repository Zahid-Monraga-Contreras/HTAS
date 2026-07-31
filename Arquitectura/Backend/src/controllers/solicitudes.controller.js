const db = require("../db/database");

const solicitudesController = {
    solicitarAsignacion: async (req, res) => {
        const { idAcompanante } = req.params;
        const { correoPaciente, parentesco, notas } = req.body;

        try {
            console.log('Solicitud recibida:', { idAcompanante, correoPaciente, parentesco, notas });

            if (!correoPaciente) {
                return res.status(400).json({
                    error: 'El correo del paciente es obligatorio'
                });
            }

            const acompananteResult = await db.query(
                `SELECT IdUsuario FROM ACOMPANANTES WHERE IdUsuario = $1`,
                [idAcompanante]
            );

            console.log('ACOMPANANTE existe?', acompananteResult.rows.length > 0);
            console.log('ACOMPANANTE resultado:', acompananteResult.rows);

            if (acompananteResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Acompanante no encontrado. Contacta al administrador.'
                });
            }

            const pacienteResult = await db.query(
                `SELECT IdUsuario, Nombre, Correo 
                FROM USUARIOS 
                WHERE Correo = $1 AND Rol = 'Paciente' AND deleted_at IS NULL`,
                [correoPaciente]
            );

            console.log('PACIENTE existe?', pacienteResult.rows.length > 0);
            console.log('PACIENTE resultado:', pacienteResult.rows);

            if (pacienteResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Paciente no encontrado. Verifica el correo electronico.'
                });
            }

            const idPaciente = pacienteResult.rows[0].idusuario;
            console.log('idPaciente:', idPaciente);

            const solicitudExistente = await db.query(
                `SELECT IdSolicitud, Estado FROM SOLICITUDES_ASIGNACION 
                WHERE IdAcompanante = $1 AND IdPaciente = $2 
                AND Estado = 'pendiente'`,
                [idAcompanante, idPaciente]
            );

            console.log('Solicitud pendiente existe?', solicitudExistente.rows.length > 0);
            console.log('Solicitud pendiente resultado:', solicitudExistente.rows);

            if (solicitudExistente.rows.length > 0) {
                return res.status(400).json({
                    error: 'Ya tienes una solicitud pendiente para este paciente'
                });
            }

            const asignacionExistente = await db.query(
                `SELECT IdAsignacion FROM ASIGNACIONES_PACIENTES 
                WHERE IdAcompanante = $1 AND IdPaciente = $2 AND Activo = true`,
                [idAcompanante, idPaciente]
            );

            console.log('Asignacion existe?', asignacionExistente.rows.length > 0);
            console.log('Asignacion resultado:', asignacionExistente.rows);

            if (asignacionExistente.rows.length > 0) {
                return res.status(400).json({
                    error: 'Ya estas asignado a este paciente'
                });
            }

            console.log('Creando solicitud...');
            await db.query(
                `INSERT INTO SOLICITUDES_ASIGNACION 
                (IdAcompanante, IdPaciente, Parentesco, Notas, Estado)
                VALUES ($1, $2, $3, $4, 'pendiente')`,
                [idAcompanante, idPaciente, parentesco || null, notas || null]
            );

            console.log('Solicitud creada exitosamente');
            res.json({
                message: 'Solicitud enviada correctamente. Espera la aprobacion del administrador.'
            });

        } catch (error) {
            console.error('Error al solicitar asignacion:', error);
            res.status(500).json({
                error: 'Error al crear la solicitud: ' + error.message
            });
        }
    },

    getSolicitudesByAcompanante: async (req, res) => {
        const { idAcompanante } = req.params;
        try {
            const result = await db.query(
                `SELECT 
                    s.IdSolicitud,
                    s.IdPaciente,
                    u.Nombre AS NombrePaciente,
                    u.ApPaterno AS ApPaternoPaciente,
                    u.ApMaterno AS ApMaternoPaciente,
                    u.Correo AS CorreoPaciente,
                    s.Parentesco,
                    s.Notas,
                    s.Estado,
                    s.FechaSolicitud,
                    s.FechaAprobacion
                FROM SOLICITUDES_ASIGNACION s
                INNER JOIN USUARIOS u ON s.IdPaciente = u.IdUsuario
                WHERE s.IdAcompanante = $1
                ORDER BY s.FechaSolicitud DESC`,
                [idAcompanante]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Error al obtener solicitudes:', error);
            res.status(500).json({ error: 'Error al obtener las solicitudes' });
        }
    },

    getSolicitudesPendientes: async (req, res) => {
        try {
            const result = await db.query(
                `SELECT 
                    s.IdSolicitud,
                    s.FechaSolicitud,
                    ua.Nombre AS NombreAcompanante,
                    ua.ApPaterno AS ApPaternoAcompanante,
                    ua.Correo AS CorreoAcompanante,
                    up.Nombre AS NombrePaciente,
                    up.ApPaterno AS ApPaternoPaciente,
                    up.Correo AS CorreoPaciente,
                    s.Parentesco,
                    s.Notas,
                    s.Estado
                FROM SOLICITUDES_ASIGNACION s
                INNER JOIN USUARIOS ua ON s.IdAcompanante = ua.IdUsuario
                INNER JOIN USUARIOS up ON s.IdPaciente = up.IdUsuario
                WHERE s.Estado = 'pendiente'
                ORDER BY s.FechaSolicitud ASC`
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Error al obtener solicitudes pendientes:', error);
            res.status(500).json({ error: 'Error al obtener las solicitudes' });
        }
    },

    aprobarSolicitud: async (req, res) => {
        const { idSolicitud } = req.params;
        const { idAdmin } = req.body;

        try {
            await db.query('BEGIN');

            const solicitud = await db.query(
                `SELECT IdAcompanante, IdPaciente, Estado 
                FROM SOLICITUDES_ASIGNACION 
                WHERE IdSolicitud = $1`,
                [idSolicitud]
            );

            if (solicitud.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ error: 'Solicitud no encontrada' });
            }

            const { idacompanante, idpaciente, estado } = solicitud.rows[0];

            if (estado !== 'pendiente') {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'La solicitud ya fue procesada' });
            }

            await db.query(
                `UPDATE SOLICITUDES_ASIGNACION 
                SET Estado = 'aprobada', 
                    IdAprobador = $1, 
                    FechaAprobacion = CURRENT_TIMESTAMP 
                WHERE IdSolicitud = $2`,
                [idAdmin, idSolicitud]
            );

            await db.query(
                `INSERT INTO ASIGNACIONES_PACIENTES 
                (IdAcompanante, IdPaciente, IdAprobador, FechaAsignacion, Activo)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, true)
                ON CONFLICT (IdAcompanante, IdPaciente) 
                DO UPDATE SET 
                    Activo = true, 
                    IdAprobador = EXCLUDED.IdAprobador,
                    FechaAsignacion = CURRENT_TIMESTAMP`,
                [idacompanante, idpaciente, idAdmin]
            );

            await db.query('COMMIT');
            res.json({ message: 'Solicitud aprobada correctamente' });
        } catch (error) {
            await db.query('ROLLBACK');
            console.error('Error al aprobar solicitud:', error);
            res.status(500).json({ error: 'Error al aprobar la solicitud' });
        }
    },

    rechazarSolicitud: async (req, res) => {
        const { idSolicitud } = req.params;
        const { idAdmin, motivo } = req.body;

        try {
            const result = await db.query(
                `UPDATE SOLICITUDES_ASIGNACION 
                SET Estado = 'rechazada', 
                    IdAprobador = $1, 
                    FechaAprobacion = CURRENT_TIMESTAMP,
                    Notas = COALESCE($3, Notas || ' Rechazada por administrador')
                WHERE IdSolicitud = $2 AND Estado = 'pendiente'
                RETURNING IdSolicitud`,
                [idAdmin, idSolicitud, motivo]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
            }

            res.json({ message: 'Solicitud rechazada correctamente' });
        } catch (error) {
            console.error('Error al rechazar solicitud:', error);
            res.status(500).json({ error: 'Error al rechazar la solicitud' });
        }
    },

    getPacientesAsignados: async (req, res) => {
        const { idAcompanante } = req.params;
        try {
            const result = await db.query(
                `SELECT 
                    u.IdUsuario,
                    u.Nombre,
                    u.ApPaterno AS "apPaterno",
                    u.ApMaterno AS "apMaterno",
                    u.Correo,
                    u.Telefono,
                    u.Genero,
                    u.FechaNacimiento AS "fechaNacimiento",
                    p.NSS AS "nss",
                    p.TipoSangre AS "tipoSangre",
                    p.Peso,
                    p.Altura,
                    a.FechaAsignacion AS "fechaAsignacion"
                FROM ASIGNACIONES_PACIENTES a
                INNER JOIN USUARIOS u ON a.IdPaciente = u.IdUsuario
                INNER JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario
                WHERE a.IdAcompanante = $1 AND a.Activo = true AND u.deleted_at IS NULL
                ORDER BY u.Nombre ASC`,
                [idAcompanante]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Error al obtener pacientes asignados:', error);
            res.status(500).json({ error: 'Error al obtener los pacientes asignados' });
        }
    },

    eliminarAsignacion: async (req, res) => {
        const { idAsignacion } = req.params;
        try {
            await db.query(
                `UPDATE ASIGNACIONES_PACIENTES 
                SET Activo = false, updated_at = CURRENT_TIMESTAMP 
                WHERE IdAsignacion = $1`,
                [idAsignacion]
            );
            res.json({ message: 'Asignacion eliminada correctamente' });
        } catch (error) {
            console.error('Error al eliminar asignacion:', error);
            res.status(500).json({ error: 'Error al eliminar la asignacion' });
        }
    }
};

module.exports = solicitudesController;