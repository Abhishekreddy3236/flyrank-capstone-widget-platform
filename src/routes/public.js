'use strict';

const express = require('express');
const { publicCors } = require('../middleware/cors');
const { submissionRateLimiter } = require('../middleware/rateLimiter');
const widgetService = require('../services/widgetService');
const submissionService = require('../services/submissionService');
const { validate, submissionSchema } = require('../validators');
const config = require('../config');

const router = express.Router();

// Apply public CORS to all public routes
router.use(publicCors);

// Handle OPTIONS preflight for all public routes
router.options('*', publicCors, (req, res) => {
  res.sendStatus(204);
});

/**
 * GET /api/public/widgets/:widgetId/config
 * Public widget configuration — no auth required.
 * Returns only public-safe fields with cache headers.
 */
router.get('/widgets/:widgetId/config', async (req, res, next) => {
  try {
    const { widgetId } = req.params;
    
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(widgetId)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid widget ID format' });
    }
    
    const publicConfig = await widgetService.getPublicConfig(widgetId);
    
    const cacheTtl = config.widgetConfigCacheTtl;
    res.set('Cache-Control', `public, max-age=${cacheTtl}`);
    res.set('Content-Type', 'application/json');
    res.json(publicConfig);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/public/widgets/:widgetId/submissions
 * Public submission endpoint — CORS, rate limiting, validation, spam detection.
 */
router.post(
  '/widgets/:widgetId/submissions',
  submissionRateLimiter,
  validate(submissionSchema),
  async (req, res, next) => {
    try {
      const { widgetId } = req.params;
      
      // Validate UUID format
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(widgetId)) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid widget ID format' });
      }
      
      const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
      const idempotencyKey = req.headers['idempotency-key'] || null;
      
      const result = await submissionService.processSubmission({
        widgetId,
        body: req.body,
        ip,
        idempotencyKey,
      });
      
      const statusCode = result.status === 'success' ? 201 :
                         result.status === 'duplicate' ? 200 :
                         result.status === 'dropped' ? 200 : 200;
      
      res.status(statusCode).json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
