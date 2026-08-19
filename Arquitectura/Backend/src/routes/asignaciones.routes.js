// ============================================
// routes/asignaciones.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const asignacionesController = require('../controllers/asignaciones.controller');

// ============================================
// RUTAS PRINCIPALES
// ============================================

// Obtener todas las asignaciones
router.get('/asignaciones', asignacionesController.getAllAsignaciones);

// Obtener una asignación por ID
router.get('/asignacion/:id', asignacionesController.getAsignacionById);

// Estadísticas de asignaciones
router.get('/estadisticas', asignacionesController.getEstadisticasAsignaciones);

// ============================================
// RUTAS PARA DOCTORES
// ============================================

// Obtener todos los doctores (con conteo de pacientes)
router.get('/doctores', asignacionesController.getDoctores);

// Obtener doctor por ID (con detalles)
router.get('/doctor/:id', asignacionesController.getDoctorById);

// Obtener pacientes de un doctor específico
router.get('/doctor/:idDoctor/pacientes', asignacionesController.getPacientesByDoctor);

// Obtener pacientes asignados a un doctor (con detalles completos)
router.get('/doctor/:idDoctor/pacientes-detalle', asignacionesController.getPacientesAsignadosDetalle);

// Desasignar todos los pacientes de un doctor
router.delete('/doctor/:idDoctor/desasignar-todos', asignacionesController.desasignarTodosPacientes);

// ============================================
// RUTAS PARA PACIENTES
// ============================================

// Obtener todos los pacientes (con información de asignación)
router.get('/pacientes', asignacionesController.getAllPacientes);

// Obtener pacientes sin asignar
router.get('/pacientes/sin-asignar', asignacionesController.getPacientesSinAsignar);

// Obtener doctor de un paciente específico
router.get('/paciente/:idPaciente/doctor', asignacionesController.getDoctorByPaciente);

// Verificar si paciente tiene doctor asignado
router.get('/paciente/:idPaciente/verificar', asignacionesController.verificarPacienteAsignado);

// ============================================
// RUTAS DE ASIGNACIÓN Y DESASIGNACIÓN
// ============================================

// Asignar paciente a doctor
router.post('/asignar', asignacionesController.asignarPaciente);

// Asignar múltiples pacientes a un doctor
router.post('/asignar-multiples', asignacionesController.asignarMultiplesPacientes);

// Desasignar paciente de doctor
router.post('/desasignar', asignacionesController.desasignarPaciente);

module.exports = router;