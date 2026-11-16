const express = require('express');
const router = express.Router();
const { analyzeGrievance } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

// AI Triage Assistant route
router.post('/analyze', protect, aiLimiter, analyzeGrievance);

module.exports = router;
