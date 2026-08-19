// ============================================
// controllers/asignaciones.controller.js
// ============================================

const db = require("../db/database");

const asignacionesController = {
    // ============================================
    // 1. OBTENER TODAS LAS ASIGNACIONES
    // ============================================
    getAllAsignaciones: async (req, res) => {
        try {
            const result = await db.query(
                `SELECT * FROM VW_ASIGNACIONES_DOCTOR_PACIENTE 
                 ORDER BY FechaAsignacion DESC`
            );
            res.json({
                success: true,
                data: result.rows,
                total: result.rows.length
            });
        } catch (error) {
            console.error("Error al obtener asignaciones:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener la lista de asignaciones"
            });
        }
    },

    // ============================================
    // 2. OBTENER ASIGNACIÓN POR ID
    // ============================================
    getAsignacionById: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await db.query(
                `SELECT * FROM VW_ASIGNACIONES_DOCTOR_PACIENTE 
                 WHERE IdAsignacion = $1`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: "Asignación no encontrada"
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            console.error("Error al obtener asignación:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener la asignación"
            });
        }
    },

    // ============================================
    // 3. OBTENER TODOS LOS DOCTORES
    // ============================================
    getDoctores: async (req, res) => {
        try {
            const result = await db.query(
                `SELECT 
                    u.IdUsuario,
                    u.Nombre,
                    u.ApPaterno,
                    u.ApMaterno,
                    u.Correo,
                    u.Telefono,
                    u.Genero,
                    d.Especialidad,
                    d.Cedula,
                    d.DireccionClinica,
                    d.TipoSangre,
                    d.Peso,
                    d.Altura,
                    COALESCE(
                        (SELECT COUNT(*) FROM ASIGNACIONES_DOCTOR_PACIENTE 
                         WHERE IdDoctor = u.IdUsuario AND Activo = TRUE),
                        0
                    ) AS TotalPacientesAsignados
                FROM USUARIOS u
                INNER JOIN DOCTORES d ON u.IdUsuario = d.IdUsuario
                WHERE u.Activo = true AND u.deleted_at IS NULL
                ORDER BY u.Nombre ASC, u.ApPaterno ASC`
            );
            res.json({
                success: true,
                data: result.rows,
                total: result.rows.length
            });
        } catch (error) {
            console.error("Error al obtener doctores:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener la lista de doctores"
            });
        }
    },

    // ============================================
    // 4. OBTENER DOCTOR POR ID
    // ============================================
    getDoctorById: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await db.query(
                `SELECT 
                    u.IdUsuario,
                    u.Nombre,
                    u.ApPaterno,
                    u.ApMaterno,
                    u.Correo,
                    u.Telefono,
                    u.Genero,
                    u.FechaNacimiento,
                    d.Especialidad,
                    d.Cedula,
                    d.DireccionClinica,
                    d.TipoSangre,
                    d.Peso,
                    d.Altura,
                    d.AntecedentesFamiliares,
                    COALESCE(
                        (SELECT COUNT(*) FROM ASIGNACIONES_DOCTOR_PACIENTE 
                         WHERE IdDoctor = u.IdUsuario AND Activo = TRUE),
                        0
                    ) AS TotalPacientesAsignados
                FROM USUARIOS u
                INNER JOIN DOCTORES d ON u.IdUsuario = d.IdUsuario
                WHERE u.IdUsuario = $1 AND u.Activo = true AND u.deleted_at IS NULL`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: "Doctor no encontrado"
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            console.error("Error al obtener doctor:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener el doctor"
            });
        }
    },

    // ============================================
    // 5. OBTENER PACIENTES DE UN DOCTOR ESPECÍFICO
    // ============================================
    getPacientesByDoctor: async (req, res) => {
        const { idDoctor } = req.params;
        try {
            // Verificar que el doctor existe
            const doctorExists = await db.query(
                `SELECT 1 FROM DOCTORES WHERE IdUsuario = $1`,
                [idDoctor]
            );

            if (doctorExists.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: "Doctor no encontrado"
                });
            }

            const result = await db.query(
                `SELECT * FROM obtener_pacientes_doctor($1)`,
                [idDoctor]
            );

            res.json({
                success: true,
                data: result.rows,
                total: result.rows.length,
                idDoctor: idDoctor
            });
        } catch (error) {
            console.error("Error al obtener pacientes del doctor:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener pacientes del doctor"
            });
        }
    },

    // ============================================
    // 6. OBTENER TODOS LOS PACIENTES (CON INFO DE ASIGNACIÓN)
    // ============================================
    getAllPacientes: async (req, res) => {
        try {
            const result = await db.query(
                `SELECT 
                    u.IdUsuario,
                    u.Nombre,
                    u.ApPaterno,
                    u.ApMaterno,
                    u.Correo,
                    u.Telefono,
                    u.Genero,
                    u.FechaNacimiento,
                    u.CURP,
                    u.Domicilio,
                    u.Localidad,
                    u.Municipio,
                    u.Estado,
                    p.NSS,
                    p.TipoSangre,
                    p.Peso,
                    p.Altura,
                    p.AntecedentesFamiliares,
                    a.IdDoctor AS DoctorAsignado,
                    ud.Nombre AS NombreDoctorAsignado,
                    ud.ApPaterno AS ApPaternoDoctorAsignado,
                    a.FechaAsignacion,
                    a.Activo AS AsignacionActiva
                FROM USUARIOS u
                INNER JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario
                LEFT JOIN ASIGNACIONES_DOCTOR_PACIENTE a 
                    ON u.IdUsuario = a.IdPaciente AND a.Activo = TRUE
                LEFT JOIN USUARIOS ud ON a.IdDoctor = ud.IdUsuario
                WHERE u.Activo = true AND u.deleted_at IS NULL
                ORDER BY u.Nombre ASC, u.ApPaterno ASC`
            );
            res.json({
                success: true,
                data: result.rows,
                total: result.rows.length
            });
        } catch (error) {
            console.error("Error al obtener pacientes:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener la lista de pacientes"
            });
        }
    },

    // ============================================
    // 7. OBTENER PACIENTES SIN ASIGNAR
    // ============================================
    getPacientesSinAsignar: async (req, res) => {
        try {
            const result = await db.query(
                `SELECT 
                    u.IdUsuario,
                    u.Nombre,
                    u.ApPaterno,
                    u.ApMaterno,
                    u.Correo,
                    u.Telefono,
                    u.Genero,
                    u.FechaNacimiento,
                    u.CURP,
                    u.Domicilio,
                    u.Localidad,
                    u.Municipio,
                    u.Estado,
                    p.NSS,
                    p.TipoSangre,
                    p.Peso,
                    p.Altura,
                    p.AntecedentesFamiliares
                FROM USUARIOS u
                INNER JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario
                WHERE u.Activo = true 
                  AND u.deleted_at IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM ASIGNACIONES_DOCTOR_PACIENTE a
                      WHERE a.IdPaciente = u.IdUsuario AND a.Activo = TRUE
                  )
                ORDER BY u.Nombre ASC, u.ApPaterno ASC`
            );
            res.json({
                success: true,
                data: result.rows,
                total: result.rows.length
            });
        } catch (error) {
            console.error("Error al obtener pacientes sin asignar:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener pacientes sin asignar"
            });
        }
    },

    // ============================================
    // 8. OBTENER PACIENTES ASIGNADOS A UN DOCTOR (VERSIÓN CON DETALLES)
    // ============================================
    getPacientesAsignadosDetalle: async (req, res) => {
        const { idDoctor } = req.params;
        try {
            const result = await db.query(
                `SELECT 
                    a.IdAsignacion,
                    a.IdPaciente,
                    u.Nombre,
                    u.ApPaterno,
                    u.ApMaterno,
                    u.Correo,
                    u.Telefono,
                    u.Genero,
                    u.FechaNacimiento,
                    calcular_edad(u.FechaNacimiento) AS Edad,
                    p.NSS,
                    p.TipoSangre,
                    p.Peso,
                    p.Altura,
                    p.AntecedentesFamiliares,
                    a.FechaAsignacion,
                    a.Activo,
                    a.AsignadoPor,
                    ua.Nombre AS NombreAsignadoPor,
                    a.Notas
                FROM ASIGNACIONES_DOCTOR_PACIENTE a
                INNER JOIN PACIENTES p ON a.IdPaciente = p.IdUsuario
                INNER JOIN USUARIOS u ON p.IdUsuario = u.IdUsuario
                LEFT JOIN USUARIOS ua ON a.AsignadoPor = ua.IdUsuario
                WHERE a.IdDoctor = $1 AND a.Activo = TRUE
                ORDER BY u.Nombre ASC, u.ApPaterno ASC`,
                [idDoctor]
            );

            res.json({
                success: true,
                data: result.rows,
                total: result.rows.length,
                idDoctor: idDoctor
            });
        } catch (error) {
            console.error("Error al obtener pacientes asignados:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener pacientes asignados"
            });
        }
    },

    // ============================================
    // 9. OBTENER DOCTOR DE UN PACIENTE ESPECÍFICO
    // ============================================
    getDoctorByPaciente: async (req, res) => {
        const { idPaciente } = req.params;
        try {
            const result = await db.query(
                `SELECT * FROM obtener_doctor_paciente($1)`,
                [idPaciente]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: "El paciente no tiene un doctor asignado"
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            console.error("Error al obtener doctor del paciente:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener doctor del paciente"
            });
        }
    },

    // ============================================
    // 10. ASIGNAR PACIENTE A DOCTOR
    // ============================================
    asignarPaciente: async (req, res) => {
        const {
            idPaciente,
            idDoctor,
            asignadoPor,
            notas
        } = req.body;

        // Validaciones
        if (!idPaciente || !idDoctor) {
            return res.status(400).json({
                success: false,
                error: "Se requiere idPaciente e idDoctor"
            });
        }

        try {
            // Usar la función de PostgreSQL para la asignación
            const result = await db.query(
                `SELECT * FROM asignar_paciente_doctor($1, $2, $3, $4)`,
                [idPaciente, idDoctor, asignadoPor || null, notas || null]
            );

            const { success, mensaje, id_asignacion, detalles } = result.rows[0];

            if (!success) {
                return res.status(400).json({
                    success: false,
                    error: mensaje,
                    detalles: detalles || null
                });
            }

            // Obtener la asignación completa recién creada
            const asignacionCompleta = await db.query(
                `SELECT * FROM VW_ASIGNACIONES_DOCTOR_PACIENTE 
                 WHERE IdAsignacion = $1`,
                [id_asignacion]
            );

            res.json({
                success: true,
                message: mensaje,
                data: asignacionCompleta.rows[0] || null,
                idAsignacion: id_asignacion
            });
        } catch (error) {
            console.error("Error al asignar paciente:", error);
            res.status(500).json({
                success: false,
                error: "Error al asignar paciente al doctor",
                details: error.message
            });
        }
    },

    // ============================================
    // 11. ASIGNAR MÚLTIPLES PACIENTES A UN DOCTOR
    // ============================================
    asignarMultiplesPacientes: async (req, res) => {
        const {
            idDoctor,
            pacientesIds,
            asignadoPor,
            notas
        } = req.body;

        if (!idDoctor || !pacientesIds || !Array.isArray(pacientesIds) || pacientesIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Se requiere idDoctor y un array de pacientesIds"
            });
        }

        try {
            const resultados = [];
            let exitosos = 0;
            let fallidos = 0;

            for (const idPaciente of pacientesIds) {
                try {
                    const result = await db.query(
                        `SELECT * FROM asignar_paciente_doctor($1, $2, $3, $4)`,
                        [idPaciente, idDoctor, asignadoPor || null, notas || null]
                    );

                    const { success, mensaje, id_asignacion } = result.rows[0];

                    resultados.push({
                        idPaciente,
                        success,
                        mensaje,
                        idAsignacion: id_asignacion || null
                    });

                    if (success) {
                        exitosos++;
                    } else {
                        fallidos++;
                    }
                } catch (error) {
                    resultados.push({
                        idPaciente,
                        success: false,
                        mensaje: `Error: ${error.message}`,
                        idAsignacion: null
                    });
                    fallidos++;
                }
            }

            res.json({
                success: true,
                message: `Asignación completada: ${exitosos} exitosos, ${fallidos} fallidos`,
                total: pacientesIds.length,
                exitosos,
                fallidos,
                resultados
            });
        } catch (error) {
            console.error("Error al asignar múltiples pacientes:", error);
            res.status(500).json({
                success: false,
                error: "Error al asignar múltiples pacientes",
                details: error.message
            });
        }
    },

    // ============================================
    // 12. DESASIGNAR PACIENTE DE DOCTOR
    // ============================================
    desasignarPaciente: async (req, res) => {
        const { idPaciente, idDoctor } = req.body;

        if (!idPaciente || !idDoctor) {
            return res.status(400).json({
                success: false,
                error: "Se requiere idPaciente e idDoctor"
            });
        }

        try {
            // Verificar que la asignación existe y está activa
            const checkResult = await db.query(
                `SELECT IdAsignacion, IdDoctor, IdPaciente 
                 FROM ASIGNACIONES_DOCTOR_PACIENTE 
                 WHERE IdPaciente = $1 AND IdDoctor = $2 AND Activo = TRUE`,
                [idPaciente, idDoctor]
            );

            if (checkResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: "No se encontró una asignación activa para este paciente y doctor"
                });
            }

            // Desasignar (borrado lógico)
            const result = await db.query(
                `UPDATE ASIGNACIONES_DOCTOR_PACIENTE 
                 SET Activo = FALSE, 
                     updated_at = CURRENT_TIMESTAMP
                 WHERE IdPaciente = $1 AND IdDoctor = $2 AND Activo = TRUE
                 RETURNING IdAsignacion, IdPaciente, IdDoctor, FechaAsignacion`,
                [idPaciente, idDoctor]
            );

            res.json({
                success: true,
                message: "Paciente desasignado exitosamente",
                data: result.rows[0]
            });
        } catch (error) {
            console.error("Error al desasignar paciente:", error);
            res.status(500).json({
                success: false,
                error: "Error al desasignar paciente del doctor",
                details: error.message
            });
        }
    },

    // ============================================
    // 13. DESASIGNAR TODOS LOS PACIENTES DE UN DOCTOR
    // ============================================
    desasignarTodosPacientes: async (req, res) => {
        const { idDoctor } = req.params;

        try {
            const result = await db.query(
                `UPDATE ASIGNACIONES_DOCTOR_PACIENTE 
                 SET Activo = FALSE, 
                     updated_at = CURRENT_TIMESTAMP
                 WHERE IdDoctor = $1 AND Activo = TRUE
                 RETURNING IdAsignacion, IdPaciente`,
                [idDoctor]
            );

            res.json({
                success: true,
                message: `Se desasignaron ${result.rows.length} pacientes del doctor`,
                totalDesasignados: result.rows.length,
                data: result.rows
            });
        } catch (error) {
            console.error("Error al desasignar todos los pacientes:", error);
            res.status(500).json({
                success: false,
                error: "Error al desasignar pacientes del doctor"
            });
        }
    },

    // ============================================
    // 14. OBTENER ESTADÍSTICAS DE ASIGNACIONES
    // ============================================
    getEstadisticasAsignaciones: async (req, res) => {
        try {
            const result = await db.query(`
                WITH stats AS (
                    SELECT 
                        COUNT(DISTINCT IdDoctor) AS TotalDoctoresConPacientes,
                        COUNT(DISTINCT IdPaciente) AS TotalPacientesAsignados,
                        COUNT(*) AS TotalAsignacionesActivas,
                        (SELECT COUNT(*) FROM USUARIOS u 
                         INNER JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario
                         WHERE u.Activo = TRUE AND u.deleted_at IS NULL) AS TotalPacientesRegistrados,
                        (SELECT COUNT(*) FROM USUARIOS u 
                         INNER JOIN DOCTORES d ON u.IdUsuario = d.IdUsuario
                         WHERE u.Activo = TRUE AND u.deleted_at IS NULL) AS TotalDoctoresRegistrados
                    FROM ASIGNACIONES_DOCTOR_PACIENTE
                    WHERE Activo = TRUE
                ),
                doctor_top AS (
                    SELECT 
                        u.Nombre || ' ' || u.ApPaterno AS DoctorNombre,
                        COUNT(*) AS TotalPacientes,
                        RANK() OVER (ORDER BY COUNT(*) DESC) AS ranking
                    FROM ASIGNACIONES_DOCTOR_PACIENTE a
                    INNER JOIN USUARIOS u ON a.IdDoctor = u.IdUsuario
                    WHERE a.Activo = TRUE
                    GROUP BY a.IdDoctor, u.Nombre, u.ApPaterno
                    ORDER BY TotalPacientes DESC
                    LIMIT 5
                )
                SELECT 
                    s.*,
                    (SELECT json_agg(json_build_object(
                        'DoctorNombre', DoctorNombre,
                        'TotalPacientes', TotalPacientes
                    )) FROM doctor_top) AS TopDoctores
                FROM stats s
            `);

            res.json({
                success: true,
                data: result.rows[0] || {
                    TotalDoctoresConPacientes: 0,
                    TotalPacientesAsignados: 0,
                    TotalAsignacionesActivas: 0,
                    TotalPacientesRegistrados: 0,
                    TotalDoctoresRegistrados: 0,
                    TopDoctores: []
                }
            });
        } catch (error) {
            console.error("Error al obtener estadísticas:", error);
            res.status(500).json({
                success: false,
                error: "Error al obtener estadísticas de asignaciones"
            });
        }
    },

    // ============================================
    // 15. VERIFICAR SI PACIENTE TIENE DOCTOR ASIGNADO
    // ============================================
    verificarPacienteAsignado: async (req, res) => {
        const { idPaciente } = req.params;

        try {
            const result = await db.query(
                `SELECT 
                    EXISTS(
                        SELECT 1 FROM ASIGNACIONES_DOCTOR_PACIENTE 
                        WHERE IdPaciente = $1 AND Activo = TRUE
                    ) AS TieneDoctorAsignado,
                    (SELECT IdDoctor FROM ASIGNACIONES_DOCTOR_PACIENTE 
                     WHERE IdPaciente = $1 AND Activo = TRUE LIMIT 1) AS IdDoctorAsignado
                `,
                [idPaciente]
            );

            res.json({
                success: true,
                data: {
                    tieneDoctorAsignado: result.rows[0].tienedoctorasignado,
                    idDoctorAsignado: result.rows[0].iddoctorasignado || null
                }
            });
        } catch (error) {
            console.error("Error al verificar paciente:", error);
            res.status(500).json({
                success: false,
                error: "Error al verificar si el paciente tiene doctor asignado"
            });
        }
    }
};

module.exports = asignacionesController;