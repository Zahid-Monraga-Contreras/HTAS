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
/**
 * @swagger
 * /api/asignaciones/asignaciones:
 *   get:
 *     summary: Endpoint for GET /asignaciones
 *     tags: [Asignaciones]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/asignaciones', asignacionesController.getAllAsignaciones);

// Obtener una asignación por ID
/**
 * @swagger
 * /api/asignaciones/asignacion/{id}:
 *   get:
 *     summary: Endpoint for GET /asignacion/:id
 *     tags: [Asignaciones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/asignacion/:id', asignacionesController.getAsignacionById);

// Estadísticas de asignaciones
/**
 * @swagger
 * /api/asignaciones/estadisticas:
 *   get:
 *     summary: Endpoint for GET /estadisticas
 *     tags: [Asignaciones]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/estadisticas', asignacionesController.getEstadisticasAsignaciones);

// ============================================
// RUTAS PARA DOCTORES
// ============================================

// Obtener todos los doctores (con conteo de pacientes)
/**
 * @swagger
 * /api/asignaciones/doctores:
 *   get:
 *     summary: Endpoint for GET /doctores
 *     tags: [Asignaciones]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/doctores', asignacionesController.getDoctores);

// Obtener doctor por ID (con detalles)
/**
 * @swagger
 * /api/asignaciones/doctor/{id}:
 *   get:
 *     summary: Endpoint for GET /doctor/:id
 *     tags: [Asignaciones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/doctor/:id', asignacionesController.getDoctorById);

// Obtener pacientes de un doctor específico
/**
 * @swagger
 * /api/asignaciones/doctor/{idDoctor}/pacientes:
 *   get:
 *     summary: Endpoint for GET /doctor/:idDoctor/pacientes
 *     tags: [Asignaciones]
 *     parameters:
 *       - in: path
 *         name: idDoctor
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/doctor/:idDoctor/pacientes', asignacionesController.getPacientesByDoctor);

// Obtener pacientes asignados a un doctor (con detalles completos)
/**
 * @swagger
 * /api/asignaciones/doctor/{idDoctor}/pacientes-detalle:
 *   get:
 *     summary: Endpoint for GET /doctor/:idDoctor/pacientes-detalle
 *     tags: [Asignaciones]
 *     parameters:
 *       - in: path
 *         name: idDoctor
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/doctor/:idDoctor/pacientes-detalle', asignacionesController.getPacientesAsignadosDetalle);

// Desasignar todos los pacientes de un doctor
/**
 * @swagger
 * /api/asignaciones/doctor/{idDoctor}/desasignar-todos:
 *   delete:
 *     summary: Endpoint for DELETE /doctor/:idDoctor/desasignar-todos
 *     tags: [Asignaciones]
 *     parameters:
 *       - in: path
 *         name: idDoctor
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.delete('/doctor/:idDoctor/desasignar-todos', asignacionesController.desasignarTodosPacientes);

// ============================================
// RUTAS PARA PACIENTES
// ============================================

// Obtener todos los pacientes (con información de asignación)
/**
 * @swagger
 * /api/asignaciones/pacientes:
 *   get:
 *     summary: Endpoint for GET /pacientes
 *     tags: [Asignaciones]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/pacientes', asignacionesController.getAllPacientes);

// Obtener pacientes sin asignar
/**
 * @swagger
 * /api/asignaciones/pacientes/sin-asignar:
 *   get:
 *     summary: Endpoint for GET /pacientes/sin-asignar
 *     tags: [Asignaciones]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/pacientes/sin-asignar', asignacionesController.getPacientesSinAsignar);

// Obtener doctor de un paciente específico
/**
 * @swagger
 * /api/asignaciones/paciente/{idPaciente}/doctor:
 *   get:
 *     summary: Endpoint for GET /paciente/:idPaciente/doctor
 *     tags: [Asignaciones]
 *     parameters:
 *       - in: path
 *         name: idPaciente
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/paciente/:idPaciente/doctor', asignacionesController.getDoctorByPaciente);

// Verificar si paciente tiene doctor asignado
/**
 * @swagger
 * /api/asignaciones/paciente/{idPaciente}/verificar:
 *   get:
 *     summary: Endpoint for GET /paciente/:idPaciente/verificar
 *     tags: [Asignaciones]
 *     parameters:
 *       - in: path
 *         name: idPaciente
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/paciente/:idPaciente/verificar', asignacionesController.verificarPacienteAsignado);

// ============================================
// RUTAS DE ASIGNACIÓN Y DESASIGNACIÓN
// ============================================

// Asignar paciente a doctor
/**
 * @swagger
 * /api/asignaciones/asignar:
 *   post:
 *     summary: Endpoint for POST /asignar
 *     tags: [Asignaciones]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/asignar', asignacionesController.asignarPaciente);

// Asignar múltiples pacientes a un doctor
/**
 * @swagger
 * /api/asignaciones/asignar-multiples:
 *   post:
 *     summary: Endpoint for POST /asignar-multiples
 *     tags: [Asignaciones]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/asignar-multiples', asignacionesController.asignarMultiplesPacientes);

// Desasignar paciente de doctor
/**
 * @swagger
 * /api/asignaciones/desasignar:
 *   post:
 *     summary: Endpoint for POST /desasignar
 *     tags: [Asignaciones]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/desasignar', asignacionesController.desasignarPaciente);

module.exports = router;