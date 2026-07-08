const db = require("../db/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pdf = require("pdf-parse");
const { verificarRecaptcha } = require("../utils/verificarRecaptcha");

const authController = {
  register: async (req, res) => {
    const {
      nombre,
      apPaterno,
      apMaterno,
      correo,
      contrasenia,
      rol,
      telefono,
      genero,
      // Nuevos campos de USUARIOS
      fechaNacimiento,
      curp,
      domicilio,
      codigoPostal,
      localidad,
      municipio,
      estado,
      datosExtra,
      recaptchaToken,
    } = req.body;

    const captchaValido = await verificarRecaptcha(recaptchaToken);
    if (!captchaValido) {
      return res
        .status(400)
        .json({ error: "Verificación reCAPTCHA fallida. Intenta de nuevo." });
    }

    try {
      // Dentro de register, para el rol 'Doctor'
      if (rol === "Doctor" && datosExtra.cedula) {
        try {
          // Aseguramos que solo tomamos lo que está después de la coma
          const base64Data =
            datosExtra.cedula.split(",")[1] || datosExtra.cedula;

          // Convertimos a Buffer de forma explícita
          const buffer = Buffer.from(base64Data, "base64");

          // Validamos que el buffer tenga contenido
          if (buffer.length === 0) throw new Error("Buffer vacío");

          const data = await pdf(buffer);
          const texto = data.text.toUpperCase();

          console.log("Palabras encontradas:", texto.length, "caracteres.");

          const esValido =
            texto.includes("CÉDULA PROFESIONAL") ||
            texto.includes("ESTADOS UNIDOS MEXICANOS");

          if (!esValido) {
            console.log("PDF rechazado por falta de palabras clave.");
            return res
              .status(400)
              .json({ error: "El contenido del PDF no es válido." });
          }
        } catch (error) {
          console.error("ERROR CRÍTICO EN PDF-PARSE:", error.message);
          return res
            .status(400)
            .json({ error: "No se pudo procesar el archivo PDF." });
        }
      }

      await db.query("BEGIN");

      const hash = await bcrypt.hash(contrasenia, 10);
      const pin = Math.floor(100000 + Math.random() * 900000).toString();

      // 1. Insertar en USUARIOS con los nuevos campos
      const userRes = await db.query(
        `INSERT INTO USUARIOS (
          Nombre, ApPaterno, ApMaterno, Correo, Contrasenia, 
          Rol, Telefono, Genero, PinVerificacion,
          FechaNacimiento, CURP, Domicilio, CodigoPostal, 
          Localidad, Municipio, Estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
        RETURNING IdUsuario`,
        [
          nombre,
          apPaterno,
          apMaterno,
          correo,
          hash,
          rol,
          telefono,
          genero,
          pin,
          fechaNacimiento || null,
          curp || null,
          domicilio || null,
          codigoPostal || null,
          localidad || null,
          municipio || null,
          estado || null,
        ],
      );

      const userId = userRes.rows[0].idusuario;

      // 2. Insertar según Rol
      if (rol === "Doctor") {
        await db.query(
          `INSERT INTO DOCTORES (
            IdUsuario, Cedula, ArchivoCedulaPDF, Especialidad, 
            DireccionClinica, TipoSangre, Peso, Altura, AntecedentesFamiliares
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            userId,
            datosExtra.cedulaNum || "00000000",
            datosExtra.cedula,
            datosExtra.especialidad,
            datosExtra.direccion,
            datosExtra.tipoSangre || null,
            datosExtra.peso || null,
            datosExtra.altura || null,
            datosExtra.antecedentesFamiliares || null,
          ],
        );
      } else if (rol === "Paciente") {
        await db.query(
          `INSERT INTO PACIENTES (
            IdUsuario, NSS, TipoSangre, Peso, Altura, AntecedentesFamiliares
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            datosExtra.nss || null,
            datosExtra.tipoSangre || null,
            datosExtra.peso || null,
            datosExtra.altura || null,
            datosExtra.antecedentesFamiliares || null,
          ],
        );
      } else if (rol === "Acompañante") {
        // La fecha de nacimiento ahora se guarda en USUARIOS, no aquí
        // Solo necesitamos la fecha de asignación
        const idPaciente = datosExtra.idPacienteAsociado || null;
        await db.query(
          `INSERT INTO ACOMPANANTES (
            IdUsuario, FechaAsignacion, IdPacienteAsociado
          ) VALUES ($1, CURRENT_DATE, $2)`,
          [userId, idPaciente],
        );
      } else if (rol === "Admin" || rol === "Administrador") {
        await db.query(
          `INSERT INTO ADMINISTRADORES (
            IdUsuario, NivelPermiso, AreaResponsabilidad
          ) VALUES ($1, $2, $3)`,
          [
            userId,
            datosExtra.nivelPermiso || 'Soporte',
            datosExtra.areaResponsabilidad || 'General'
          ],
        );
      }

      await db.query("COMMIT");

      return res.status(201).json({
        message: "Registro exitoso",
        userId: userId,
        pin: pin,
        nombre: nombre,
      });
    } catch (error) {
      await db.query("ROLLBACK");
      console.error("Error en registro:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  login: async (req, res) => {
    const { correo, contrasenia, recaptchaToken } = req.body;
    const deviceInfo = req.headers["user-agent"];

    const captchaValido = await verificarRecaptcha(recaptchaToken);
    if (!captchaValido) {
      return res
        .status(400)
        .json({ error: "Verificación reCAPTCHA fallida. Intenta de nuevo." });
    }

    try {
      const result = await db.query(
        `SELECT 
          u.*, 
          p.NSS, p.TipoSangre AS TipoSangrePaciente,
          d.Cedula, d.Especialidad,
          a.FechaAsignacion
        FROM USUARIOS u
        LEFT JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario
        LEFT JOIN DOCTORES d ON u.IdUsuario = d.IdUsuario
        LEFT JOIN ACOMPANANTES a ON u.IdUsuario = a.IdUsuario
        WHERE u.Correo = $1 AND u.Activo = TRUE AND u.deleted_at IS NULL`,
        [correo],
      );

      if (result.rows.length === 0)
        return res.status(401).json({ error: "Credenciales inválidas" });

      const usuario = result.rows[0];

      if (
        usuario.bloqueadohasta &&
        new Date(usuario.bloqueadohasta) > new Date()
      ) {
        const segundos = Math.ceil(
          (new Date(usuario.bloqueadohasta) - new Date()) / 1000,
        );
        return res.status(423).json({
          error: "Tu cuenta está temporalmente bloqueada.",
          bloqueado: true,
          segundosRestantes: segundos,
        });
      }

      const match = await bcrypt.compare(contrasenia, usuario.contrasenia);
      if (!match) {
        // Incrementar intentos fallidos
        const nuevosIntentos = (usuario.intentosfallidos || 0) + 1;
        if (nuevosIntentos >= 3) {
          const tiempoBloqueo = new Date(Date.now() + 3 * 60000);
          await db.query(
            `UPDATE USUARIOS 
             SET IntentosFallidos = $1, BloqueadoHasta = $2 
             WHERE IdUsuario = $3`,
            [nuevosIntentos, tiempoBloqueo, usuario.idusuario]
          );
          return res.status(423).json({
            error: "Demasiados intentos. Cuenta bloqueada por 3 minutos.",
            bloqueado: true,
            segundosRestantes: 180,
          });
        } else {
          await db.query(
            `UPDATE USUARIOS SET IntentosFallidos = $1 WHERE IdUsuario = $2`,
            [nuevosIntentos, usuario.idusuario]
          );
        }
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      // Resetear intentos fallidos en login exitoso
      await db.query(
        `UPDATE USUARIOS 
         SET IntentosFallidos = 0, BloqueadoHasta = NULL 
         WHERE IdUsuario = $1`,
        [usuario.idusuario]
      );

      // Generar Tokens
      const accessToken = jwt.sign(
        { id: usuario.idusuario, rol: usuario.rol },
        process.env.JWT_SECRET,
        { expiresIn: "15m" },
      );
      const refreshToken = jwt.sign(
        { id: usuario.idusuario },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" },
      );

      // Guardar sesión en DB
      const fechaExp = new Date();
      fechaExp.setDate(fechaExp.getDate() + 7);

      await db.query(
        `INSERT INTO SESIONES (
          IdUsuario, RefreshToken, DispositivoInfo, IpAddress, FechaExpiracion
        ) VALUES ($1, $2, $3, $4, $5)`,
        [usuario.idusuario, refreshToken, deviceInfo, req.ip, fechaExp],
      );

      // Responder con todos los datos incluyendo los nuevos campos
      res.json({
        accessToken,
        refreshToken,
        rol: usuario.rol,
        uid: usuario.idusuario,
        nombre: usuario.nombre,
        apPaterno: usuario.appaterno,
        apMaterno: usuario.apmaterno,
        correo: usuario.correo,
        telefono: usuario.telefono,
        genero: usuario.genero,

        // Nuevos campos
        fechaNacimiento: usuario.fechanacimiento,
        curp: usuario.curp,
        domicilio: usuario.domicilio,
        codigoPostal: usuario.codigopostal,
        localidad: usuario.localidad,
        municipio: usuario.municipio,
        estado: usuario.estado,

        // Datos específicos según rol
        nss: usuario.nss,
        tipoSangre: usuario.tiposangrepaciente,
        cedula: usuario.cedula,
        especialidad: usuario.especialidad,
        fechaAsignacion: usuario.fechaasignacion,

        pin: usuario.pinverificacion,
        pinVerificado: usuario.pinverificado,
      });
    } catch (error) {
      console.error("Error en login:", error);
      res.status(500).json({ error: error.message });
    }
  },

  verificarPin: async (req, res) => {
    const { uid, pin } = req.body;
    try {
      const result = await db.query(
        `SELECT PinVerificacion, IntentosFallidos, BloqueadoHasta 
         FROM USUARIOS WHERE IdUsuario = $1`,
        [uid],
      );

      if (result.rows.length === 0)
        return res.status(404).json({ error: "Usuario no encontrado" });

      const usuario = result.rows[0];
      const ahora = new Date();

      // Verificar si sigue bloqueado
      if (usuario.bloqueadohasta && new Date(usuario.bloqueadohasta) > ahora) {
        const segundos = Math.ceil(
          (new Date(usuario.bloqueadohasta) - ahora) / 1000,
        );
        return res.status(423).json({
          error: "Bloqueado",
          bloqueado: true,
          segundosRestantes: segundos,
        });
      }

      if (usuario.pinverificacion === pin) {
        // ÉXITO: Resetear contadores
        await db.query(
          `UPDATE USUARIOS 
           SET PinVerificado = TRUE, IntentosFallidos = 0, BloqueadoHasta = NULL 
           WHERE IdUsuario = $1`,
          [uid],
        );
        return res.json({ message: "¡PIN verificado correctamente!" });
      } else {
        // FALLO: Incrementar intentos
        const nuevosIntentos = (usuario.intentosfallidos || 0) + 1;

        if (nuevosIntentos >= 3) {
          const tiempoBloqueo = new Date(ahora.getTime() + 3 * 60000); // 3 min
          await db.query(
            `UPDATE USUARIOS 
             SET IntentosFallidos = $1, BloqueadoHasta = $2 
             WHERE IdUsuario = $3`,
            [nuevosIntentos, tiempoBloqueo, uid],
          );
          return res.status(423).json({
            error: "Demasiados intentos. Bloqueado por 3 min.",
            bloqueado: true,
            segundosRestantes: 180,
          });
        } else {
          await db.query(
            `UPDATE USUARIOS SET IntentosFallidos = $1 WHERE IdUsuario = $2`,
            [nuevosIntentos, uid],
          );
          return res
            .status(400)
            .json({ error: `PIN incorrecto. Intentos: ${nuevosIntentos}/3` });
        }
      }
    } catch (error) {
      console.error("Error en verificarPin:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  solicitarNuevoPin: async (req, res) => {
    const { uid } = req.body;
    try {
      const result = await db.query(
        `SELECT Nombre, Correo, PinVerificacion 
         FROM USUARIOS WHERE IdUsuario = $1`,
        [uid],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Usuario no encontrado" });

      const usuario = result.rows[0];

      // Generar nuevo PIN
      const nuevoPin = Math.floor(100000 + Math.random() * 900000).toString();
      await db.query(
        `UPDATE USUARIOS 
         SET PinVerificacion = $1, PinVerificado = FALSE 
         WHERE IdUsuario = $2`,
        [nuevoPin, uid]
      );

      res.json({
        nombre: usuario.nombre,
        correo: usuario.correo,
        pin: nuevoPin,
      });
    } catch (error) {
      console.error("Error en solicitarNuevoPin:", error);
      res.status(500).json({ error: error.message });
    }
  },

  googleLogin: async (req, res) => {
    const {
      nombre,
      apPaterno,
      apMaterno,
      correo,
      genero,
      rol,
      // Nuevos campos opcionales para Google
      fechaNacimiento,
      curp,
      domicilio,
      codigoPostal,
      localidad,
      municipio,
      estado
    } = req.body;

    const rolAsignar = rol || "Paciente";

    try {
      const result = await db.query(
        `SELECT 
          idusuario, nombre, pinverificacion, pinverificado, rol, 
          genero, fechanacimiento, curp, domicilio, codigopostal, 
          localidad, municipio, estado
         FROM USUARIOS WHERE Correo = $1 AND deleted_at IS NULL`,
        [correo],
      );

      let usuario;

      if (result.rows.length === 0) {
        // 2. REGISTRO AUTOMÁTICO (Primer inicio de sesión con Google)
        await db.query("BEGIN");
        try {
          const nuevoPin = Math.floor(
            100000 + Math.random() * 900000,
          ).toString();

          const nuevoUser = await db.query(
            `INSERT INTO USUARIOS (
              Nombre, ApPaterno, ApMaterno, Correo, Contrasenia, 
              Rol, Telefono, Genero, PinVerificacion, PinVerificado, 
              Activo, FechaNacimiento, CURP, Domicilio, CodigoPostal, 
              Localidad, Municipio, Estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $12, $13, $14, $15, $16, $17) 
            RETURNING *`,
            [
              nombre,
              apPaterno || null,
              apMaterno || null,
              correo,
              "GOOGLE_AUTH_USER",
              rolAsignar,
              "0000000000",
              genero || "No especificado",
              nuevoPin,
              false,
              fechaNacimiento || null,
              curp || null,
              domicilio || null,
              codigoPostal || null,
              localidad || null,
              municipio || null,
              estado || null,
            ],
          );

          usuario = nuevoUser.rows[0];

          // 3. INSERCIÓN EN TABLA DE ENTIDAD SEGÚN EL ROL
          const rolNormalizado = rolAsignar.toLowerCase();

          switch (rolNormalizado) {
            case "paciente":
              await db.query(
                `INSERT INTO PACIENTES (IdUsuario) VALUES ($1) 
                 ON CONFLICT (IdUsuario) DO NOTHING`,
                [usuario.idusuario],
              );
              break;

            case "medico":
            case "doctor":
              await db.query(
                `INSERT INTO DOCTORES (IdUsuario, Cedula, ArchivoCedulaPDF) 
                 VALUES ($1, '00000000', '') 
                 ON CONFLICT (IdUsuario) DO NOTHING`,
                [usuario.idusuario],
              );
              break;

            case "acompanante":
            case "acompañante":
              await db.query(
                `INSERT INTO ACOMPANANTES (IdUsuario, FechaAsignacion) 
                 VALUES ($1, CURRENT_DATE) 
                 ON CONFLICT (IdUsuario) DO NOTHING`,
                [usuario.idusuario],
              );
              break;

            case "admin":
            case "administrador":
              await db.query(
                `INSERT INTO ADMINISTRADORES (IdUsuario, NivelPermiso, AreaResponsabilidad) 
                 VALUES ($1, 'Soporte', 'General') 
                 ON CONFLICT (IdUsuario) DO NOTHING`,
                [usuario.idusuario],
              );
              break;

            default:
              await db.query(
                `INSERT INTO PACIENTES (IdUsuario) VALUES ($1) 
                 ON CONFLICT (IdUsuario) DO NOTHING`,
                [usuario.idusuario],
              );
              break;
          }

          await db.query("COMMIT");
        } catch (insertError) {
          await db.query("ROLLBACK");
          throw insertError;
        }
      } else {
        // 4. LOGIN NORMAL (El usuario ya existía)
        usuario = result.rows[0];
      }

      // 5. Generar Token JWT
      let accessToken = null;
      if (usuario.pinverificado) {
        accessToken = jwt.sign(
          { id: usuario.idusuario, rol: usuario.rol },
          process.env.JWT_SECRET,
          { expiresIn: "1h" },
        );
      }

      res.json({
        uid: usuario.idusuario,
        nombre: usuario.nombre,
        apPaterno: usuario.appaterno,
        apMaterno: usuario.apmaterno,
        correo: correo,
        genero: usuario.genero,

        // Nuevos campos
        fechaNacimiento: usuario.fechanacimiento,
        curp: usuario.curp,
        domicilio: usuario.domicilio,
        codigoPostal: usuario.codigopostal,
        localidad: usuario.localidad,
        municipio: usuario.municipio,
        estado: usuario.estado,

        pin: usuario.pinverificacion,
        pinVerificado: usuario.pinverificado,
        accessToken: accessToken,
        rol: usuario.rol,
      });
    } catch (error) {
      console.error("Error detallado en googleLogin:", error);
      res.status(500).json({ error: "Error al procesar el acceso con Google" });
    }
  },

  // Método para obtener perfil completo del usuario
  getPerfilUsuario: async (req, res) => {
    const { uid } = req.params;

    try {
      const result = await db.query(
        `SELECT 
          u.*,
          p.NSS, p.TipoSangre AS TipoSangrePaciente, p.Peso AS PesoPaciente, 
          p.Altura AS AlturaPaciente, p.AntecedentesFamiliares AS AntecedentesPaciente,
          d.Cedula, d.Especialidad, d.DireccionClinica, 
          d.TipoSangre AS TipoSangreDoctor, d.Peso AS PesoDoctor,
          d.Altura AS AlturaDoctor, d.AntecedentesFamiliares AS AntecedentesDoctor,
          a.FechaAsignacion, a.IdPacienteAsociado,
          adm.NivelPermiso, adm.AreaResponsabilidad
        FROM USUARIOS u
        LEFT JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario
        LEFT JOIN DOCTORES d ON u.IdUsuario = d.IdUsuario
        LEFT JOIN ACOMPANANTES a ON u.IdUsuario = a.IdUsuario
        LEFT JOIN ADMINISTRADORES adm ON u.IdUsuario = adm.IdUsuario
        WHERE u.IdUsuario = $1 AND u.deleted_at IS NULL`,
        [uid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error al obtener perfil:", error);
      res.status(500).json({ error: "Error al obtener el perfil del usuario" });
    }
  },

  // Método para actualizar perfil
  actualizarPerfil: async (req, res) => {
    const { uid } = req.params;
    const {
      nombre,
      apPaterno,
      apMaterno,
      telefono,
      genero,
      fechaNacimiento,
      curp,
      domicilio,
      codigoPostal,
      localidad,
      municipio,
      estado,
      // Datos específicos según rol
      nss,
      tipoSangre,
      peso,
      altura,
      antecedentesFamiliares,
      especialidad,
      direccionClinica,
    } = req.body;

    try {
      await db.query("BEGIN");

      // Actualizar USUARIOS
      await db.query(
        `UPDATE USUARIOS 
        SET 
          Nombre = COALESCE($1, Nombre),
          ApPaterno = COALESCE($2, ApPaterno),
          ApMaterno = $3,
          Telefono = COALESCE($4, Telefono),
          Genero = COALESCE($5, Genero),
          FechaNacimiento = COALESCE($6, FechaNacimiento),
          CURP = COALESCE($7, CURP),
          Domicilio = COALESCE($8, Domicilio),
          CodigoPostal = COALESCE($9, CodigoPostal),
          Localidad = COALESCE($10, Localidad),
          Municipio = COALESCE($11, Municipio),
          Estado = COALESCE($12, Estado),
          updated_at = CURRENT_TIMESTAMP
        WHERE IdUsuario = $13`,
        [
          nombre, apPaterno, apMaterno, telefono, genero,
          fechaNacimiento, curp, domicilio, codigoPostal,
          localidad, municipio, estado, uid
        ]
      );

      // Obtener rol del usuario
      const rolResult = await db.query(
        `SELECT Rol FROM USUARIOS WHERE IdUsuario = $1`,
        [uid]
      );

      if (rolResult.rows.length === 0) {
        await db.query("ROLLBACK");
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const rol = rolResult.rows[0].rol;

      // Actualizar según rol
      if (rol === "Paciente") {
        await db.query(
          `UPDATE PACIENTES 
          SET 
            NSS = COALESCE($1, NSS),
            TipoSangre = COALESCE($2, TipoSangre),
            Peso = COALESCE($3, Peso),
            Altura = COALESCE($4, Altura),
            AntecedentesFamiliares = COALESCE($5, AntecedentesFamiliares),
            updated_at = CURRENT_TIMESTAMP
          WHERE IdUsuario = $6`,
          [nss, tipoSangre, peso, altura, antecedentesFamiliares, uid]
        );
      } else if (rol === "Doctor") {
        await db.query(
          `UPDATE DOCTORES 
          SET 
            Especialidad = COALESCE($1, Especialidad),
            DireccionClinica = COALESCE($2, DireccionClinica),
            TipoSangre = COALESCE($3, TipoSangre),
            Peso = COALESCE($4, Peso),
            Altura = COALESCE($5, Altura),
            AntecedentesFamiliares = COALESCE($6, AntecedentesFamiliares),
            updated_at = CURRENT_TIMESTAMP
          WHERE IdUsuario = $7`,
          [especialidad, direccionClinica, tipoSangre, peso, altura, antecedentesFamiliares, uid]
        );
      }

      await db.query("COMMIT");
      res.json({ message: "Perfil actualizado correctamente" });
    } catch (error) {
      await db.query("ROLLBACK");
      console.error("Error al actualizar perfil:", error);
      res.status(500).json({ error: "Error al actualizar el perfil" });
    }
  },

  // Logout
  logout: async (req, res) => {
    const { refreshToken } = req.body;

    try {
      await db.query(
        `DELETE FROM SESIONES WHERE RefreshToken = $1`,
        [refreshToken]
      );
      res.json({ message: "Sesión cerrada correctamente" });
    } catch (error) {
      console.error("Error en logout:", error);
      res.status(500).json({ error: "Error al cerrar sesión" });
    }
  },

  // Refresh Token
  refreshToken: async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token requerido" });
    }

    try {
      // Verificar que el refresh token existe en la BD
      const result = await db.query(
        `SELECT IdUsuario, FechaExpiracion FROM SESIONES 
         WHERE RefreshToken = $1 AND FechaExpiracion > NOW()`,
        [refreshToken]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Refresh token inválido o expirado" });
      }

      const { idusuario } = result.rows[0];

      // Obtener usuario para generar nuevo token
      const userResult = await db.query(
        `SELECT IdUsuario, Rol FROM USUARIOS WHERE IdUsuario = $1`,
        [idusuario]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: "Usuario no encontrado" });
      }

      const usuario = userResult.rows[0];

      // Generar nuevo access token
      const newAccessToken = jwt.sign(
        { id: usuario.idusuario, rol: usuario.rol },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );

      res.json({ accessToken: newAccessToken });
    } catch (error) {
      console.error("Error en refreshToken:", error);
      res.status(500).json({ error: "Error al renovar token" });
    }
  }
};

module.exports = authController;