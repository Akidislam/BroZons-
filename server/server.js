import dotenv from 'dotenv';

// Load environment variables before any other module imports that rely on process.env
dotenv.config();

import app from './app.js';
import connectDB from './config/db.js';
import './models/index.js'; // Ensure all Mongoose schemas and models are registered

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Start HTTP Server
const server = app.listen(PORT, () => {
  console.log(`[Server] BroZons backend running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`[Server] Health check available at: http://localhost:${PORT}/api/health`);
});

// Handle unhandled Promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[Unhandled Rejection] Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`[Uncaught Exception] Error: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown on termination signals
const handleGracefulShutdown = (signal) => {
  process.on(signal, () => {
    console.log(`\n[Server] ${signal} received. Closing HTTP server gracefully...`);
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  });
};

handleGracefulShutdown('SIGINT');
handleGracefulShutdown('SIGTERM');
