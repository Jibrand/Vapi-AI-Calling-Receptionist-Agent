import { formatResponse } from '../utils/responseHelper.js';

/**
 * Global error handler middleware.
 * Catches all unhandled errors and returns a generic, friendly speakable message.
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Unhandled Error:', err);

  const response = formatResponse(
    false,
    "Something went wrong on our end. Please try again in a moment.",
    null,
    "INTERNAL_SERVER_ERROR"
  );

  res.status(500).json(response);
};
