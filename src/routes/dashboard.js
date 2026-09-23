'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const submissionRepository = require('../repositories/submissionRepository');
const widgetRepository = require('../repositories/widgetRepository');
const { createError } = require('../middleware/errorHandler');

const router = express.Router();

// All dashboard routes require authentication
router.use(authenticate);

/**
 * GET /api/dashboard/stats
 * Tenant-scoped aggregate statistics.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    
    const [totalCount, byWidget, geoData, dailyCounts] = await Promise.all([
      submissionRepository.countByTenant(tenantId),
      submissionRepository.countsByWidget(tenantId),
      submissionRepository.geoBreakdown(tenantId),
      submissionRepository.countsByDay(tenantId, null, 30),
    ]);
    
    res.json({
      total: totalCount,
      byWidget,
      geoBreakdown: geoData,
      dailyCounts,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/widgets/:widgetId/stats
 * Per-widget statistics — tenant-isolated.
 */
router.get('/widgets/:widgetId/stats', async (req, res, next) => {
  try {
    const { widgetId } = req.params;
    const tenantId = req.user.tenantId;
    
    // Verify widget belongs to this tenant
    const widget = await widgetRepository.findByIdAndTenantId(widgetId, tenantId);
    if (!widget) {
      throw createError(404, 'Not Found', 'Widget not found');
    }
    
    const [totalCount, geoData, dailyCounts] = await Promise.all([
      submissionRepository.countByTenant(tenantId, widgetId),
      submissionRepository.geoBreakdown(tenantId, widgetId),
      submissionRepository.countsByDay(tenantId, widgetId, 30),
    ]);
    
    res.json({
      widgetId,
      widgetName: widget.name,
      total: totalCount,
      geoBreakdown: geoData,
      dailyCounts,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
