/**
 * TEST WEBHOOK - REFERENCE IMPLEMENTATION
 *
 * ⚠️ THIS FILE IS NOT ACTIVE - IT'S A REFERENCE FOR WHEN YOU'RE READY
 *
 * To activate:
 * 1. Copy this file to: app/api/test-webhook/route.ts
 * 2. Configure test users in test-bot/config/test-config.json
 * 3. Set enabled: true in config
 * 4. Deploy or restart your Next.js server
 *
 * This webhook will:
 * - Only respond to configured test users
 * - Use test bot instructions from test-bot/data/content/
 * - Add [TEST] prefix to responses for visibility
 * - Skip sending real order emails
 * - Log everything for debugging
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Load test configuration
const testConfigPath = path.join(process.cwd(), 'test-bot/config/test-config.json');
let testConfig: any = {};

try {
  if (fs.existsSync(testConfigPath)) {
    const configContent = fs.readFileSync(testConfigPath, 'utf8');
    testConfig = JSON.parse(configContent);
  }
} catch (error) {
  console.error('[TEST WEBHOOK] Error loading config:', error);
  testConfig = { enabled: false };
}

/**
 * Check if user is a test user
 */
function isTestUser(userId: string): boolean {
  if (!testConfig.enabled) return false;

  const testUsers = testConfig.testUsers || [];
  return testUsers.some((user: any) => user.id === userId);
}

/**
 * Load instruction files from test-bot folder
 */
function loadTestInstructions(): string {
  const basePath = path.join(process.cwd(), 'test-bot/data/content');
  const mainFile = testConfig.instructions?.mainFile || 'bot-instructions-modular.md';

  try {
    const instructionsPath = path.join(basePath, mainFile);
    return fs.readFileSync(instructionsPath, 'utf8');
  } catch (error) {
    console.error('[TEST WEBHOOK] Error loading instructions:', error);
    throw new Error('Failed to load test instructions');
  }
}

/**
 * Load all modular instruction files
 */
function loadAllTestInstructions(): Record<string, string> {
  const basePath = path.join(process.cwd(), 'test-bot/data/content');

  const files = {
    main: 'bot-instructions-modular.md',
    contextRetention: 'context/context-retention-rules.md',
    contextAwareness: 'context/context-awareness-rules.md',
    criticalRules: 'core/critical-rules.md',
    orderFlow: 'core/order-flow-steps.md',
    orderLookup: 'core/order-lookup-system.md',
    // Add others as needed
    toneStyle: 'tone-style.md',
    imageHandling: 'image-handling.md',
    // ... etc
  };

  const instructions: Record<string, string> = {};

  for (const [key, file] of Object.entries(files)) {
    try {
      const filePath = path.join(basePath, file);
      if (fs.existsSync(filePath)) {
        instructions[key] = fs.readFileSync(filePath, 'utf8');
      }
    } catch (error) {
      console.warn(`[TEST WEBHOOK] Could not load ${file}:`, error);
    }
  }

  return instructions;
}

/**
 * POST - Handle incoming messages
 */
export async function POST(request: NextRequest) {
  try {
    // Check if test mode is enabled
    if (!testConfig.enabled) {
      return NextResponse.json({
        error: 'Test webhook is not enabled. Set enabled: true in test-bot/config/test-config.json'
      }, { status: 403 });
    }

    const body = await request.json();

    // Extract sender ID from Facebook webhook format
    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    const senderId = messaging?.sender?.id;

    if (!senderId) {
      return NextResponse.json({ error: 'No sender ID found' }, { status: 400 });
    }

    // Check if this user is a test user
    if (!isTestUser(senderId)) {
      return NextResponse.json({
        error: 'User not configured for testing',
        hint: 'Add this user ID to test-bot/config/test-config.json'
      }, { status: 403 });
    }

    console.log('[TEST WEBHOOK] Processing message for test user:', senderId);

    // Load test instructions
    const instructions = testConfig.instructions?.useModularSystem
      ? loadAllTestInstructions()
      : { main: loadTestInstructions() };

    if (testConfig.features?.verboseLogging) {
      console.log('[TEST WEBHOOK] Loaded instruction modules:', Object.keys(instructions));
    }

    // TODO: Process message using test instructions
    // This is where you'd integrate with your existing bot logic
    // but using the test instructions instead of production ones

    // Example response
    let responseText = 'Test response from test webhook';

    // Add test indicator if configured
    if (testConfig.features?.debugMode) {
      responseText = `[TEST] ${responseText}`;
    }

    // TODO: Send response back to user via Facebook API

    return NextResponse.json({
      success: true,
      testMode: true,
      userId: senderId,
      instructionsUsed: Object.keys(instructions)
    });

  } catch (error) {
    console.error('[TEST WEBHOOK] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET - Webhook verification (Facebook requires this)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Use same verify token as production or set a test-specific one
  const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'your_verify_token';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[TEST WEBHOOK] Webhook verified');
    return new NextResponse(challenge);
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}
