const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-pin', authController.verificarPin);
router.post('/request-new-pin', authController.solicitarNuevoPin);
router.post('/google-login', authController.googleLogin);

module.exports = router;