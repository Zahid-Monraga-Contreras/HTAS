const db = require("../db/database");

const usuariosController = {
    getAllUsers: async (req, res) => {
        try {
            const result = await db.query(
                `SELECT 
                    u.idusuario, 
                    u.nombre, 
                    u.apPaterno AS "apPaterno", 
                    u.apMaterno AS "apMaterno", 
                    u.correo, 
                    u.rol, 
                    u.telefono, 
                    u.genero, 
                    u.activo,
                    u.intentosfallidos AS "intentosFallidos",
                    u.bloqueadohasta AS "bloqueadoHasta",
                    
                    -- Nuevos campos de USUARIOS
                    u.fechanacimiento AS "fechaNacimiento",
                    u.curp,
                    u.domicilio,
                    u.codigopostal AS "codigoPostal",
                    u.localidad,
                    u.municipio,
                    u.estado,
                    
                    -- Campos específicos de ACOMPAÑANTES
                    a.FechaAsignacion as "fechaAsignacion",
                    
                    -- Campos de DOCTORES
                    d.Especialidad as "especialidad", 
                    d.DireccionClinica as "direccionClinica",
                    d.Cedula as "cedula",
                    d.TipoSangre as "tipoSangreDoctor",
                    d.Peso as "pesoDoctor",
                    d.Altura as "alturaDoctor",
                    d.AntecedentesFamiliares as "antecedentesFamiliaresDoctor",
                    
                    -- Campos de PACIENTES
                    p.NSS as "nss",
                    p.TipoSangre as "tipoSangrePaciente",
                    p.Peso as "pesoPaciente",
                    p.Altura as "alturaPaciente",
                    p.AntecedentesFamiliares as "antecedentesFamiliaresPaciente",
                    
                    -- Campos de ADMINISTRADORES
                    adm.NivelPermiso as "nivelPermiso",
                    adm.AreaResponsabilidad as "areaResponsabilidad"
                FROM USUARIOS u
                LEFT JOIN ACOMPANANTES a ON u.idusuario = a.idusuario
                LEFT JOIN DOCTORES d ON u.idusuario = d.idusuario
                LEFT JOIN PACIENTES p ON u.idusuario = p.idusuario
                LEFT JOIN ADMINISTRADORES adm ON u.idusuario = adm.idusuario
                WHERE u.deleted_at IS NULL
                ORDER BY u.nombre ASC`
            );
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener usuarios:", error);
            res.status(500).json({ error: "Error al obtener la lista de usuarios" });
        }
    },

    // ✅ CORREGIDO: getUserById para pacientes
    getUserById: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await db.query(
                `SELECT 
                    u.idusuario, 
                    u.nombre, 
                    u.apPaterno AS "apPaterno", 
                    u.apMaterno AS "apMaterno", 
                    u.correo, 
                    u.rol, 
                    u.telefono, 
                    u.genero, 
                    u.activo,
                    u.intentosfallidos AS "intentosFallidos",
                    u.bloqueadohasta AS "bloqueadoHasta",
                    
                    -- Nuevos campos
                    u.fechanacimiento AS "fechaNacimiento",
                    u.curp,
                    u.domicilio,
                    u.codigopostal AS "codigoPostal",
                    u.localidad,
                    u.municipio,
                    u.estado,
                    
                    -- Campos específicos de ACOMPAÑANTES
                    a.FechaAsignacion as "fechaAsignacion",
                    
                    -- Campos de DOCTORES (con prefijo para evitar conflicto)
                    d.Especialidad as "especialidad", 
                    d.DireccionClinica as "direccionClinica",
                    d.Cedula as "cedula",
                    d.TipoSangre as "tipoSangreDoctor",
                    d.Peso as "pesoDoctor",
                    d.Altura as "alturaDoctor",
                    d.AntecedentesFamiliares as "antecedentesFamiliaresDoctor",
                    
                    -- ✅ CORREGIDO: Campos de PACIENTES (estos son los que debe usar un paciente)
                    p.NSS as "nss",
                    p.TipoSangre as "tipoSangre",           -- ✅ CORREGIDO: para paciente
                    p.Peso as "peso",                       -- ✅ CORREGIDO: para paciente
                    p.Altura as "altura",                   -- ✅ CORREGIDO: para paciente
                    p.AntecedentesFamiliares as "antecedentesFamiliares", -- ✅ CORREGIDO: para paciente
                    
                    -- Campos de ADMINISTRADORES
                    adm.NivelPermiso as "nivelPermiso",
                    adm.AreaResponsabilidad as "areaResponsabilidad"
                FROM USUARIOS u
                LEFT JOIN ACOMPANANTES a ON u.idusuario = a.idusuario
                LEFT JOIN DOCTORES d ON u.idusuario = d.idusuario
                LEFT JOIN PACIENTES p ON u.idusuario = p.idusuario
                LEFT JOIN ADMINISTRADORES adm ON u.idusuario = adm.idusuario
                WHERE u.idusuario = $1 AND u.deleted_at IS NULL`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Usuario no encontrado" });
            }

            // ✅ NUEVO: Si es paciente, asegurar que los campos vengan de PACIENTES
            const usuario = result.rows[0];
            if (usuario.rol === 'Paciente') {
                // Los datos de PACIENTES ya están en las columnas correctas
                // tipoSangre, peso, altura, antecedentesFamiliares vienen de p.
                // No hacer nada, ya están bien mapeados
            }

            res.json(usuario);
        } catch (error) {
            console.error("Error al obtener usuario:", error);
            res.status(500).json({ error: "Error al obtener el usuario" });
        }
    },

    // ✅ NUEVO: Obtener paciente por ID con datos específicos
    getPacienteById: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await db.query(
                `SELECT 
                    u.idusuario, 
                    u.nombre, 
                    u.apPaterno AS "apPaterno", 
                    u.apMaterno AS "apMaterno", 
                    u.correo, 
                    u.rol, 
                    u.telefono, 
                    u.genero, 
                    u.activo,
                    u.fechanacimiento AS "fechaNacimiento",
                    u.curp,
                    u.domicilio,
                    u.codigopostal AS "codigoPostal",
                    u.localidad,
                    u.municipio,
                    u.estado,
                    p.NSS as "nss",
                    p.TipoSangre as "tipoSangre",
                    p.Peso as "peso",
                    p.Altura as "altura",
                    p.AntecedentesFamiliares as "antecedentesFamiliares"
                FROM USUARIOS u
                JOIN PACIENTES p ON u.idusuario = p.idusuario
                WHERE u.idusuario = $1 AND u.deleted_at IS NULL`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Paciente no encontrado" });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error al obtener paciente:", error);
            res.status(500).json({ error: "Error al obtener el paciente" });
        }
    },

    updateUsuario: async (req, res) => {
        const { id } = req.params;
        const {
            // Campos básicos
            nombre,
            apPaterno,
            appaterno,
            apMaterno,
            apmaterno,
            correo,
            telefono,
            genero,
            activo,
            rol,

            // Nuevos campos de USUARIOS
            fechaNacimiento,
            curp,
            domicilio,
            codigoPostal,
            localidad,
            municipio,
            estado,

            // Campos específicos de ACOMPAÑANTES (SOLO fechaAsignacion)
            fechaAsignacion,

            // Campos de DOCTORES
            especialidad,
            specialty,
            direccionClinica,
            direccionclinica,
            cedula,
            tipoSangre,
            peso,
            altura,
            antecedentesFamiliares,

            // Campos de PACIENTES
            nss,

            // Campos de ADMINISTRADORES
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

            // 1. Actualizar tabla base: USUARIOS
            const result = await db.query(
                `UPDATE USUARIOS 
                SET 
                    Nombre = $1, 
                    ApPaterno = $2, 
                    ApMaterno = $3, 
                    Correo = $4, 
                    Telefono = $5, 
                    Genero = $6, 
                    Activo = $7, 
                    Rol = $8,
                    FechaNacimiento = COALESCE($10, FechaNacimiento),
                    CURP = COALESCE($11, CURP),
                    Domicilio = COALESCE($12, Domicilio),
                    CodigoPostal = COALESCE($13, CodigoPostal),
                    Localidad = COALESCE($14, Localidad),
                    Municipio = COALESCE($15, Municipio),
                    Estado = COALESCE($16, Estado),
                    updated_at = CURRENT_TIMESTAMP
                WHERE IdUsuario = $9 
                RETURNING *`,
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
                    fechaNacimiento || null,
                    curp || null,
                    domicilio || null,
                    codigoPostal || null,
                    localidad || null,
                    municipio || null,
                    estado || null
                ]
            );

            if (result.rows.length === 0) {
                await db.query("ROLLBACK");
                return res.status(404).json({ error: "Usuario no encontrado" });
            }

            const rolNormalizado = (rol || "").toLowerCase().trim();

            // 2. Lógica específica por Rol

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
                    `INSERT INTO DOCTORES (
                        IdUsuario, 
                        Especialidad, 
                        DireccionClinica, 
                        Cedula, 
                        ArchivoCedulaPDF, 
                        TipoSangre, 
                        Peso, 
                        Altura, 
                        AntecedentesFamiliares
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
                        antecedentesFamiliares || null
                    ]
                );
            }

            // --- ACOMPAÑANTES ---
            else if (
                (rolNormalizado === "acompañante" ||
                    rolNormalizado === "acompanante") &&
                (fechaAsignacion !== undefined)
            ) {
                if (!fechaAsignacion) {
                    await db.query("ROLLBACK");
                    return res.status(400).json({
                        error: "La fecha de asignación es obligatoria para el acompañante"
                    });
                }

                const faLimpia = fechaAsignacion.includes("T")
                    ? fechaAsignacion.split("T")[0]
                    : fechaAsignacion;

                await db.query(
                    `INSERT INTO ACOMPANANTES (IdUsuario, FechaAsignacion)
                    VALUES ($1, $2)
                    ON CONFLICT (IdUsuario)
                    DO UPDATE SET 
                        FechaAsignacion = EXCLUDED.FechaAsignacion,
                        updated_at = CURRENT_TIMESTAMP`,
                    [id, faLimpia]
                );
            }

            // --- PACIENTES ---
            else if (rolNormalizado === "paciente") {
                // ✅ CORREGIDO: Siempre actualizar paciente, incluso si solo se actualizan campos de USUARIOS
                const nssFinal = nss || "";
                await db.query(
                    `INSERT INTO PACIENTES (
                        IdUsuario, 
                        NSS, 
                        TipoSangre, 
                        Peso, 
                        Altura, 
                        AntecedentesFamiliares
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (IdUsuario) 
                    DO UPDATE SET 
                        NSS = COALESCE($2, PACIENTES.NSS),
                        TipoSangre = COALESCE($3, PACIENTES.TipoSangre),
                        Peso = COALESCE($4, PACIENTES.Peso),
                        Altura = COALESCE($5, PACIENTES.Altura),
                        AntecedentesFamiliares = COALESCE($6, PACIENTES.AntecedentesFamiliares),
                        updated_at = CURRENT_TIMESTAMP`,
                    [
                        id,
                        nssFinal,
                        tipoSangre !== undefined ? tipoSangre : null,
                        peso !== undefined ? peso : null,
                        altura !== undefined ? altura : null,
                        antecedentesFamiliares !== undefined ? antecedentesFamiliares : null
                    ]
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
                        areaResponsabilidadFinal || "General"
                    ]
                );
            }

            await db.query("COMMIT");
            res.json({
                message: "Usuario actualizado correctamente",
                user: result.rows[0]
            });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error al actualizar:", error);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },

    deleteUsuario: async (req, res) => {
        const { id } = req.params;
        try {
            await db.query(
                `UPDATE USUARIOS SET deleted_at = CURRENT_TIMESTAMP WHERE IdUsuario = $1`,
                [id]
            );
            res.json({ message: "Usuario eliminado correctamente" });
        } catch (error) {
            console.error("Error al eliminar:", error);
            res.status(500).json({
                error: "Error al eliminar el usuario. Verifique si tiene registros asociados."
            });
        }
    },

    createUsuario: async (req, res) => {
        const {
            nombre,
            apPaterno,
            apMaterno,
            correo,
            contrasenia,
            telefono,
            genero,
            rol,
            fechaNacimiento,
            curp,
            domicilio,
            codigoPostal,
            localidad,
            municipio,
            estado,
            especialidad,
            cedula,
            nss,
            fechaAsignacion,
            nivelPermiso,
            areaResponsabilidad
        } = req.body;

        try {
            await db.query("BEGIN");

            const result = await db.query(
                `INSERT INTO USUARIOS (
                    Nombre, ApPaterno, ApMaterno, Correo, Contrasenia, 
                    Telefono, Genero, Rol, FechaNacimiento, CURP, 
                    Domicilio, CodigoPostal, Localidad, Municipio, Estado
                ) VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf')), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING IdUsuario`,
                [
                    nombre,
                    apPaterno,
                    apMaterno,
                    correo,
                    contrasenia,
                    telefono || null,
                    genero || null,
                    rol,
                    fechaNacimiento || null,
                    curp || null,
                    domicilio || null,
                    codigoPostal || null,
                    localidad || null,
                    municipio || null,
                    estado || null
                ]
            );

            const userId = result.rows[0].idusuario;
            const rolNormalizado = (rol || "").toLowerCase().trim();

            if (rolNormalizado === "doctor" || rolNormalizado === "médico" || rolNormalizado === "medico") {
                await db.query(
                    `INSERT INTO DOCTORES (IdUsuario, Cedula, ArchivoCedulaPDF, Especialidad, DireccionClinica)
                    VALUES ($1, $2, $3, $4, $5)`,
                    [userId, cedula || '00000000', req.body.archivoCedulaPDF || '', especialidad || null, req.body.direccionClinica || null]
                );
            } else if (rolNormalizado === "acompañante" || rolNormalizado === "acompanante") {
                await db.query(
                    `INSERT INTO ACOMPANANTES (IdUsuario, FechaAsignacion)
                    VALUES ($1, $2)`,
                    [userId, fechaAsignacion || CURRENT_DATE]
                );
            } else if (rolNormalizado === "paciente") {
                await db.query(
                    `INSERT INTO PACIENTES (IdUsuario, NSS)
                    VALUES ($1, $2)`,
                    [userId, nss || null]
                );
            } else if (rolNormalizado === "admin" || rolNormalizado === "administrador") {
                await db.query(
                    `INSERT INTO ADMINISTRADORES (IdUsuario, NivelPermiso, AreaResponsabilidad)
                    VALUES ($1, $2, $3)`,
                    [userId, nivelPermiso || 'Soporte', areaResponsabilidad || 'General']
                );
            }

            await db.query("COMMIT");
            res.status(201).json({
                message: "Usuario creado exitosamente",
                id: userId
            });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error al crear usuario:", error);
            res.status(500).json({ error: "Error al crear el usuario" });
        }
    }
};

module.exports = usuariosController;