// api/index.js
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
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
        mensaje: '✅ HTAS API funcionando en Vercel',
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
try {
    const mainApp = require('../app');

    // IMPORTANTE: Usamos la app principal pero excluimos rutas específicas
    // que ya hemos definido en Vercel
    vercelApp.use('/api', mainApp);
    console.log('✅ App principal integrada correctamente');
} catch (error) {
    console.warn('⚠️ Error al cargar app principal:', error.message);

    // Fallback: cargar rutas directamente
    console.log('📦 Cargando rutas directamente...');
    loadRoutesDirectly();
}

// Función de fallback para cargar rutas directamente
function loadRoutesDirectly() {
    const routes = [
        { path: '/api/auth', file: '../src/routes/auth.routes' },
        { path: '/api/usuarios', file: '../src/routes/usuarios.routes' },
        { path: '/api/citas', file: '../src/routes/citas.routes' },
        { path: '/api/mediciones', file: '../src/routes/mediciones.routes' },
        { path: '/api/medicamentos', file: '../src/routes/medicamentos.routes' },
        { path: '/api/tratamientos', file: '../src/routes/tratamientos.routes' },
        { path: '/api/tomas', file: '../src/routes/tomas.routes' },
        { path: '/api/dispositivos', file: '../src/routes/dispositivos.routes' },
        { path: '/api/pagos', file: '../src/routes/pagos.routes' },
        { path: '/api/contacto', file: '../src/routes/contacto.routes' },
        { path: '/api/googlefit', file: '../src/routes/googlefit.routes' },
        { path: '/api/solicitudes', file: '../src/routes/solicitudes.routes' },
        { path: '/api/algorithm', file: '../src/routes/algorithm.routes' }
    ];

    routes.forEach(route => {
        try {
            const routeModule = require(route.file);
            vercelApp.use(route.path, routeModule);
            console.log(`✅ Ruta cargada: ${route.path}`);
        } catch (error) {
            console.warn(`⚠️ Ruta no encontrada: ${route.path}`);
        }
    });
}

// =============================================
// PROXY PARA PYTHON (solo si no hay rutas de algorithm)
// =============================================
vercelApp.all('/api/algorithm/*', async (req, res, next) => {
    // Si ya hay una ruta definida, no interferimos
    if (req.route && req.route.path) {
        return next();
    }

    try {
        const axios = require('axios');
        const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

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
        console.error('Error en proxy Python:', error.message);

        // Respuesta mock para desarrollo
        if (process.env.NODE_ENV !== 'production') {
            return res.json({
                success: true,
                mensaje: 'Mock response - Python API en desarrollo',
                timestamp: new Date().toISOString(),
                datos_ejemplo: {
                    idPaciente: 1,
                    analisis: 'Paciente estable',
                    probabilidad: 15.5
                }
            });
        }

        res.status(500).json({
            success: false,
            error: 'Python API no disponible',
            mensaje: 'Intenta nuevamente más tarde'
        });
    }
});

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
// EXPORTAR PARA VERCEL
// =============================================
module.exports = vercelApp;
module.exports.handler = serverless(vercelApp);