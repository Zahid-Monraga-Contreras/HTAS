const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');

router.get('/all-users', usuariosController.getAllUsers);
router.put('/update-user/:id', usuariosController.updateUsuario);
router.delete('/delete-user/:id', usuariosController.deleteUsuario);

// ✅ NUEVA RUTA: Obtener usuario por ID
router.get('/usuario/:id', usuariosController.getUserById);

// ✅ NUEVA RUTA: Obtener paciente por ID (opcional, para datos específicos)
router.get('/paciente/:id', usuariosController.getPacienteById);

// ✅ NUEVA RUTA: Crear usuario (si la necesitas)
router.post('/crear-usuario', usuariosController.createUsuario);

module.exports = router;