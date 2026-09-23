'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const tenantRepository = require('../repositories/tenantRepository');
const config = require('../config');
const { createError } = require('../middleware/errorHandler');

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100) + '-' + Date.now();
}

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

async function register({ email, password, tenantName }) {
  // Check existing user
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw createError(409, 'Conflict', 'Email already registered');
  }

  const slug = slugify(tenantName);
  const tenant = await tenantRepository.create({ name: tenantName, slug });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepository.create({
    tenantId: tenant.id,
    email,
    passwordHash,
    role: 'owner',
  });

  const token = generateToken(user);
  return { token, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id } };
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw createError(401, 'Unauthorized', 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw createError(401, 'Unauthorized', 'Invalid email or password');
  }

  const token = generateToken(user);
  return { token, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id } };
}

module.exports = { register, login };
