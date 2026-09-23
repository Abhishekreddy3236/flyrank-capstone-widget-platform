'use strict';

/**
 * Centralized error handling middleware.
 * Maps Zod validation errors and application errors to clean JSON responses.
 */
function errorHandler(err, req, res, next) {
  // ZodError — validation failure
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Known application errors with explicit status codes
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.name || 'Error',
      message: err.message,
    });
  }

  // Bad JSON (SyntaxError from express body-parser)
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON in request body',
    });
  }

  // Payload too large (from express body-parser)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body exceeds the maximum allowed size',
    });
  }

  // Bad JSON (older body-parser pattern)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON in request body',
    });
  }

  // Unexpected error — log internally, don't expose details
  console.error('[ERROR]', err.message, err.stack);
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
}

/**
 * Create an application error with a specific HTTP status code.
 */
function createError(statusCode, name, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.name = name;
  return err;
}

module.exports = { errorHandler, createError };
