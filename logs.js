#!/usr/bin/env node

/**
 * Real-time log viewer for Vercel deployment
 * Usage: node logs.js [filter]
 * Examples:
 *   node logs.js           - Show all logs
 *   node logs.js chat      - Show only chat-related logs
 *   node logs.js error     - Show only errors
 *   node logs.js POST      - Show only POST requests
 */

const { spawn } = require('child_process');
const readline = require('readline');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

const filter = process.argv[2] || '';

console.log(`${colors.bright}${colors.cyan}🔍 Watching Vercel logs for: bebias-venera-chatbot${colors.reset}`);
console.log(`${colors.gray}Filter: ${filter || '(all)'}${colors.reset}`);
console.log(`${colors.gray}${'━'.repeat(80)}${colors.reset}\n`);

// Start vercel logs process
const vercel = spawn('vercel', ['logs', '--follow'], {
  stdio: ['inherit', 'pipe', 'pipe']
});

const rl = readline.createInterface({
  input: vercel.stdout,
  crlfDelay: Infinity
});

const rlErr = readline.createInterface({
  input: vercel.stderr,
  crlfDelay: Infinity
});

function colorizeLog(line) {
  // Skip filter if specified
  if (filter && !line.toLowerCase().includes(filter.toLowerCase())) {
    return null;
  }

  // Color code different log types
  if (line.includes('❌') || line.includes('ERROR') || line.includes('error')) {
    return `${colors.red}${line}${colors.reset}`;
  }

  if (line.includes('✅') || line.includes('SUCCESS')) {
    return `${colors.green}${line}${colors.reset}`;
  }

  if (line.includes('⚠️') || line.includes('WARN') || line.includes('warn')) {
    return `${colors.yellow}${line}${colors.reset}`;
  }

  if (line.includes('POST') || line.includes('GET') || line.includes('PUT') || line.includes('DELETE')) {
    const httpMethod = line.match(/(POST|GET|PUT|DELETE|PATCH)/)?.[0];
    if (httpMethod) {
      const methodColors = {
        'GET': colors.blue,
        'POST': colors.green,
        'PUT': colors.yellow,
        'DELETE': colors.red,
        'PATCH': colors.magenta
      };
      const methodColor = methodColors[httpMethod] || colors.white;
      return line.replace(httpMethod, `${colors.bright}${methodColor}${httpMethod}${colors.reset}`);
    }
  }

  if (line.includes('📨') || line.includes('📩') || line.includes('💬')) {
    return `${colors.cyan}${line}${colors.reset}`;
  }

  if (line.includes('🏦') || line.includes('💳')) {
    return `${colors.magenta}${line}${colors.reset}`;
  }

  if (line.includes('🤖') || line.includes('AI') || line.includes('OpenAI')) {
    return `${colors.blue}${line}${colors.reset}`;
  }

  // Timestamps in gray
  if (line.match(/^\d{2}:\d{2}:\d{2}/)) {
    return line.replace(/^(\d{2}:\d{2}:\d{2}\.\d{2})/, `${colors.gray}$1${colors.reset}`);
  }

  // Default
  return line;
}

rl.on('line', (line) => {
  const colored = colorizeLog(line);
  if (colored !== null) {
    console.log(colored);
  }
});

rlErr.on('line', (line) => {
  const colored = colorizeLog(line);
  if (colored !== null) {
    console.log(colored);
  }
});

vercel.on('close', (code) => {
  console.log(`\n${colors.yellow}Log stream ended with code ${code}${colors.reset}`);
  process.exit(code);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Stopping log stream...${colors.reset}`);
  vercel.kill();
  process.exit(0);
});
