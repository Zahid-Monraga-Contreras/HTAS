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
const solicitudesRoutes = require('./routes/solicitudes.routes');
const asignacionesRoutes = require('./routes/asignaciones.routes');

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
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/asignaciones', asignacionesRoutes);

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
                'POST /api/algorithm/analizar': 'Analizar con un PDF (requiere autenticacion)',
                'POST /api/algorithm/analizar-completo': 'Analizar con dos PDFs (cedula + diagnostico)',
                'GET /api/algorithm/ultimo-expediente/:idPaciente': 'Obtener ultimo expediente de un paciente',
                'GET /api/algorithm/pdf/:folio': 'Descargar PDF de un expediente por folio',
                'GET /api/algorithm/estado': 'Verificar estado del sistema'
            },
            solicitudes: {
                'POST /api/solicitudes/solicitar/:idAcompanante': 'Solicitar asignación de paciente',
                'GET /api/solicitudes/mis-solicitudes/:idAcompanante': 'Obtener solicitudes del acompañante',
                'GET /api/solicitudes/mis-pacientes/:idAcompanante': 'Obtener pacientes asignados',
                'GET /api/solicitudes/todas': 'Obtener TODAS las solicitudes (solo admin)',
                'GET /api/solicitudes/pendientes': 'Obtener solicitudes pendientes (solo admin)',
                'PUT /api/solicitudes/aprobar/:idSolicitud': 'Aprobar solicitud (solo admin)',
                'PUT /api/solicitudes/rechazar/:idSolicitud': 'Rechazar solicitud (solo admin)',
                'DELETE /api/solicitudes/asignacion/:idAsignacion': 'Eliminar asignación (solo admin)'
            },
            asignaciones: {
                'GET /api/asignaciones/asignaciones': 'Obtener todas las asignaciones',
                'GET /api/asignaciones/asignacion/:id': 'Obtener una asignación por ID',
                'GET /api/asignaciones/estadisticas': 'Estadísticas de asignaciones',
                'GET /api/asignaciones/doctores': 'Obtener todos los doctores (con conteo de pacientes)',
                'GET /api/asignaciones/doctor/:id': 'Obtener doctor por ID (con detalles)',
                'GET /api/asignaciones/doctor/:idDoctor/pacientes': 'Obtener pacientes de un doctor específico',
                'GET /api/asignaciones/doctor/:idDoctor/pacientes-detalle': 'Obtener pacientes asignados a un doctor (con detalles completos)',
                'DELETE /api/asignaciones/doctor/:idDoctor/desasignar-todos': 'Desasignar todos los pacientes de un doctor',
                'GET /api/asignaciones/pacientes': 'Obtener todos los pacientes (con información de asignación)',
                'GET /api/asignaciones/pacientes/sin-asignar': 'Obtener pacientes sin asignar',
                'GET /api/asignaciones/paciente/:idPaciente/doctor': 'Obtener doctor de un paciente específico',
                'GET /api/asignaciones/paciente/:idPaciente/verificar': 'Verificar si paciente tiene doctor asignado',
                'POST /api/asignaciones/asignar': 'Asignar paciente a doctor',
                'POST /api/asignaciones/asignar-multiples': 'Asignar múltiples pacientes a un doctor',
                'POST /api/asignaciones/desasignar': 'Desasignar paciente de doctor'
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