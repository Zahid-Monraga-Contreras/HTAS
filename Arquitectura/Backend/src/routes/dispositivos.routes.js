const express = require('express');
const router = express.Router();
const dispositivosController = require('../controllers/dispositivos.controller');

router.get('/dispositivos', dispositivosController.getDispositivos);
router.post('/dispositivos', dispositivosController.crearDispositivo);
router.put('/dispositivos/:id', dispositivosController.actualizarDispositivo);
router.delete('/dispositivos/:id', dispositivosController.eliminarDispositivo);

module.exports = router;