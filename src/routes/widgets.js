'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const widgetService = require('../services/widgetService');
const { validate, createWidgetSchema, updateWidgetSchema } = require('../validators');
const config = require('../config');

const router = express.Router();

// All widget management routes require authentication
router.use(authenticate);

// GET /api/widgets — list all widgets for the authenticated tenant
router.get('/', async (req, res, next) => {
  try {
    const widgets = await widgetService.getWidgets(req.user.tenantId);
    res.json({ widgets, count: widgets.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/widgets — create a widget
router.post('/', validate(createWidgetSchema), async (req, res, next) => {
  try {
    const { name, type, config: widgetConfig, active } = req.body;
    const widget = await widgetService.createWidget({
      tenantId: req.user.tenantId,
      name,
      type,
      widgetConfig,
      active,
    });
    res.status(201).json({ widget });
  } catch (err) {
    next(err);
  }
});

// GET /api/widgets/:id — get a single widget
router.get('/:id', async (req, res, next) => {
  try {
    const widget = await widgetService.getWidget(req.params.id, req.user.tenantId);
    res.json({ widget });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/widgets/:id — update a widget
router.patch('/:id', validate(updateWidgetSchema), async (req, res, next) => {
  try {
    const { name, type, config: widgetConfig, active } = req.body;
    const widget = await widgetService.updateWidget(req.params.id, req.user.tenantId, {
      name,
      type,
      config: widgetConfig,
      active,
    });
    res.json({ widget });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/widgets/:id — delete a widget
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await widgetService.deleteWidget(req.params.id, req.user.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/widgets/:id/snippet — get the embed snippet
router.get('/:id/snippet', async (req, res, next) => {
  try {
    const widget = await widgetService.getWidget(req.params.id, req.user.tenantId);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const snippet = widgetService.generateEmbedSnippet(widget, baseUrl);
    res.json({
      widgetId: widget.id,
      snippet,
      instructions: 'Paste this <script> tag into your website HTML.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
