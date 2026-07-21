const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

// Importar todas las rutas
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const citasRoutes = require('./routes/citas.routes');
const medicionesRoutes = require('./routes/mediciones.routes');
const medicamentosRoutes = require('./routes/medicamentos.routes');
const tratamientosRoutes = require('./routes/tratamientos.routes');
const tomasRoutes = require('./routes/tomas.routes');
const dispositivosRoutes = require('./routes/dispositivos.routes');
const pagosRoutes = require('./routes/pagos.routes');
const contactoRoutes = require('./routes/contacto.routes');
const googlefitRoutes = require('./routes/googlefit.routes');
const algorithmRoutes = require('./routes/algorithm.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas globales de la aplicación
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/mediciones', medicionesRoutes);
app.use('/api/medicamentos', medicamentosRoutes);
app.use('/api/tratamientos', tratamientosRoutes);
app.use('/api/tomas', tomasRoutes);
app.use('/api/dispositivos', dispositivosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/contacto', contactoRoutes);
app.use('/api/googlefit', googlefitRoutes);
app.use('/api/algorithm', algorithmRoutes);

// Ruta de prueba para verificar que el servidor funciona
app.get('/', (req, res) => {
    res.json({
        mensaje: 'Servidor HTAS funcionando correctamente',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            usuarios: '/api/usuarios',
            citas: '/api/citas',
            mediciones: '/api/mediciones',
            medicamentos: '/api/medicamentos',
            tratamientos: '/api/tratamientos',
            tomas: '/api/tomas',
            dispositivos: '/api/dispositivos',
            pagos: '/api/pagos',
            contacto: '/api/contacto',
            googlefit: '/api/googlefit',
            algoritmo: {
                'POST /api/algorithm/analizar': 'Analizar con un PDF (requiere autenticación)',
                'POST /api/algorithm/analizar-completo': 'Analizar con dos PDFs (requiere autenticación)',
                'GET /api/algorithm/estado': 'Verificar estado del sistema'
            }
        }
    });
});

// Manejo de errores 404 - Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error global:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
    });
});

// Carga segura de rutas de desarrollo
if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_ENDPOINTS === 'true') {
    try {
        const devRoutes = require('./routes/dev.routes');
        app.use('/api/dev', devRoutes);
        console.log('Rutas de desarrollo activadas');
    } catch (error) {
        console.log('Rutas de desarrollo no disponibles (archivos no encontrados)');
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor HTAS corriendo en puerto ${PORT}`);
    console.log(`URL local: http://localhost:${PORT}`);
    console.log(`FastAPI URL: ${process.env.URL_FASTAPI || 'http://127.0.0.1:8000'}`);
    console.log('Servidor listo para recibir peticiones');
});