import express from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * Public Authentication Routes
 */
router.post('/register', register);
router.post('/login', login);

/**
 * Protected User Routes
 */
router.get('/me', authenticate, getMe);

/**
 * Protected Admin Route (for role-based authorization testing and verification)
 */
router.get('/admin-test', authenticate, authorize('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: `Admin access granted. Welcome, ${req.user.name}!`,
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
    },
  });
});

export default router;
