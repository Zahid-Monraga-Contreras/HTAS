const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const solicitudesController = require('../controllers/solicitudes.controller');

// ============================================
// MIDDLEWARE DE AUTENTICACIÓN CON JWT
// ============================================

/**
 * Verifica que el token JWT sea válido
 * y extrae la información del usuario
 */
const verificarAutenticacion = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'No autorizado. Token no proporcionado.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id: usuario.id, rol: usuario.rol }
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado. Inicia sesión nuevamente.'
            });
        }
        return res.status(401).json({
            error: 'Token inválido.'
        });
    }
};

/**
 * Verifica que el usuario sea ADMIN
 */
const verificarAdmin = (req, res, next) => {
    const userRol = req.user?.rol?.toLowerCase();

    if (!userRol || !['admin', 'administrador'].includes(userRol)) {
        return res.status(403).json({
            error: 'Acceso denegado. Se requiere rol de administrador.'
        });
    }

    next();
};

/**
 * Verifica que el usuario autenticado sea el mismo que el ID del acompañante
 * o que sea admin
 */
const verificarPropietarioOAdmin = (req, res, next) => {
    const userId = req.user?.id;
    const idAcompanante = parseInt(req.params.idAcompanante);
    const userRol = req.user?.rol?.toLowerCase();

    // Si es admin, permite todo
    if (['admin', 'administrador'].includes(userRol)) {
        return next();
    }

    // Si no es admin, verifica que sea el mismo usuario
    if (userId !== idAcompanante) {
        return res.status(403).json({
            error: 'No tienes permiso para realizar esta acción'
        });
    }

    next();
};

// ============================================
// RUTAS PARA ACOMPAÑANTE (Requieren autenticación)
// ============================================

/**
 * POST /api/solicitudes/solicitar/:idAcompanante
 * Acompañante solicita acceso a un paciente
 */
router.post(
    '/solicitar/:idAcompanante',
    verificarAutenticacion,
    verificarPropietarioOAdmin,
    solicitudesController.solicitarAsignacion
);

/**
 * GET /api/solicitudes/mis-solicitudes/:idAcompanante
 * Acompañante obtiene sus solicitudes
 */
router.get(
    '/mis-solicitudes/:idAcompanante',
    verificarAutenticacion,
    verificarPropietarioOAdmin,
    solicitudesController.getSolicitudesByAcompanante
);

/**
 * GET /api/solicitudes/mis-pacientes/:idAcompanante
 * Acompañante obtiene sus pacientes asignados
 */
router.get(
    '/mis-pacientes/:idAcompanante',
    verificarAutenticacion,
    verificarPropietarioOAdmin,
    solicitudesController.getPacientesAsignados
);

// ============================================
// RUTAS PARA ADMIN (Requieren autenticación y rol admin)
// ============================================

/**
 * GET /api/solicitudes/pendientes
 * Admin obtiene todas las solicitudes pendientes
 */
router.get(
    '/pendientes',
    verificarAutenticacion,
    verificarAdmin,
    solicitudesController.getSolicitudesPendientes
);

/**
 * PUT /api/solicitudes/aprobar/:idSolicitud
 * Admin aprueba una solicitud
 */
router.put(
    '/aprobar/:idSolicitud',
    verificarAutenticacion,
    verificarAdmin,
    solicitudesController.aprobarSolicitud
);

/**
 * PUT /api/solicitudes/rechazar/:idSolicitud
 * Admin rechaza una solicitud
 */
router.put(
    '/rechazar/:idSolicitud',
    verificarAutenticacion,
    verificarAdmin,
    solicitudesController.rechazarSolicitud
);

/**
 * DELETE /api/solicitudes/asignacion/:idAsignacion
 * Admin elimina una asignación
 */
router.delete(
    '/asignacion/:idAsignacion',
    verificarAutenticacion,
    verificarAdmin,
    solicitudesController.eliminarAsignacion
);

module.exports = router;