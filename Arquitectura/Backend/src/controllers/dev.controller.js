// src/controllers/dev.controller.js
const db = require("../db/database");
const bcrypt = require("bcrypt");
const crypto = require('crypto');

// Solo para entorno de desarrollo
const devController = {
    createTestAdmin: async (req, res) => {
        // SEGURIDAD NIVEL 1: Verificar entorno
        if (process.env.NODE_ENV !== 'development') {
            return res.status(403).json({
                error: "Este endpoint solo está disponible en entorno de desarrollo"
            });
        }

        // SEGURIDAD NIVEL 2: Verificar variable de entorno
        if (process.env.ALLOW_DEV_ENDPOINTS !== 'true') {
            return res.status(403).json({
                error: "Los endpoints de desarrollo están deshabilitados"
            });
        }

        // SEGURIDAD NIVEL 3: Verificar token secreto (NO en el código)
        const { secretKey } = req.headers;
        if (!secretKey || secretKey !== process.env.DEV_SECRET_KEY) {
            return res.status(401).json({ error: "Clave secreta inválida" });
        }

        // SEGURIDAD NIVEL 4: Verificar IP local
        const clientIp = req.ip || req.connection.remoteAddress;
        const isLocal = clientIp === '::1' ||
            clientIp === '127.0.0.1' ||
            clientIp === '::ffff:127.0.0.1';
        if (!isLocal) {
            return res.status(403).json({
                error: "Este endpoint solo puede ser accedido desde localhost"
            });
        }

        // SEGURIDAD NIVEL 5: Rate limiting (máximo 5 creaciones por día)
        const today = new Date().toDateString();
        const countKey = `dev_creates_${today}`;
        // (Implementación de rate limiting aquí)

        try {
            const timestamp = Date.now();
            // Usar un dominio de prueba claramente identificable
            const correo = `admin.dev.${timestamp}@ejemplo-test.com`;

            await db.query("BEGIN");

            const hash = await bcrypt.hash("AdminDev123!", 10);
            const pin = Math.floor(100000 + Math.random() * 900000).toString();

            // Insertar usuario
            const userRes = await db.query(
                `INSERT INTO USUARIOS (
          Nombre, ApPaterno, ApMaterno, Correo, Contrasenia, 
          Rol, Telefono, Genero, PinVerificacion, PinVerificado,
          FechaNacimiento, CURP, Domicilio, CodigoPostal, 
          Localidad, Municipio, Estado, Activo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING IdUsuario`,
                [
                    "Admin", "Desarrollo", "Sistema", correo, hash,
                    "Admin", "5512345678", "Masculino", pin, true,
                    "1990-01-01", "PEAP900101HDFRRL01", "Calle Principal 123",
                    "12345", "Ciudad de México", "Cuauhtémoc", "CDMX", true
                ],
            );

            const userId = userRes.rows[0].idusuario;

            await db.query(
                `INSERT INTO ADMINISTRADORES (
          IdUsuario, NivelPermiso, AreaResponsabilidad
        ) VALUES ($1, $2, $3)`,
                [userId, "SuperAdministrador", "Sistemas"]
            );

            await db.query("COMMIT");

            res.json({
                success: true,
                message: "Administrador de desarrollo creado exitosamente",
                credentials: {
                    userId,
                    correo,
                    contrasenia: "AdminDev123!",
                    pin
                },
                security: {
                    environment: process.env.NODE_ENV,
                    createdAt: new Date().toISOString()
                }
            });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error creando admin de desarrollo:", error);
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = devController;