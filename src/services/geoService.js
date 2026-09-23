'use strict';

const fetch = require('node-fetch');
const config = require('../config');

// Allow external test injection
let _providerOverride = null;

function setProviderOverride(override) {
  _providerOverride = override;
}

function clearProviderOverride() {
  _providerOverride = null;
}

/**
 * Fetch geo data from ip-api.com (Provider A).
 * Returns normalized geo object or throws.
 */
async function fetchFromProviderA(ip) {
  const url = `${config.geo.providerAUrl}/${ip}?fields=status,country,countryCode,region,city,lat,lon,isp`;
  const response = await fetch(url, { timeout: 5000 });
  
  if (!response.ok) {
    throw new Error(`Provider A HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.status !== 'success') {
    throw new Error(`Provider A returned status: ${data.status}`);
  }
  
  return {
    country: data.country,
    countryCode: data.countryCode,
    region: data.region,
    city: data.city,
    lat: data.lat,
    lon: data.lon,
    isp: data.isp,
    provider: 'ip-api.com',
  };
}

/**
 * Fetch geo data from ipapi.co (Provider B).
 * Returns normalized geo object or throws.
 */
async function fetchFromProviderB(ip) {
  const url = `${config.geo.providerBUrl}/${ip}/json/`;
  const response = await fetch(url, { timeout: 5000 });
  
  if (!response.ok) {
    throw new Error(`Provider B HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Provider B error: ${data.reason || 'unknown'}`);
  }
  
  return {
    country: data.country_name,
    countryCode: data.country_code,
    region: data.region,
    city: data.city,
    lat: data.latitude,
    lon: data.longitude,
    isp: data.org,
    provider: 'ipapi.co',
  };
}

/**
 * Main geo enrichment function.
 * Tries Provider A, falls back to Provider B, falls back to null.
 * NEVER throws — submission must succeed regardless.
 */
async function enrichGeo(ip) {
  // Allow test injection of providers
  if (_providerOverride) {
    try {
      return await _providerOverride(ip);
    } catch (err) {
      console.warn('[geo] Provider override threw:', err.message);
      return null;
    }
  }
  
  // Skip geo for localhost/private IPs
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    console.log('[geo] Skipping geo for private/localhost IP:', ip);
    return null;
  }

  // Try Provider A
  try {
    const geo = await fetchFromProviderA(ip);
    console.log('[geo] Provider A success for IP:', ip);
    return geo;
  } catch (errA) {
    console.warn('[geo] Provider A failed:', errA.message);
  }

  // Try Provider B
  try {
    const geo = await fetchFromProviderB(ip);
    console.log('[geo] Provider B success for IP:', ip);
    return geo;
  } catch (errB) {
    console.warn('[geo] Provider B failed:', errB.message);
  }

  // Both failed — return null (submission still succeeds)
  console.warn('[geo] Both providers failed, storing submission without geo');
  return null;
}

module.exports = { enrichGeo, setProviderOverride, clearProviderOverride };
