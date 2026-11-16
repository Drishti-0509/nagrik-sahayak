const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration supporting explicit environment allowlist and dev localhost origins
const DEV_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const LOCALHOST_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const allowedOrigins = new Set(
  config.nodeEnv === 'production'
    ? config.corsOrigins
    : [...config.corsOrigins, ...DEV_ALLOWED_ORIGINS]
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser / same-origin requests without an Origin header (curl, server-to-server, mobile)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().replace(/\/+$/, '');
      if (
        allowedOrigins.has(normalizedOrigin) ||
        (config.nodeEnv !== 'production' && LOCALHOST_ORIGIN_REGEX.test(normalizedOrigin))
      ) {
        return callback(null, true);
      }

      const corsError = new Error('Origin not allowed by CORS policy');
      corsError.statusCode = 403;
      return callback(corsError);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body and Cookie parsers (8MB JSON cap accommodates base64 overhead of validated 5MB max image uploads)
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use(cookieParser());

// Health Check
app.use('/api/health', healthRoutes);

// Versioned API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/ai', aiRoutes);

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handling middleware
app.use(errorHandler);

// Start server function
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(config.port, () => {
      console.log(`
================================================================================
  NAGRIK SAHAYAK (नागरिक सहायक) — Civic Redressal API Server
  Environment: ${config.nodeEnv}
  Server Port: ${config.port}
  API Base URL: http://localhost:${config.port}/api/v1
  Health Check: http://localhost:${config.port}/api/health
  Gemini AI:   ${config.geminiApiKey ? 'Configured (' + config.geminiModel + ')' : 'Deterministic Fallback Active'}
================================================================================`);
    });
    return server;
  } catch (err) {
    console.error('[Server] Failed to initialize server:', err.message);
    // Don't process.exit in tests so Jest handles lifecycle
    if (config.nodeEnv !== 'test') {
      process.exit(1);
    }
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
