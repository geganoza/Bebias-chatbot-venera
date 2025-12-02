#!/usr/bin/env node

/**
 * Terminal MCP Server for BEBIAS VENERA Chatbot
 * Run this in terminal to provide MCP tools
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const fs = require('fs').promises;
const path = require('path');
const admin = require('firebase-admin');

// Initialize Firebase if not already done
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (err) {
    console.error('Firebase initialization error:', err.message);
  }
}

const db = admin.firestore();

// Create MCP server
const server = new Server({
  name: 'bebias-chatbot-terminal',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {}
  }
});

// Define available tools
const TOOLS = [
  {
    name: 'sync_conversations',
    description: 'Sync all conversations to metaMessages for control panel',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'check_bot_status',
    description: 'Check if the bot is active or paused',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_recent_conversations',
    description: 'List recent conversations with users',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of conversations to return',
          default: 10
        }
      }
    }
  },
  {
    name: 'activate_bot',
    description: 'Activate the bot if it is paused',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'pause_bot',
    description: 'Pause the bot',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'sync_conversations':
      return await syncConversations();

    case 'check_bot_status':
      return await checkBotStatus();

    case 'list_recent_conversations':
      return await listRecentConversations(args.limit || 10);

    case 'activate_bot':
      return await activateBot();

    case 'pause_bot':
      return await pauseBot();

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Tool implementations
async function syncConversations() {
  try {
    const convSnapshot = await db.collection('conversations')
      .orderBy('lastActive', 'desc')
      .limit(50)
      .get();

    let synced = 0;
    for (const doc of convSnapshot.docs) {
      const data = doc.data();
      if (data.history && data.history.length > 0) {
        const messages = data.history
          .filter(msg => msg.content)
          .map((msg, index) => ({
            id: `msg_${index}_${Date.now()}`,
            senderId: msg.role === 'user' ? doc.id : 'bot',
            senderType: msg.role === 'assistant' ? 'bot' : msg.role,
            text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            timestamp: data.lastActive || new Date().toISOString()
          }));

        await db.collection('metaMessages').doc(doc.id).set({
          userId: doc.id,
          messages: messages,
          lastUpdated: new Date().toISOString()
        });
        synced++;
      }
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Synced ${synced} conversations to control panel`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error syncing: ${error.message}`
      }]
    };
  }
}

async function checkBotStatus() {
  try {
    const response = await fetch('https://bebias-venera-chatbot.vercel.app/api/bot-status');
    const status = await response.json();

    let statusText = status.killSwitch ? '❌ STOPPED (Kill switch ON)' :
                     status.paused ? '⏸️ PAUSED' : '✅ ACTIVE';

    return {
      content: [{
        type: 'text',
        text: `Bot Status: ${statusText}\n${status.pausedAt ? `Paused since: ${new Date(status.pausedAt).toLocaleString()}` : ''}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error checking status: ${error.message}`
      }]
    };
  }
}

async function listRecentConversations(limit) {
  try {
    const convSnapshot = await db.collection('conversations')
      .orderBy('lastActive', 'desc')
      .limit(limit)
      .get();

    let result = '📱 Recent Conversations:\n';
    convSnapshot.forEach(doc => {
      const data = doc.data();
      const lastActive = new Date(data.lastActive || data.timestamp);
      const hoursAgo = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60));

      result += `\n👤 ${data.userName || doc.id}`;
      result += `\n   Last active: ${hoursAgo}h ago`;
      result += `\n   Messages: ${data.history ? data.history.length : 0}`;
    });

    return {
      content: [{
        type: 'text',
        text: result
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error listing conversations: ${error.message}`
      }]
    };
  }
}

async function activateBot() {
  try {
    const statusRef = db.collection('settings').doc('botStatus');
    await statusRef.set({
      killSwitch: false,
      paused: false,
      pausedAt: null
    }, { merge: true });

    return {
      content: [{
        type: 'text',
        text: '✅ Bot activated successfully!'
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error activating bot: ${error.message}`
      }]
    };
  }
}

async function pauseBot() {
  try {
    const statusRef = db.collection('settings').doc('botStatus');
    await statusRef.set({
      paused: true,
      pausedAt: new Date().toISOString()
    }, { merge: true });

    return {
      content: [{
        type: 'text',
        text: '⏸️ Bot paused successfully'
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error pausing bot: ${error.message}`
      }]
    };
  }
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('🚀 MCP Server running in terminal');
  console.error('📋 Available tools:', TOOLS.map(t => t.name).join(', '));
  console.error('Ready for connections via stdio');
}

main().catch(error => {
  console.error('Server error:', error);
  process.exit(1);
});