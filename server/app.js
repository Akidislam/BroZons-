import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// ==========================================
// Global Middlewares
// ==========================================

// Configure CORS
const allowedOrigin = process.env.CLIENT_URL || '*';
app.use(
  cors({
    origin: allowedOrigin === '*' ? '*' : [allowedOrigin],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// Base & API Routes
// ==========================================

// Root Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to BroZons API Server',
    docs: '/api/health',
  });
});

// Mount Centralized API Routes
app.use('/api', apiRoutes);

// ==========================================
// Error Handling Middlewares
// ==========================================

// 404 Not Found Middleware (catches unmatched routes)
app.use(notFound);

// Centralized Error Handler Middleware
app.use(errorHandler);

export default app;
