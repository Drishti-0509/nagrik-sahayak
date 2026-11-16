const express = require('express');
const router = express.Router();
const {
  getPublicStats,
  getCitizenStats,
  getOfficerStats,
  getAdminStats,
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(apiLimiter);

// Public portal metrics derived strictly from database records
router.get('/public', getPublicStats);

router.use(protect);

router.get('/citizen', authorize('citizen'), getCitizenStats);
router.get('/officer', authorize('officer', 'admin'), getOfficerStats);
router.get('/admin', authorize('admin'), getAdminStats);

module.exports = router;
