const { AppError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, detalles: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

module.exports = { errorHandler, notFoundHandler };
