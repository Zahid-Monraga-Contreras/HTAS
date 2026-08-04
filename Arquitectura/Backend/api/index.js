// Backend/api/index.js
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const path = require('path');
const axios = require('axios');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =============================================
// RUTA PRINCIPAL (¡PONER AQUÍ, ANTES DE TODO!)
// =============================================
app.get('/', (req, res) => {
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
// RUTA DE ESTADO (también antes del proxy)
// =============================================
app.get('/api/estado', (req, res) => {
    res.json({
        success: true,
        mensaje: 'Servidor HTAS funcionando',
        entorno: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// REDIRIGIR A PYTHON PARA RUTAS DE ALGORITHM
// =============================================
const PYTHON_API_URL = process.env.PYTHON_API_URL || '/python-api';

app.use('/api/algorithm', async (req, res, next) => {
    // Si la ruta es de análisis, redirigir a Python
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
// TUS RUTAS EXISTENTES
// =============================================
app.use('/api/auth', require('../src/routes/auth.routes'));
app.use('/api/usuarios', require('../src/routes/usuarios.routes'));
app.use('/api/citas', require('../src/routes/citas.routes'));
app.use('/api/mediciones', require('../src/routes/mediciones.routes'));
app.use('/api/medicamentos', require('../src/routes/medicamentos.routes'));
app.use('/api/tratamientos', require('../src/routes/tratamientos.routes'));
app.use('/api/tomas', require('../src/routes/tomas.routes'));
app.use('/api/dispositivos', require('../src/routes/dispositivos.routes'));
app.use('/api/pagos', require('../src/routes/pagos.routes'));
app.use('/api/contacto', require('../src/routes/contacto.routes'));
app.use('/api/googlefit', require('../src/routes/googlefit.routes'));
app.use('/api/solicitudes', require('../src/routes/solicitudes.routes'));

// Manejo de errores
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// =============================================
// EXPORTAR PARA VERCEL
// =============================================
module.exports = app;
module.exports.handler = serverless(app);