// api/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');

// =============================================
// CREAR APP PARA VERCEL
// =============================================
const vercelApp = express();

// Middlewares
vercelApp.use(cors());
vercelApp.use(express.json({ limit: '50mb' }));
vercelApp.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir archivos estáticos
vercelApp.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =============================================
// RUTAS DE VERIFICACIÓN (antes de la app principal)
// =============================================
vercelApp.get('/', (req, res) => {
    res.json({
        mensaje: 'HTAS API funcionando en Vercel',
        version: '1.0.0',
        entorno: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString()
    });
});

vercelApp.get('/api/estado', (req, res) => {
    res.json({
        success: true,
        mensaje: 'Servidor HTAS funcionando en Vercel',
        entorno: process.env.NODE_ENV || 'production',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// INTEGRAR LA APP PRINCIPAL (sin duplicar rutas)
// =============================================
// src/app.js ya monta TODAS las rutas, incluyendo /api/algorithm/*
// (que a su vez usa src/services/python.service.js para hablar por HTTP
// con el servicio Python desplegado en Render). No hay que duplicar
// nada aqui: si src/app.js carga bien, todo pasa por el.
try {
    const mainApp = require('../src/app');
    vercelApp.use('/', mainApp);
    console.log('App principal integrada correctamente');
} catch (error) {
    // Si esto se dispara, revisa los logs de Vercel: significa que
    // src/app.js (o algo que requiere) tiro un error al cargar.
    console.error('Error critico al cargar la app principal:', error.message);
    console.error(error.stack);

    vercelApp.use((req, res) => {
        res.status(503).json({
            success: false,
            error: 'La aplicacion principal no pudo cargarse',
            detalle: error.message
        });
    });
}

// =============================================
// MANEJO DE ERRORES
// =============================================
vercelApp.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada',
        path: req.path,
        method: req.method
    });
});

vercelApp.use((err, req, res, next) => {
    console.error('Error global en Vercel:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        mensaje: err.message || 'Error desconocido'
    });
});

// =============================================
module.exports = vercelApp;