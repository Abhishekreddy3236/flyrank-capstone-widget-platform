'use strict';

const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  tenantName: z.string().min(1, 'Tenant name required').max(255).trim(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(1, 'Password required').max(100),
});

const createWidgetSchema = z.object({
  name: z.string().min(1, 'Widget name required').max(255).trim(),
  type: z.enum(['signup', 'contact', 'cta', 'popover'], {
    errorMap: () => ({ message: 'type must be one of: signup, contact, cta, popover' }),
  }),
  config: z.object({
    title: z.string().max(500).optional(),
    description: z.string().max(2000).optional(),
    fields: z.array(z.object({
      name: z.string().max(100),
      label: z.string().max(255),
      type: z.enum(['text', 'email', 'tel', 'textarea', 'checkbox']),
      required: z.boolean().optional().default(false),
    })).max(20).optional(),
    buttonText: z.string().max(100).optional(),
    successMessage: z.string().max(500).optional(),
  }).optional().default({}),
  active: z.boolean().optional().default(true),
});

const updateWidgetSchema = createWidgetSchema.partial();

const submissionSchema = z.object({
  name: z.string().max(255).optional(),
  email: z.string().email('Invalid email format').max(255).optional(),
  data: z.record(z.string(), z.any()).optional().default({}),
  // Honeypot fields — accepted by schema but checked in service layer
  // Real humans leave these empty; bots fill them
  website: z.string().max(500).optional(),
  company_url: z.string().max(500).optional(),
  homepage: z.string().max(500).optional(),
}).refine(
  (data) => data.name || data.email,
  { message: 'At least one of name or email is required' }
);

function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err); // Passes ZodError to errorHandler
    }
  };
}

module.exports = {
  registerSchema,
  loginSchema,
  createWidgetSchema,
  updateWidgetSchema,
  submissionSchema,
  validate,
};
