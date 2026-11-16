const express = require('express');
const router = express.Router();
const {
  getDepartments,
  createDepartment,
  updateDepartment,
} = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(apiLimiter);

// Public / Citizen / Officer can view departments
router.get('/', getDepartments);

// Admin-only management endpoints
router.post('/', protect, authorize('admin'), createDepartment);
router.put('/:id', protect, authorize('admin'), updateDepartment);

module.exports = router;
