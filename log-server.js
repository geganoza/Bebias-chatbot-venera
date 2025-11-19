// Local log server - receives logs from production via webhook
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const LOG_FILE = path.join(__dirname, 'live-logs.txt');

// Clear log file on start
fs.writeFileSync(LOG_FILE, `=== Log Server Started at ${new Date().toISOString()} ===\n\n`);

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/log') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const logData = JSON.parse(body);
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${logData.level?.toUpperCase() || 'INFO'}: ${logData.message}\n`;

        // Write to file
        fs.appendFileSync(LOG_FILE, logLine);

        // Also print to console with colors
        const colors = {
          error: '\x1b[31m',
          warn: '\x1b[33m',
          info: '\x1b[36m',
          success: '\x1b[32m',
          reset: '\x1b[0m'
        };
        const color = colors[logData.level] || colors.info;
        console.log(`${color}${logLine.trim()}${colors.reset}`);

        res.writeHead(200);
        res.end('OK');
      } catch (error) {
        console.error('Error processing log:', error);
        res.writeHead(500);
        res.end('Error');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\x1b[32m✅ Log server running on http://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[36mℹ️  Logs being written to: ${LOG_FILE}\x1b[0m`);
  console.log(`\x1b[36mℹ️  Watch logs: tail -f ${LOG_FILE}\x1b[0m`);
  console.log(`\x1b[33m⚠️  Make sure to expose this server with ngrok or similar\x1b[0m\n`);
});
