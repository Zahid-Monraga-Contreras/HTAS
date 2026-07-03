const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');

router.get('/all-users', usuariosController.getAllUsers);
router.put('/update-user/:id', usuariosController.updateUsuario);
router.delete('/delete-user/:id', usuariosController.deleteUsuario);

module.exports = router;