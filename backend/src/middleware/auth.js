const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized, forbidden } = require('../utils/errors');

function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, rol: payload.rol, nombre: payload.nombre };
    return next();
  } catch {
    return next(unauthorized('Token inválido o expirado'));
  }
}

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.rol)) return next(forbidden());
  return next();
};

module.exports = { authenticate, authorize };
