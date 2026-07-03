const express = require('express');
const router = express.Router();
const googleFitController = require('../controllers/googlefit.controller');

router.get('/google-fit/auth', googleFitController.googleFitAuth);
router.get('/google-fit/callback', googleFitController.googleFitCallback);
router.get('/google-fit/data/:idPaciente', googleFitController.googleFitData);

module.exports = router;