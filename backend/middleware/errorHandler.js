const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('HTTP', `${req.method} ${req.url} — ${err.message}`, err.stack);

  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    detail: err.message || 'Internal Server Error',
    status: 'error',
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;
