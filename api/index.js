import 'dotenv/config';
import app from '../src/app.js';

const PORT = process.env.PORT || 3000;

// Vercel sets the VERCEL environment variable to "1"
// We only start the listener if we are NOT on Vercel (e.g. running locally)
if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });

  // Graceful shutdown handling
  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

// Export the app for Vercel's serverless function handler
export default app;
