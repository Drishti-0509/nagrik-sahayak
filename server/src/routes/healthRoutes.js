const express = require('express');
const router = express.Router();
const { getDBStatus } = require('../config/db');
const config = require('../config/env');

/**
 * @desc    Health check endpoint reporting API and database status
 * @route   GET /api/health
 * @access  Public
 */
router.get('/', (req, res) => {
  const dbStatus = getDBStatus();
  const uptimeSeconds = Math.floor(process.uptime());

  const isHealthy = dbStatus.isConnected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'Nagrik Sahayak API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    database: {
      connected: dbStatus.isConnected,
      state: dbStatus.status,
      host: dbStatus.host,
      database: dbStatus.name,
    },
    aiIntegration: {
      geminiConfigured: Boolean(config.geminiApiKey && config.geminiApiKey !== 'your_gemini_api_key_here'),
      model: config.geminiModel,
      fallbackAvailable: true,
    },
    mlSubsystem: {
      duplicateDetection: 'SentenceTransformers (all-MiniLM-L6-v2) + FAISS',
      slaPrediction: 'GradientBoostingRegressor Pipeline',
      status: 'operational',
    },
  });
});

module.exports = router;
