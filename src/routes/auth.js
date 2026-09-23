'use strict';

const express = require('express');
const authService = require('../services/authService');
const { validate, registerSchema, loginSchema } = require('../validators');

const router = express.Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, tenantName } = req.body;
    const result = await authService.register({ email, password, tenantName });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
