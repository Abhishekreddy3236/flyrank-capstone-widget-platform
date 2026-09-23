/**
 * FlyRank Widget v1.0 — Versioned embeddable widget bundle
 * 
 * Usage:
 * <script src="http://localhost:3000/widget.v1.js"
 *         data-widget-id="YOUR_WIDGET_UUID"
 *         data-config-url="http://localhost:3000/api/public/widgets/YOUR_WIDGET_UUID/config"
 *         async></script>
 */
(function () {
  'use strict';

  var WIDGET_VERSION = '1.0.0';

  // ── Find this script tag ──────────────────────────────────────────────────
  var scriptTag = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var widgetId = scriptTag.getAttribute('data-widget-id');
  var configUrl = scriptTag.getAttribute('data-config-url');

  if (!widgetId || !configUrl) {
    console.error('[FlyRank Widget] Missing data-widget-id or data-config-url attributes');
    return;
  }

  // ── Inject base styles ────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('flyrank-widget-styles')) return;
    var style = document.createElement('style');
    style.id = 'flyrank-widget-styles';
    style.textContent = [
      '.flyrank-widget-overlay{position:fixed;bottom:24px;right:24px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
      '.flyrank-widget-btn{background:#4F46E5;color:#fff;border:none;border-radius:50px;padding:14px 28px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(79,70,229,0.4);transition:transform 0.2s,box-shadow 0.2s}',
      '.flyrank-widget-btn:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(79,70,229,0.5)}',
      '.flyrank-widget-panel{background:#fff;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.18);padding:28px;width:340px;margin-top:8px;display:none}',
      '.flyrank-widget-panel.open{display:block}',
      '.flyrank-widget-panel h3{margin:0 0 6px;font-size:18px;color:#111827}',
      '.flyrank-widget-panel p{margin:0 0 18px;font-size:14px;color:#6B7280}',
      '.flyrank-widget-field{margin-bottom:14px}',
      '.flyrank-widget-field label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px}',
      '.flyrank-widget-field input,.flyrank-widget-field textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:14px;color:#111827;outline:none;transition:border-color 0.2s}',
      '.flyrank-widget-field input:focus,.flyrank-widget-field textarea:focus{border-color:#4F46E5}',
      '.flyrank-widget-submit{width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px;transition:background 0.2s}',
      '.flyrank-widget-submit:hover{background:#4338CA}',
      '.flyrank-widget-submit:disabled{background:#9CA3AF;cursor:not-allowed}',
      '.flyrank-widget-success{text-align:center;padding:12px 0;color:#059669;font-weight:600;font-size:15px}',
      '.flyrank-widget-error{color:#DC2626;font-size:13px;margin-top:8px;text-align:center}',
      '.flyrank-widget-honeypot{display:none !important;visibility:hidden !important;position:absolute !important;left:-9999px !important}',
    ].join('');
    document.head.appendChild(style);
  }

  // ── Fetch widget configuration ─────────────────────────────────────────────
  function fetchConfig(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          callback(null, JSON.parse(xhr.responseText));
        } catch (e) {
          callback(new Error('Invalid JSON response'));
        }
      } else {
        callback(new Error('Failed to load widget config: ' + xhr.status));
      }
    };
    xhr.onerror = function () { callback(new Error('Network error loading config')); };
    xhr.send();
  }

  // ── Render widget UI ──────────────────────────────────────────────────────
  function renderWidget(widgetConfig) {
    injectStyles();

    var cfg = widgetConfig.config || {};
    var fields = cfg.fields || [
      { name: 'name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
    ];
    var title = cfg.title || widgetConfig.name || 'Get in Touch';
    var description = cfg.description || '';
    var buttonText = cfg.buttonText || 'Submit';
    var successMessage = cfg.successMessage || 'Thank you!';

    // Submission API URL (derive from config URL)
    var submitUrl = configUrl.replace('/config', '/submissions');

    // Container
    var overlay = document.createElement('div');
    overlay.className = 'flyrank-widget-overlay';
    overlay.id = 'flyrank-widget-' + widgetId;

    // Toggle button
    var btn = document.createElement('button');
    btn.className = 'flyrank-widget-btn';
    btn.textContent = buttonText;

    // Panel
    var panel = document.createElement('div');
    panel.className = 'flyrank-widget-panel';

    // Build form HTML
    var formHtml = '<h3>' + escapeHtml(title) + '</h3>';
    if (description) formHtml += '<p>' + escapeHtml(description) + '</p>';

    fields.forEach(function (f) {
      formHtml += '<div class="flyrank-widget-field">';
      formHtml += '<label for="fw-' + f.name + '">' + escapeHtml(f.label) + (f.required ? ' *' : '') + '</label>';
      if (f.type === 'textarea') {
        formHtml += '<textarea id="fw-' + f.name + '" name="' + f.name + '" rows="3"></textarea>';
      } else {
        formHtml += '<input id="fw-' + f.name + '" name="' + f.name + '" type="' + f.type + '">';
      }
      formHtml += '</div>';
    });

    // Honeypot (hidden from humans, visible to bots)
    formHtml += '<input class="flyrank-widget-honeypot" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">';

    formHtml += '<button type="submit" class="flyrank-widget-submit">' + escapeHtml(buttonText) + '</button>';
    formHtml += '<div class="flyrank-widget-error" id="fw-error-' + widgetId + '" style="display:none"></div>';

    var form = document.createElement('form');
    form.id = 'fw-form-' + widgetId;
    form.innerHTML = formHtml;

    panel.appendChild(form);
    overlay.appendChild(panel);
    overlay.appendChild(btn);
    document.body.appendChild(overlay);

    // Toggle panel on button click
    btn.addEventListener('click', function () {
      panel.classList.toggle('open');
    });

    // Form submission
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitForm(form, submitUrl, fields, successMessage, panel, btn);
    });
  }

  function submitForm(form, submitUrl, fields, successMessage, panel, btn) {
    var submitBtn = form.querySelector('.flyrank-widget-submit');
    var errorDiv = form.querySelector('.flyrank-widget-error');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    if (errorDiv) errorDiv.style.display = 'none';

    // Collect form data
    var payload = { data: {} };
    fields.forEach(function (f) {
      var el = form.querySelector('[name="' + f.name + '"]');
      if (el) {
        if (f.name === 'email') {
          payload.email = el.value.trim();
        } else if (f.name === 'name') {
          payload.name = el.value.trim();
        } else {
          payload.data[f.name] = el.value.trim();
        }
      }
    });

    // Include honeypot value (bots will fill it)
    var honeypotEl = form.querySelector('[name="website"]');
    if (honeypotEl) {
      payload.website = honeypotEl.value;
    }

    // Generate a simple idempotency key
    var idempotencyKey = 'fw-' + widgetId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', submitUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Idempotency-Key', idempotencyKey);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        // Success
        form.style.display = 'none';
        var successEl = document.createElement('div');
        successEl.className = 'flyrank-widget-success';
        successEl.textContent = successMessage;
        panel.appendChild(successEl);
      } else if (xhr.status === 429) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
        if (errorDiv) {
          errorDiv.textContent = 'Too many requests. Please try again later.';
          errorDiv.style.display = 'block';
        }
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
        var msg = 'Submission failed. Please try again.';
        try {
          var resp = JSON.parse(xhr.responseText);
          msg = resp.message || msg;
        } catch (e) {}
        if (errorDiv) {
          errorDiv.textContent = msg;
          errorDiv.style.display = 'block';
        }
      }
    };
    xhr.onerror = function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      if (errorDiv) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.style.display = 'block';
      }
    };
    xhr.send(JSON.stringify(payload));
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function init() {
    fetchConfig(configUrl, function (err, config) {
      if (err) {
        console.error('[FlyRank Widget] Failed to load config:', err.message);
        return;
      }
      renderWidget(config);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
