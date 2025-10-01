/**
 * Test Server Entry Point
 *
 * Simple HTTP server for E2E testing that serves the test fixtures
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Create server
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  let filePath = url.pathname;

  // Default to index.html
  if (filePath === '/') {
    filePath = '/index.html';
  }

  // Remove leading slash
  filePath = filePath.substring(1);

  // Security check - prevent directory traversal
  if (filePath.includes('..') || filePath.includes('~')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Try to serve from fixtures directory
  const fixturesPath = path.join(__dirname, '..', 'fixtures');
  const fullPath = path.join(fixturesPath, filePath);

  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    // Try to serve from root directory
    const rootPath = path.join(__dirname, '..', '..');
    const fullRootPath = path.join(rootPath, filePath);

    if (fs.existsSync(fullRootPath)) {
      serveFile(fullRootPath, res);
    } else {
      // Return 404
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>404 - Not Found</title>
        </head>
        <body>
          <h1>404 - Not Found</h1>
          <p>The requested file was not found.</p>
          <p>Available files:</p>
          <ul>
            <li><a href="/test-app.html">Test App</a></li>
            <li><a href="/test-react-app.tsx">React Test App</a></li>
          </ul>
        </body>
        </html>
      `);
    }
  } else {
    serveFile(fullPath, res);
  }
});

// Serve file function
function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// Start server
server.listen(PORT, HOST, () => {
  console.log(`Test server running on http://${HOST}:${PORT}`);
  console.log('Available endpoints:');
  console.log(`  - http://${HOST}:${PORT}/test-app.html`);
  console.log(`  - http://${HOST}:${PORT}/test-react-app.tsx`);
  console.log(`  - http://${HOST}:${PORT}/ (index.html)`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Test server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Test server stopped');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
