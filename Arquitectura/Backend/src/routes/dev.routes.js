// src/routes/dev.routes.js
const express = require('express');
const router = express.Router();
const devController = require('../controllers/dev.controller');

// Middleware para verificar que estamos en desarrollo
const checkDevelopment = (req, res, next) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({
            error: "Rutas de desarrollo no disponibles en producción"
        });
    }
    if (process.env.ALLOW_DEV_ENDPOINTS !== 'true') {
        return res.status(403).json({
            error: "Endpoints de desarrollo deshabilitados"
        });
    }
    next();
};

// Todas las rutas de desarrollo usan el middleware
router.use(checkDevelopment);

// Ruta para crear administradores de prueba
router.post('/create-test-admin', devController.createTestAdmin);

// Ruta para limpiar usuarios de prueba (opcional)
router.delete('/clean-test-admins', async (req, res) => {
    // Solo limpia usuarios con dominio @ejemplo-test.com
    await db.query(
        `DELETE FROM USUARIOS WHERE Correo LIKE '%@ejemplo-test.com'`
    );
    res.json({ message: "Usuarios de prueba eliminados" });
});

module.exports = router;