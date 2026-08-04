// Backend/api/index.js
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const path = require('path');
const axios = require('axios');

// Importar tu app original
const app = require('../src/app');

// =============================================
// SOBREESCRIBIR LA RUTA PRINCIPAL PARA VERCEL
// =============================================
// Guardamos la app original y la modificamos
const vercelApp = express();

// Middlewares
vercelApp.use(cors());
vercelApp.use(express.json({ limit: '50mb' }));
vercelApp.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir archivos estáticos
vercelApp.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =============================================
// RUTA PRINCIPAL PARA VERCEL
// =============================================
vercelApp.get('/', (req, res) => {
    res.json({
        mensaje: '✅ HTAS API funcionando en Vercel',
        version: '1.0.0',
        endpoints: {
            estado: '/api/estado',
            usuarios: '/api/usuarios',
            login: '/api/auth/login',
            python: '/api/algorithm/estado'
        },
        timestamp: new Date().toISOString()
    });
});

// =============================================
// RUTA DE ESTADO
// =============================================
vercelApp.get('/api/estado', (req, res) => {
    res.json({
        success: true,
        mensaje: 'Servidor HTAS funcionando',
        entorno: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// PROXY A PYTHON
// =============================================
const PYTHON_API_URL = process.env.PYTHON_API_URL || '/python-api';

vercelApp.use('/api/algorithm', async (req, res, next) => {
    if (req.path.includes('analizar') ||
        req.path.includes('ultimo-expediente') ||
        req.path.includes('pdf') ||
        req.path.includes('estado')) {
        try {
            const response = await axios({
                method: req.method,
                url: `${PYTHON_API_URL}${req.path}`,
                data: req.body,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': req.headers.authorization || ''
                }
            });
            return res.json(response.data);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    next();
});

// =============================================
// USAR LAS RUTAS DE LA APP ORIGINAL
// =============================================
vercelApp.use('/api/auth', require('../src/routes/auth.routes'));
vercelApp.use('/api/usuarios', require('../src/routes/usuarios.routes'));
vercelApp.use('/api/citas', require('../src/routes/citas.routes'));
vercelApp.use('/api/mediciones', require('../src/routes/mediciones.routes'));
vercelApp.use('/api/medicamentos', require('../src/routes/medicamentos.routes'));
vercelApp.use('/api/tratamientos', require('../src/routes/tratamientos.routes'));
vercelApp.use('/api/tomas', require('../src/routes/tomas.routes'));
vercelApp.use('/api/dispositivos', require('../src/routes/dispositivos.routes'));
vercelApp.use('/api/pagos', require('../src/routes/pagos.routes'));
vercelApp.use('/api/contacto', require('../src/routes/contacto.routes'));
vercelApp.use('/api/googlefit', require('../src/routes/googlefit.routes'));
vercelApp.use('/api/solicitudes', require('../src/routes/solicitudes.routes'));

// =============================================
// MANEJO DE ERRORES
// =============================================
vercelApp.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
    });
});

vercelApp.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
    });
});

// =============================================
// EXPORTAR PARA VERCEL
// =============================================
module.exports = vercelApp;
module.exports.handler = serverless(vercelApp);