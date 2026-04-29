const multer = require('multer');

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  });
}

function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      success: false,
      error: err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file exceeds the 10MB limit' : 'Multipart upload failed',
      details: { code: err.code },
    });
  }

  const status = err.status || 500;

  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
    details: err.details || null,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
