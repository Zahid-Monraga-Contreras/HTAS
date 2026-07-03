const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Importar todas las rutas
const authRoutes = require('./routes/auth.routes');
const iaRoutes = require('./routes/ia.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const citasRoutes = require('./routes/citas.routes');
const medicionesRoutes = require('./routes/mediciones.routes');
const medicamentosRoutes = require('./routes/medicamentos.routes');
const tratamientosRoutes = require('./routes/tratamientos.routes');
const dispositivosRoutes = require('./routes/dispositivos.routes');
const pagosRoutes = require('./routes/pagos.routes');
const contactoRoutes = require('./routes/contacto.routes');
const googlefitRoutes = require('./routes/googlefit.routes');
const htasRoutes = require('./routes/htas.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rutas globales de la aplicación
app.use('/api/auth', authRoutes);
app.use('/api/ia', iaRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/mediciones', medicionesRoutes);
app.use('/api/medicamentos', medicamentosRoutes);
app.use('/api/tratamientos', tratamientosRoutes);
app.use('/api/dispositivos', dispositivosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/contacto', contactoRoutes);
app.use('/api/googlefit', googlefitRoutes);
app.use('/api/htas', htasRoutes);

// Endpoint para el algoritmo de Machine Learning (.pkl) en FastAPI
app.post('/api/htas/evaluar', async (req, res) => {
    try {
        // Recibimos los datos enviados desde el frontend o Postman
        const { edad, sistolica, diastolica, tomaMedicamento } = req.body;

        // Validar que todos los campos estén presentes
        if (edad === undefined || sistolica === undefined || diastolica === undefined || tomaMedicamento === undefined) {
            return res.status(400).json({
                success: false,
                error: "Faltan datos: edad, sistolica, diastolica y tomaMedicamento son requeridos"
            });
        }

        // Acomodamos los datos con las mayúsculas que espera FastAPI en Python
        const datosParaPython = {
            Edad: parseInt(edad),
            Sistolica: parseInt(sistolica),
            Diastolica: parseInt(diastolica),
            Toma_Medicamento: parseInt(tomaMedicamento)
        };

        // 🌐 Lee la URL exclusiva de tu microservicio de Python en Render
        const FASTAPI_URL = process.env.URL_FASTAPI || 'http://127.0.0.1:8000';

        // Petición directa a Render (No necesita los headers de ngrok porque ya es pública)
        const respuestaPython = await axios.post(`${FASTAPI_URL}/predecir_crisis`, datosParaPython);

        // Devolvemos la respuesta de la IA de vuelta al cliente
        return res.status(200).json({
            success: true,
            mensaje: "Evaluación de crisis HTAS completada",
            resultado: respuestaPython.data
        });

    } catch (error) {
        // Si Python arrojó el error clínico (sistólica <= diastólica)
        if (error.response) {
            return res.status(error.response.status).json({
                success: false,
                error: error.response.data.detail || error.response.data
            });
        }

        console.error("Error de conexión con FastAPI en la nube:", error.message);
        return res.status(500).json({
            success: false,
            error: "No se pudo conectar con el módulo de Inteligencia Artificial."
        });
    }
});

// Ruta de prueba para verificar que el servidor funciona
app.get('/', (req, res) => {
    res.json({
        mensaje: 'Servidor HTAS funcionando correctamente',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            ia: '/api/ia',
            usuarios: '/api/usuarios',
            citas: '/api/citas',
            mediciones: '/api/mediciones',
            medicamentos: '/api/medicamentos',
            tratamientos: '/api/tratamientos',
            dispositivos: '/api/dispositivos',
            pagos: '/api/pagos',
            contacto: '/api/contacto',
            googlefit: '/api/googlefit',
            htas: '/api/htas',
            evaluar: '/api/htas/evaluar (POST)'
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor HTAS corriendo en puerto ${PORT}`);
    console.log(`URL local: http://localhost:${PORT}`);
    console.log(`FastAPI URL: ${process.env.URL_FASTAPI || 'http://127.0.0.1:8000'}`);
    console.log('Servidor listo para recibir peticiones');
});