import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

const getDatabaseStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

/**
 * @route   GET /api/health
 * @desc    Check API and server operational health
 * @access  Public
 */
router.get('/', (req, res) => {
  const dbStatus = getDatabaseStatus();

  res.status(200).json({
    success: true,
    message: 'BroZons API is operational',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
    },
  });
});

export default router;
