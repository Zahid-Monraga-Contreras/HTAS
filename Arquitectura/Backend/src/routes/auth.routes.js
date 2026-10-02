const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     description: Crea un usuario nuevo en el sistema (ej. paciente, acompañante, médico).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Juan Pérez
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan@ejemplo.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: ContraseñaSegura123
 *               rol:
 *                 type: string
 *                 example: PACIENTE
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Error de validación o usuario ya existe
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: Permite a los usuarios acceder al sistema y obtener un token JWT.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan@ejemplo.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: ContraseñaSegura123
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve el token JWT
 *       401:
 *         description: Credenciales incorrectas
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/verify-pin:
 *   post:
 *     summary: Verificar PIN de seguridad
 *     description: Valida el PIN (OTP) enviado al usuario (por correo o SMS).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - pin
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan@ejemplo.com
 *               pin:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: PIN verificado correctamente
 *       400:
 *         description: PIN incorrecto o expirado
 */
router.post('/verify-pin', authController.verificarPin);

/**
 * @swagger
 * /api/auth/request-new-pin:
 *   post:
 *     summary: Solicitar un nuevo PIN
 *     description: Reenvía el código PIN al usuario en caso de que lo haya perdido o expirado.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan@ejemplo.com
 *     responses:
 *       200:
 *         description: Nuevo PIN enviado exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/request-new-pin', authController.solicitarNuevoPin);

/**
 * @swagger
 * /api/auth/google-login:
 *   post:
 *     summary: Iniciar sesión con Google
 *     description: Inicia sesión o registra un usuario automáticamente a través del token de Google.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: ID Token proporcionado por Google SDK
 *                 example: eyJhbGciOiJSUzI1NiIsImtp...
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve JWT de la app
 *       401:
 *         description: Token de Google inválido
 */
router.post('/google-login', authController.googleLogin);

module.exports = router;