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

          // Si esto no imprime nada en tu consola, el PDF no se leyó bien
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
          // Si hay un error aquí, te dará el 400
          return res
            .status(400)
            .json({ error: "No se pudo procesar el archivo PDF." });
        }
      }

      await db.query("BEGIN");

      const hash = await bcrypt.hash(contrasenia, 10);
      const pin = Math.floor(100000 + Math.random() * 900000).toString();

      // 1. Insertar en USUARIOS
      const userRes = await db.query(
        `INSERT INTO USUARIOS (Nombre, ApPaterno, ApMaterno, Correo, Contrasenia, Rol, Telefono, Genero, PinVerificacion) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING IdUsuario`,
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
        ],
      );

      const userId = userRes.rows[0].idusuario;

      // 2. Insertar según Rol
      if (rol === "Doctor") {
        await db.query(
          `INSERT INTO DOCTORES (IdUsuario, Cedula, ArchivoCedulaPDF, Especialidad, DireccionClinica, TipoSangre, Peso, Altura, AntecedentesFamiliares) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            userId,
            datosExtra.cedulaNum || "00000000", // El número de cédula (texto corto)
            datosExtra.cedula, // El Base64 (ArchivoCedulaPDF - texto largo)
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
          `INSERT INTO PACIENTES (IdUsuario, NSS, TipoSangre, Peso, Altura, AntecedentesFamiliares) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
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
        if (!datosExtra.fechaNacimiento) {
          await db.query("ROLLBACK");
          return res.status(400).json({
            error:
              "La fecha de nacimiento es obligatoria para el rol Acompañante.",
          });
        }
        const idPaciente = datosExtra.idPacienteAsociado || null;
        await db.query(
          `INSERT INTO ACOMPANANTES (IdUsuario, FechaNacimiento, FechaAsignacion, IdPacienteAsociado) 
                     VALUES ($1, $2, CURRENT_DATE, $3)`,
          [userId, datosExtra.fechaNacimiento, idPaciente],
        );
      }

      await db.query("COMMIT");

      // --- EL CAMBIO VA AQUÍ (Dentro del try, después del commit) ---
      return res.status(201).json({
        message: "Registro exitoso",
        userId: userId,
        pin: pin, // <--- Ahora Angular recibirá el PIN aquí
        nombre: nombre,
      });
    } catch (error) {
      await db.query("ROLLBACK");
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
        "SELECT * FROM USUARIOS WHERE Correo = $1 AND Activo = TRUE",
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
      if (!match)
        return res.status(401).json({ error: "Credenciales inválidas" });

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
        "INSERT INTO SESIONES (IdUsuario, RefreshToken, DispositivoInfo, IpAddress, FechaExpiracion) VALUES ($1, $2, $3, $4, $5)",
        [usuario.idusuario, refreshToken, deviceInfo, req.ip, fechaExp],
      );

      // --- AQUÍ ESTÁ EL CAMBIO ---
      // Enviamos el PIN y el Nombre para que el Frontend pueda mandarlos por EmailJS
      res.json({
        accessToken,
        refreshToken,
        rol: usuario.rol,
        uid: usuario.idusuario, // Necesario para identificar al usuario
        nombre: usuario.nombre, // Para el saludo del correo
        apPaterno: usuario.appaterno, // <--- Importante
        apMaterno: usuario.apmaterno, // <--- Importante
        correo: usuario.correo, // <--- Importante
        telefono: usuario.telefono,

        pin: usuario.pinverificacion, // <-- IMPORTANTE: Debe llamarse igual que en tu tabla
        pinVerificado: usuario.pinverificado, // Para saber si redirigir al PIN o al Inicio
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  verificarPin: async (req, res) => {
    const { uid, pin } = req.body;
    try {
      const result = await db.query(
        "SELECT PinVerificacion, IntentosFallidos, BloqueadoHasta FROM USUARIOS WHERE IdUsuario = $1",
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
          "UPDATE USUARIOS SET PinVerificado = TRUE, IntentosFallidos = 0, BloqueadoHasta = NULL WHERE IdUsuario = $1",
          [uid],
        );
        return res.json({ message: "¡PIN verificado correctamente!" });
      } else {
        // FALLO: Incrementar intentos
        const nuevosIntentos = (usuario.intentosfallidos || 0) + 1;

        if (nuevosIntentos >= 3) {
          const tiempoBloqueo = new Date(ahora.getTime() + 3 * 60000); // 3 min
          await db.query(
            "UPDATE USUARIOS SET IntentosFallidos = $1, BloqueadoHasta = $2 WHERE IdUsuario = $3",
            [nuevosIntentos, tiempoBloqueo, uid],
          );
          return res.status(423).json({
            error: "Demasiados intentos. Bloqueado por 3 min.",
            bloqueado: true,
            segundosRestantes: 180,
          });
        } else {
          await db.query(
            "UPDATE USUARIOS SET IntentosFallidos = $1 WHERE IdUsuario = $2",
            [nuevosIntentos, uid],
          );
          return res
            .status(400)
            .json({ error: `PIN incorrecto. Intentos: ${nuevosIntentos}/3` });
        }
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  // También te agrego de una vez el de solicitar nuevo pin para tu botón de "Reenviar"
  solicitarNuevoPin: async (req, res) => {
    const { uid } = req.body;
    try {
      const result = await db.query(
        "SELECT Nombre, Correo, PinVerificacion FROM USUARIOS WHERE IdUsuario = $1",
        [uid],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Usuario no encontrado" });

      const usuario = result.rows[0];
      res.json({
        nombre: usuario.nombre,
        correo: usuario.correo,
        pin: usuario.pinverificacion,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  googleLogin: async (req, res) => {
    // 1. Extraemos el rol que nos envía Angular por el body (con un fallback por si no llega)
    const { nombre, apPaterno, apMaterno, correo, genero, rol } = req.body;
    const rolAsignar = rol || "Paciente";

    try {
      const result = await db.query(
        "SELECT idusuario, nombre, pinverificacion, pinverificado, rol, genero FROM USUARIOS WHERE Correo = $1",
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

          // Reemplazamos la cadena fija 'Paciente' por la variable dinámcia $6 (rolAsignar)
          const nuevoUser = await db.query(
            `INSERT INTO USUARIOS (Nombre, ApPaterno, ApMaterno, Correo, Contrasenia, Rol, Telefono, Genero, PinVerificacion, PinVerificado, Activo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE) RETURNING *`,
            [
              nombre,
              apPaterno,
              apMaterno,
              correo,
              "GOOGLE_AUTH_USER",
              rolAsignar,
              "0000000000",
              genero || "Masculino",
              nuevoPin,
              false,
            ],
          );

          usuario = nuevoUser.rows[0];

          // 3. INSERCIÓN EN TABLA DE ENTIDAD SEGÚN EL ROL
          // Evaluamos el rol transformándolo a minúsculas para evitar problemas de capitalización
          const rolNormalizado = rolAsignar.toLowerCase();

          switch (rolNormalizado) {
            case "paciente":
              await db.query(
                "INSERT INTO PACIENTES (IdUsuario) VALUES ($1) ON CONFLICT (IdUsuario) DO NOTHING",
                [usuario.idusuario],
              );
              break;

            case "medico":
            case "doctor":
              await db.query(
                "INSERT INTO MEDICOS (IdUsuario) VALUES ($1) ON CONFLICT (IdUsuario) DO NOTHING",
                [usuario.idusuario],
              );
              break;

            case "acompanante":
            case "acompañante":
              await db.query(
                "INSERT INTO ACOMPANANTES (IdUsuario) VALUES ($1) ON CONFLICT (IdUsuario) DO NOTHING",
                [usuario.idusuario],
              );
              break;

            default:
              // Si el rol no coincide con ninguno, por seguridad lo vinculamos a pacientes
              await db.query(
                "INSERT INTO PACIENTES (IdUsuario) VALUES ($1) ON CONFLICT (IdUsuario) DO NOTHING",
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
        // 4. LOGIN NORMAL (El usuario ya existía en PostgreSQL con su respectivo rol)
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
        pin: usuario.pinverificacion,
        pinVerificado: usuario.pinverificado,
        accessToken: accessToken,
      });
    } catch (error) {
      console.error("Error detallado en googleLogin:", error);
      res.status(500).json({ error: "Error al procesar el acceso con Google" });
    }
  },
};

module.exports = authController;