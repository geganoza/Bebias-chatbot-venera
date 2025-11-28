/**
 * TEST SIMULATOR API ENDPOINT
 *
 * ✅ COMPLETELY ISOLATED FROM PRODUCTION
 *
 * What this endpoint does:
 * - Receives messages from test-bot/simulator/index.html
 * - Uses ONLY test-bot/data/content/ instructions (never touches production)
 * - Returns bot responses for testing
 * - NO impact on production bot, users, or data
 *
 * Isolation guarantees:
 * - Different instruction path: test-bot/data/content/ (NOT data/content/)
 * - Different route: /api/test-simulator (NOT /api/messenger)
 * - No database writes
 * - No order emails
 * - No production Redis keys
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

/**
 * Load test instructions from test-bot folder
 * ✅ NEVER touches data/content/ (production)
 * ✅ ONLY reads from test-bot/data/content/
 */
async function loadTestInstructions() {
  const basePath = path.join(process.cwd(), 'test-bot/data/content');
  const mainFile = 'bot-instructions-modular.md';

  try {
    console.log('[TEST SIMULATOR] Loading instructions from:', basePath);

    // Load main instructions
    const mainInstructions = await fs.readFile(
      path.join(basePath, mainFile),
      'utf8'
    );

    // Load modular files
    const modules: Record<string, string> = {};

    const moduleFiles = [
      'context/context-retention-rules.md',
      'context/context-awareness-rules.md',
      'core/critical-rules.md',
      'core/order-flow-steps.md',
      'core/order-lookup-system.md',
      'tone-style.md',
      'image-handling.md',
      'product-recognition.md',
      'purchase-flow.md',
      'delivery-info.md',
      'contact-policies.md',
      'payment-info.md',
      'services.md',
      'faqs.md'
    ];

    for (const file of moduleFiles) {
      try {
        const filePath = path.join(basePath, file);
        const content = await fs.readFile(filePath, 'utf8');
        modules[file] = content;
      } catch (error) {
        console.warn(`[TEST SIMULATOR] Could not load ${file}:`, error);
      }
    }

    console.log('[TEST SIMULATOR] Loaded modules:', Object.keys(modules).length);

    return {
      main: mainInstructions,
      modules
    };
  } catch (error) {
    console.error('[TEST SIMULATOR] Error loading instructions:', error);
    throw new Error('Failed to load test instructions');
  }
}

/**
 * Load product catalog
 * ✅ Uses test-bot's own catalog (completely isolated)
 */
async function loadProductCatalog() {
  try {
    const catalogPath = path.join(process.cwd(), 'test-bot/data/products.json');
    const catalogContent = await fs.readFile(catalogPath, 'utf8');
    console.log('[TEST SIMULATOR] Loaded product catalog from test-bot/data/');
    return JSON.parse(catalogContent);
  } catch (error) {
    console.warn('[TEST SIMULATOR] Could not load product catalog:', error);
    return null;
  }
}

/**
 * Build system prompt for AI
 */
function buildSystemPrompt(instructions: any, productCatalog: any): string {
  let prompt = instructions.main;

  // Append relevant modules
  if (instructions.modules) {
    Object.entries(instructions.modules).forEach(([key, content]) => {
      if (content) {
        prompt += `\n\n---\n## ${key}\n${content}`;
      }
    });
  }

  // Append product catalog
  if (productCatalog) {
    prompt += '\n\n---\n## Product Catalog\n' + JSON.stringify(productCatalog, null, 2);
  }

  return prompt;
}

/**
 * Generate bot response using OpenAI
 * ✅ Uses GPT-4o model for real responses
 */
async function generateBotResponse(
  userMessage: string,
  systemPrompt: string,
  userId: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
  try {
    console.log(`[TEST SIMULATOR] 🤖 Calling OpenAI for user ${userId}`);
    console.log(`[TEST SIMULATOR] 📝 Message: "${userMessage}"`);
    console.log(`[TEST SIMULATOR] 📚 System prompt length: ${systemPrompt.length} chars`);
    console.log(`[TEST SIMULATOR] 💬 History length: ${conversationHistory.length} messages`);

    // Build messages array
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || 'ბოდიში, ვერ გავიგე.';
    console.log(`[TEST SIMULATOR] ✅ OpenAI response received (${response.length} chars)`);

    return response;

  } catch (err: any) {
    console.error('[TEST SIMULATOR] ❌ OpenAI API error:', err);
    console.error('[TEST SIMULATOR] ❌ Error details:', JSON.stringify(err, null, 2));
    console.error('[TEST SIMULATOR] ❌ Error message:', err?.message);

    // Return error message in Georgian
    return 'ბოდიში, შეცდომა მოხდა თქვენი მოთხოვნის დამუშავებისას. გთხოვთ, სცადოთ ხელახლა.';
  }
}

/**
 * Parse response for SEND_IMAGE commands
 */
function parseResponse(response: string): { text: string; imageId: string | null } {
  const imageMatch = response.match(/SEND_IMAGE:\s*(\d+)/);
  const imageId = imageMatch ? imageMatch[1] : null;
  const text = response.replace(/SEND_IMAGE:\s*\d+/g, '').trim();

  return { text, imageId };
}

/**
 * POST - Handle test simulator messages
 * ✅ COMPLETELY ISOLATED - No production impact
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, userName, message, useTestInstructions, debugMode, conversationHistory } = await request.json();

    if (!userId || !message) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId or message'
      }, { status: 400 });
    }

    console.log(`[TEST SIMULATOR] 📨 Message from ${userName} (${userId}): ${message}`);

    // Load test instructions
    const instructions = await loadTestInstructions();
    const productCatalog = await loadProductCatalog();

    // Build system prompt
    const systemPrompt = buildSystemPrompt(instructions, productCatalog);

    // Generate response with conversation history
    const botResponse = await generateBotResponse(
      message,
      systemPrompt,
      userId,
      conversationHistory || []
    );

    // Parse for images
    const { text, imageId } = parseResponse(botResponse);

    console.log(`[TEST SIMULATOR] ✅ Response generated (${text.length} chars)`);
    if (imageId) {
      console.log(`[TEST SIMULATOR] 🖼️ Image ID: ${imageId}`);
    }

    const response = {
      success: true,
      response: text,
      imageUrl: imageId ? `/api/products/${imageId}/image` : null,
      testMode: true,
      debug: debugMode ? {
        userId,
        instructionsPath: 'test-bot/data/content/',
        systemPromptLength: systemPrompt.length,
        modulesLoaded: Object.keys(instructions.modules || {}).length,
        historyLength: conversationHistory?.length || 0,
        timestamp: new Date().toISOString()
      } : undefined
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[TEST SIMULATOR] ❌ Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      testMode: true
    }, { status: 500 });
  }
}

/**
 * GET - Health check
 * Returns status to verify endpoint is working
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'Test Simulator API Active',
    mode: 'test',
    instructionsPath: 'test-bot/data/content/',
    productionPath: 'data/content/ (NOT USED)',
    isolation: 'Complete - No production impact',
    timestamp: new Date().toISOString()
  });
}