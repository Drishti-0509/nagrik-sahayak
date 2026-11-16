const express = require('express');
const router = express.Router();
const {
  getUsers,
  createOfficer,
  toggleUserStatus,
  getActiveOfficers,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(apiLimiter);
router.use(protect);

// Officers list for assignment (Admin & Officer)
router.get('/officers/active', authorize('admin', 'officer'), getActiveOfficers);

// Admin-only user management
router.get('/', authorize('admin'), getUsers);
router.post('/officers', authorize('admin'), createOfficer);
router.patch('/:id/status', authorize('admin'), toggleUserStatus);

module.exports = router;
