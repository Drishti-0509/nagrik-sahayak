const rateLimit = require('express-rate-limit');

// Strict limiter for authentication endpoints (login, register)
const authLimiter =
  process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20, // limit each IP to 20 attempts per window
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          message: 'Too many authentication attempts. Please try again after 15 minutes.',
        },
      });

// General API limiter
const apiLimiter =
  process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 180, // limit each IP to 180 requests per minute
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          message: 'Too many requests. Please slow down.',
        },
      });

// AI analysis endpoint limiter
const aiLimiter =
  process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 30, // limit each IP to 30 AI triage requests per minute
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          message: 'AI request rate limit reached. Please wait a moment before trying again.',
        },
      });

module.exports = { authLimiter, apiLimiter, aiLimiter };
