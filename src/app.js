import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import appointmentRoutes from './routes/appointmentRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

const app = express();

// Security Middleware
app.use(helmet());

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Body Parsing Middleware
app.use(express.json());

// app.use('/', (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: "API is healthy",
//     data: null,
//     errorCode: null
//   });
// });

// Apply rate limiter to all API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/appointments', appointmentRoutes);

// 404 handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    data: null,
    errorCode: "NOT_FOUND"
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
