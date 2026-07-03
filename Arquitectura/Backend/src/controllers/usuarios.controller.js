const db = require("../db/database");

const usuariosController = {
    getAllUsers: async (req, res) => {
        try {
            const result = await db.query(
                `SELECT 
            u.idusuario, u.nombre, 
            u.apPaterno AS "apPaterno", 
            u.apMaterno AS "apMaterno", 
            u.correo, u.rol, u.telefono, u.genero, u.activo,
            u.intentosfallidos AS "intentosFallidos",
            u.bloqueadohasta AS "bloqueadoHasta",
            a.FechaNacimiento as "fechaNacimiento",
            a.FechaAsignacion as "fechaAsignacion",
            d.Especialidad as "especialidad", 
            d.DireccionClinica as "direccionClinica",
            d.Cedula as "cedula",
            COALESCE(d.TipoSangre, p.TipoSangre) as "tipoSangre",
            COALESCE(d.Peso, p.Peso) as "peso",
            COALESCE(d.Altura, p.Altura) as "altura",
            COALESCE(d.AntecedentesFamiliares, p.AntecedentesFamiliares) as "antecedentesFamiliares",
            p.NSS as "nss",
            adm.NivelPermiso as "nivelPermiso",
            adm.AreaResponsabilidad as "areaResponsabilidad"
         FROM USUARIOS u
         LEFT JOIN ACOMPANANTES a ON u.idusuario = a.idusuario
         LEFT JOIN DOCTORES d ON u.idusuario = d.idusuario
         LEFT JOIN PACIENTES p ON u.idusuario = p.idusuario
         LEFT JOIN ADMINISTRADORES adm ON u.idusuario = adm.idusuario
         ORDER BY u.nombre ASC`,
            );
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener usuarios:", error);
            res.status(500).json({ error: "Error al obtener la lista de usuarios" });
        }
    },

    updateUsuario: async (req, res) => {
        const { id } = req.params;
        const {
            nombre,
            apPaterno,
            appaterno,
            apMaterno,
            apmaterno,
            correo,
            telefono,
            genero,
            activo,
            fechaNacimiento,
            fechaAsignacion,
            especialidad,
            especialidad: specialty,
            direccionClinica,
            direccionclinica,
            rol,
            cedula,
            nss,
            tipoSangre,
            peso,
            altura,
            antecedentesFamiliares,
            nivelPermiso,
            nivelpermiso,
            areaResponsabilidad,
            arearesponsabilidad,
        } = req.body;

        // Asignación final asegurando que si viene de Angular plano o camelCase, se use el valor real
        const apellidoPaternoFinal = apPaterno || appaterno;
        const apellidoMaternoFinal = apMaterno || apmaterno;
        const direccionClinicaFinal = direccionClinica || direccionclinica;
        const nivelPermisoFinal = nivelPermiso || nivelpermiso;
        const areaResponsabilidadFinal = areaResponsabilidad || arearesponsabilidad;

        try {
            await db.query("BEGIN");

            // 1. Actualizar tabla base: USUARIOS (Datos básicos comunes)
            const result = await db.query(
                `UPDATE USUARIOS 
        SET Nombre = $1, ApPaterno = $2, ApMaterno = $3, Correo = $4, Telefono = $5, Genero = $6, Activo = $7, Rol = $8
        WHERE IdUsuario = $9 RETURNING *`,
                [
                    nombre,
                    apellidoPaternoFinal || "",
                    apellidoMaternoFinal || "",
                    correo,
                    telefono || "Sin teléfono",
                    genero || null,
                    activo !== undefined ? activo : true,
                    rol,
                    id,
                ],
            );

            if (result.rows.length === 0) {
                await db.query("ROLLBACK");
                return res.status(404).json({ error: "Usuario no encontrado" });
            }

            const rolNormalizado = (rol || "").toLowerCase().trim();

            // 2. Lógica específica por Rol (Filtra si se enviaron propiedades específicas)

            // --- DOCTORES ---
            if (
                (rolNormalizado === "doctor" ||
                    rolNormalizado === "médico" ||
                    rolNormalizado === "medico") &&
                (cedula !== undefined ||
                    especialidad !== undefined ||
                    specialty !== undefined ||
                    direccionClinicaFinal !== undefined)
            ) {
                const cedulaFinal = cedula || "00000000";
                const archivoFinal = req.body.archivoCedulaPDF || "";

                await db.query(
                    `INSERT INTO DOCTORES (IdUsuario, Especialidad, DireccionClinica, Cedula, ArchivoCedulaPDF, TipoSangre, Peso, Altura, AntecedentesFamiliares)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (IdUsuario) 
          DO UPDATE SET 
            Especialidad = COALESCE($2, DOCTORES.Especialidad), 
            DireccionClinica = COALESCE($3, DOCTORES.DireccionClinica), 
            Cedula = $4,
            ArchivoCedulaPDF = CASE WHEN $5 <> '' THEN $5 ELSE DOCTORES.ArchivoCedulaPDF END,
            TipoSangre = COALESCE($6, DOCTORES.TipoSangre),
            Peso = COALESCE($7, DOCTORES.Peso),
            Altura = COALESCE($8, DOCTORES.Altura),
            AntecedentesFamiliares = COALESCE($9, DOCTORES.AntecedentesFamiliares),
            updated_at = CURRENT_TIMESTAMP`,
                    [
                        id,
                        especialidad || null,
                        direccionClinicaFinal || null,
                        cedulaFinal,
                        archivoFinal,
                        tipoSangre || null,
                        peso || null,
                        altura || null,
                        antecedentesFamiliares || null,
                    ],
                );
            }

            // --- ACOMPAÑANTES ---
            else if (
                (rolNormalizado === "acompañante" ||
                    rolNormalizado === "acompanante") &&
                (fechaNacimiento !== undefined || fechaAsignacion !== undefined)
            ) {
                if (!fechaNacimiento || !fechaAsignacion) {
                    await db.query("ROLLBACK");
                    return res.status(400).json({
                        error:
                            "Tanto la fecha de nacimiento como la de asignación son obligatorias.",
                    });
                }

                const fnLimpia = fechaNacimiento.includes("T")
                    ? fechaNacimiento.split("T")[0]
                    : fechaNacimiento;
                const faLimpia = fechaAsignacion.includes("T")
                    ? fechaAsignacion.split("T")[0]
                    : fechaAsignacion;

                await db.query(
                    `INSERT INTO ACOMPANANTES (IdUsuario, FechaNacimiento, FechaAsignacion)
          VALUES ($1, $2, $3)
          ON CONFLICT (IdUsuario)
          DO UPDATE SET 
            FechaNacimiento = EXCLUDED.FechaNacimiento,
            FechaAsignacion = EXCLUDED.FechaAsignacion,
            updated_at = CURRENT_TIMESTAMP`,
                    [id, fnLimpia, faLimpia],
                );
            }

            // --- PACIENTES ---
            else if (
                rolNormalizado === "paciente" &&
                (nss !== undefined ||
                    tipoSangre !== undefined ||
                    peso !== undefined ||
                    altura !== undefined)
            ) {
                const nssFinal = nss || "";
                await db.query(
                    `INSERT INTO PACIENTES (IdUsuario, NSS, TipoSangre, Peso, Altura, AntecedentesFamiliares)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (IdUsuario) 
          DO UPDATE SET 
            NSS = $2,
            TipoSangre = COALESCE($3, PACIENTES.TipoSangre),
            Peso = COALESCE($4, PACIENTES.Peso),
            Altura = COALESCE($5, PACIENTES.Altura),
            AntecedentesFamiliares = COALESCE($6, PACIENTES.AntecedentesFamiliares),
            updated_at = CURRENT_TIMESTAMP`,
                    [
                        id,
                        nssFinal,
                        tipoSangre || null,
                        peso || null,
                        altura || null,
                        antecedentesFamiliares || null,
                    ],
                );
            }

            // --- ADMINISTRADORES ---
            else if (
                (rolNormalizado === "admin" || rolNormalizado === "administrador") &&
                (nivelPermisoFinal !== undefined ||
                    areaResponsabilidadFinal !== undefined)
            ) {
                await db.query(
                    `INSERT INTO ADMINISTRADORES (IdUsuario, NivelPermiso, AreaResponsabilidad)
          VALUES ($1, $2, $3)
          ON CONFLICT (IdUsuario)
          DO UPDATE SET
            NivelPermiso = COALESCE($2, ADMINISTRADORES.NivelPermiso),
            AreaResponsabilidad = COALESCE($3, ADMINISTRADORES.AreaResponsabilidad),
            updated_at = CURRENT_TIMESTAMP`,
                    [
                        id,
                        nivelPermisoFinal || "Soporte",
                        areaResponsabilidadFinal || "General",
                    ],
                );
            }

            await db.query("COMMIT");
            res.json({ message: "Actualizado correctamente", user: result.rows[0] });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error al actualizar:", error);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },

    deleteUsuario: async (req, res) => {
        const { id } = req.params;
        try {
            await db.query("DELETE FROM USUARIOS WHERE IdUsuario = $1", [id]);
            res.json({ message: "Usuario eliminado correctamente" });
        } catch (error) {
            console.error("Error al eliminar:", error);
            res.status(500).json({
                error:
                    "Error al eliminar el usuario. Verifique si tiene registros asociados.",
            });
        }
    },
};

module.exports = usuariosController;