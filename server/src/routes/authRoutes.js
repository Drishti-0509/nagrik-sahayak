const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public auth endpoints with rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/login/citizen', authLimiter, (req, res, next) => {
  req.body.requiredRole = 'citizen';
  login(req, res, next);
});
router.post('/login/officer', authLimiter, (req, res, next) => {
  req.body.requiredRole = 'officer';
  login(req, res, next);
});
router.post('/login/admin', authLimiter, (req, res, next) => {
  req.body.requiredRole = 'admin';
  login(req, res, next);
});
router.post('/logout', logout);

// Protected profile endpoints
router.get('/me', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

module.exports = router;
