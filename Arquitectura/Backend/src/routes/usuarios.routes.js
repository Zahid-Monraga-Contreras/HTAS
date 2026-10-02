const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');

/**
 * @swagger
 * /api/usuarios/all-users:
 *   get:
 *     summary: Endpoint for GET /all-users
 *     tags: [Usuarios]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/all-users', usuariosController.getAllUsers);
/**
 * @swagger
 * /api/usuarios/update-user/{id}:
 *   put:
 *     summary: Endpoint for PUT /update-user/:id
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.put('/update-user/:id', usuariosController.updateUsuario);
/**
 * @swagger
 * /api/usuarios/delete-user/{id}:
 *   delete:
 *     summary: Endpoint for DELETE /delete-user/:id
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.delete('/delete-user/:id', usuariosController.deleteUsuario);

// ✅ NUEVA RUTA: Obtener usuario por ID
/**
 * @swagger
 * /api/usuarios/usuario/{id}:
 *   get:
 *     summary: Endpoint for GET /usuario/:id
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/usuario/:id', usuariosController.getUserById);

// ✅ NUEVA RUTA: Obtener paciente por ID (opcional, para datos específicos)
/**
 * @swagger
 * /api/usuarios/paciente/{id}:
 *   get:
 *     summary: Endpoint for GET /paciente/:id
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/paciente/:id', usuariosController.getPacienteById);

// ✅ NUEVA RUTA: Crear usuario (si la necesitas)
/**
 * @swagger
 * /api/usuarios/crear-usuario:
 *   post:
 *     summary: Endpoint for POST /crear-usuario
 *     tags: [Usuarios]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/crear-usuario', usuariosController.createUsuario);

module.exports = router;