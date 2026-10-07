import express from 'express';
import healthRoutes from './health.route.js';
import authRoutes from './auth.routes.js';

const router = express.Router();

// Mount individual feature routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

export default router;
