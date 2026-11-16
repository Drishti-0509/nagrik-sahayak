const express = require('express');
const router = express.Router();
const {
  createComplaint,
  getMyComplaints,
  getAssignedComplaints,
  getAllComplaints,
  getComplaintById,
  getComplaintEvidence,
  updateComplaintStatus,
  assignComplaint,
  addComment,
  escalateComplaint,
  checkDuplicates,
  predictSla,
  getSlaModelMetrics,
} = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(apiLimiter);
router.use(protect); // All complaint routes require authenticated user

// Specific routes before generic :id parameter
router.get('/my', authorize('citizen'), getMyComplaints);
router.get('/assigned', authorize('officer', 'admin'), getAssignedComplaints);
router.get('/sla-metrics', getSlaModelMetrics);
router.get('/', authorize('admin'), getAllComplaints);
router.post('/check-duplicates', checkDuplicates);
router.post('/predict-sla', predictSla);
router.post('/', authorize('citizen'), createComplaint);

// Dynamic routes
router.get('/:id/evidence', getComplaintEvidence);
router.get('/:id', getComplaintById);
router.put('/:id/status', updateComplaintStatus);
router.put('/:id/assign', authorize('admin', 'officer'), assignComplaint);
router.post('/:id/comments', addComment);
router.put('/:id/escalate', escalateComplaint);

module.exports = router;
