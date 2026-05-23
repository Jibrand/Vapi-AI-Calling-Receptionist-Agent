import rateLimit from 'express-rate-limit';
import { formatResponse } from '../utils/responseHelper.js';

/**
 * Rate limiter middleware.
 * Limits to 60 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(
      formatResponse(
        false,
        "I'm sorry, we are receiving too many requests right now. Please try again later.",
        null,
        "TOO_MANY_REQUESTS"
      )
    );
  }
});
