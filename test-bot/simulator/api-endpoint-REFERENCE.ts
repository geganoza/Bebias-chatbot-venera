/**
 * Test Simulator API Endpoint
 *
 * ⚠️ THIS FILE IS A REFERENCE - NOT ACTIVE YET
 *
 * To activate:
 * 1. Copy this file to: app/api/test-simulator/route.ts
 * 2. Restart your Next.js server
 * 3. Open test-bot/simulator/index.html in your browser
 * 4. Start chatting!
 *
 * This endpoint:
 * - Receives messages from the simulator UI
 * - Processes them using test bot instructions
 * - Returns bot responses
 * - Works completely offline (no Facebook needed)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Load test instructions
function loadTestInstructions() {
  const basePath = path.join(process.cwd(), 'test-bot/data/content');
  const mainFile = 'bot-instructions-modular.md';

  try {
    // Load main instructions
    const mainInstructions = fs.readFileSync(
      path.join(basePath, mainFile),
      'utf8'
    );

    // Load modular files
    const modules = {
      contextRetention: readIfExists(path.join(basePath, 'context/context-retention-rules.md')),
      contextAwareness: readIfExists(path.join(basePath, 'context/context-awareness-rules.md')),
      criticalRules: readIfExists(path.join(basePath, 'core/critical-rules.md')),
      orderFlow: readIfExists(path.join(basePath, 'core/order-flow-steps.md')),
      orderLookup: readIfExists(path.join(basePath, 'core/order-lookup-system.md')),
      toneStyle: readIfExists(path.join(basePath, 'tone-style.md')),
      imageHandling: readIfExists(path.join(basePath, 'image-handling.md')),
      productRecognition: readIfExists(path.join(basePath, 'product-recognition.md')),
      purchaseFlow: readIfExists(path.join(basePath, 'purchase-flow.md')),
      deliveryInfo: readIfExists(path.join(basePath, 'delivery-info.md')),
      contactPolicies: readIfExists(path.join(basePath, 'contact-policies.md')),
      paymentInfo: readIfExists(path.join(basePath, 'payment-info.md')),
      services: readIfExists(path.join(basePath, 'services.md')),
      faqs: readIfExists(path.join(basePath, 'faqs.md'))
    };

    return {
      main: mainInstructions,
      modules
    };
  } catch (error) {
    console.error('[TEST SIMULATOR] Error loading instructions:', error);
    throw error;
  }
}

function readIfExists(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    console.warn(`Could not read ${filePath}:`, error);
  }
  return null;
}

// Load product catalog (you may need to adjust this path)
function loadProductCatalog() {
  try {
    const catalogPath = path.join(process.cwd(), 'data/products.json');
    if (fs.existsSync(catalogPath)) {
      return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    }
  } catch (error) {
    console.warn('[TEST SIMULATOR] Could not load product catalog:', error);
  }
  return null;
}

/**
 * POST - Handle test simulator messages
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, userName, message, useTestInstructions, debugMode } = await request.json();

    if (!userId || !message) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId or message'
      }, { status: 400 });
    }

    console.log(`[TEST SIMULATOR] Message from ${userName} (${userId}): ${message}`);

    // Load instructions
    const instructions = useTestInstructions
      ? loadTestInstructions()
      : { main: 'Use production instructions here', modules: {} };

    // Load product catalog
    const productCatalog = loadProductCatalog();

    // Build system prompt for AI
    const systemPrompt = buildSystemPrompt(instructions, productCatalog);

    // TODO: Call your AI service (OpenAI, Anthropic, etc.)
    // For now, this is a placeholder
    const botResponse = await generateBotResponse(message, systemPrompt, userId);

    // Parse for SEND_IMAGE commands
    const { text, imageId } = parseResponse(botResponse);

    const response = {
      success: true,
      response: text,
      imageUrl: imageId ? `/api/products/${imageId}/image` : null,
      debug: debugMode ? {
        userId,
        instructionsUsed: useTestInstructions ? 'test' : 'production',
        systemPromptLength: systemPrompt.length,
        modulesLoaded: Object.keys(instructions.modules || {}).length
      } : undefined
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[TEST SIMULATOR] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

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

async function generateBotResponse(
  userMessage: string,
  systemPrompt: string,
  userId: string
): Promise<string> {
  // TODO: Replace this with your actual AI service call
  // Example for OpenAI:
  /*
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]
  });
  return response.choices[0].message.content;
  */

  // Mock response for now
  const msg = userMessage.toLowerCase();

  if (msg.includes('გამარჯობა') || msg.includes('hello')) {
    return 'გამარჯობა ბებია! 💛 რით დაგეხმარო?';
  }

  if (msg.includes('ქუდი')) {
    return `შავი ბამბის მოკლე ქუდი - სტანდარტი (M) - 49 ლარი 💛

აირჩიე მიტანის მეთოდი:
1 - თბილისი სტანდარტი (1-3 დღე) 6₾
2 - თბილისი Wolt იმავე დღეს
3 - რეგიონი (3-5 დღე) 10₾

SEND_IMAGE: 9016`;
  }

  if (msg.includes('შეკვეთა') || msg.includes('სად არის')) {
    return 'მომეცი შეკვეთის ნომერი ან ტელეფონი რომ შევამოწმო 📞';
  }

  return `მოიცა ბებია, სათვალე გავიკეთო... 👓

[TEST SIMULATOR] Received: "${userMessage}"
[TEST SIMULATOR] System prompt: ${systemPrompt.length} characters
[TEST SIMULATOR] Replace this mock with real AI call`;
}

function parseResponse(response: string): { text: string; imageId: string | null } {
  // Check for SEND_IMAGE command
  const imageMatch = response.match(/SEND_IMAGE:\s*(\d+)/);
  const imageId = imageMatch ? imageMatch[1] : null;

  // Remove SEND_IMAGE command from text
  const text = response.replace(/SEND_IMAGE:\s*\d+/g, '').trim();

  return { text, imageId };
}

/**
 * GET - Health check
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'Test Simulator API Active',
    mode: 'local',
    instructionsPath: 'test-bot/data/content/',
    timestamp: new Date().toISOString()
  });
}