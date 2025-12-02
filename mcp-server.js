#!/usr/bin/env node

/**
 * MCP Server for BEBIAS VENERA Chatbot
 * Provides tools for managing the chatbot via Model Context Protocol
 */

const { Server } = require('@modelcontextprotocol/server-filesystem');
const path = require('path');

// Create server instance with project root access
const server = new Server({
  name: 'bebias-chatbot-mcp',
  version: '1.0.0',
  rootPath: __dirname,
  allowedPaths: [
    __dirname,  // Project root
    path.join(__dirname, 'app'),
    path.join(__dirname, 'lib'),
    path.join(__dirname, 'scripts'),
    path.join(__dirname, 'data'),
    path.join(__dirname, 'components'),
  ],
  capabilities: {
    read: true,
    write: true,
    list: true,
    search: true,
  }
});

// Start the server
server.start().then(() => {
  console.log('🚀 MCP Server started for BEBIAS VENERA Chatbot');
  console.log('📁 Project root:', __dirname);
  console.log('✅ Server is ready to accept connections');
}).catch(err => {
  console.error('❌ Failed to start MCP server:', err);
  process.exit(1);
});