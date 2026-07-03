const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; 

  if (!token) {
    return res.status(403).json({ error: 'No se proporcionó un token de acceso' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded; // Guardamos los datos (id, rol) en el request
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Middleware opcional para restringir por rol
const esDoctor = (req, res, next) => {
  if (req.usuario.rol !== 'Doctor') {
    return res.status(403).json({ error: 'Acceso restringido a Doctores' });
  }
  next();
};

module.exports = { verificarToken, esDoctor };