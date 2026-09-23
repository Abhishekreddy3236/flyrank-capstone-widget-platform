'use strict';

const widgetRepository = require('../repositories/widgetRepository');
const config = require('../config');
const { createError } = require('../middleware/errorHandler');

async function createWidget({ tenantId, name, type, widgetConfig, active }) {
  return widgetRepository.create({ tenantId, name, type, config: widgetConfig, active });
}

async function getWidgets(tenantId) {
  return widgetRepository.findByTenantId(tenantId);
}

async function getWidget(id, tenantId) {
  const widget = await widgetRepository.findByIdAndTenantId(id, tenantId);
  if (!widget) {
    throw createError(404, 'Not Found', 'Widget not found');
  }
  return widget;
}

async function updateWidget(id, tenantId, updates) {
  const widget = await widgetRepository.update(id, tenantId, updates);
  if (!widget) {
    throw createError(404, 'Not Found', 'Widget not found');
  }
  return widget;
}

async function deleteWidget(id, tenantId) {
  const widget = await widgetRepository.remove(id, tenantId);
  if (!widget) {
    throw createError(404, 'Not Found', 'Widget not found');
  }
  return { deleted: true, id };
}

/**
 * Generate the embed snippet for a widget.
 * Returns a <script> tag that a customer pastes into their site.
 */
function generateEmbedSnippet(widget, baseUrl) {
  const url = baseUrl || `http://localhost:${config.port}`;
  return `<script src="${url}/widget.v1.js" data-widget-id="${widget.id}" data-config-url="${url}/api/public/widgets/${widget.id}/config" async></script>`;
}

/**
 * Get public-safe widget configuration (no secrets).
 */
async function getPublicConfig(widgetId) {
  const widget = await widgetRepository.findByIdPublic(widgetId);
  if (!widget) {
    throw createError(404, 'Not Found', 'Widget not found or inactive');
  }
  // Return only public-safe fields
  return {
    id: widget.id,
    name: widget.name,
    type: widget.type,
    version: widget.version,
    config: widget.config,
  };
}

module.exports = { createWidget, getWidgets, getWidget, updateWidget, deleteWidget, generateEmbedSnippet, getPublicConfig };
