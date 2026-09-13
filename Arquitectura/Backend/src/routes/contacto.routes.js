const express = require('express');
const router = express.Router();
const contactoController = require('../controllers/contacto.controller');

router.post('/', contactoController.enviarMensaje);

module.exports = router;