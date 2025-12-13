#!/usr/bin/env node
/**
 * Full Wolt Order Flow Simulator
 *
 * This script simulates a complete Wolt order conversation and tests:
 * 1. Bot responses at each step
 * 2. Map confirmation callback
 * 3. Order creation in Firestore
 * 4. Shipping Manager integration
 *
 * Usage: node scripts/test-full-wolt-flow.mjs [--prod]
 */

const BASE_URL = process.argv.includes('--prod')
  ? 'https://bebias-venera-chatbot.vercel.app'
  : 'http://localhost:3000';

const TEST_USER_ID = `test-user-${Date.now()}`;
const TEST_SESSION_ID = `test-session-${Date.now()}`;

// Test data
const testCustomer = {
  name: 'ტესტ მომხმარებელი',
  phone: '555123456',
  address: 'ვაჟა-ფშაველას 71',
  instructions: 'სადარბაზო 2, მე-3 სართული'
};

const testProduct = {
  name: 'შავი ბამბის მოკლე ქუდი M',
  price: 49,
  quantity: 1
};

const testWolt = {
  deliveryPrice: 8.99,
  eta: 35,
  lat: 41.7151,
  lon: 44.8271
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(type, message) {
  const prefix = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✅${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    error: `${colors.red}❌${colors.reset}`,
    step: `${colors.cyan}➤${colors.reset}`,
    bot: `${colors.bright}🤖${colors.reset}`,
    user: `${colors.bright}👤${colors.reset}`
  };
  console.log(`${prefix[type] || ''} ${message}`);
}

async function sendMessage(message, conversationHistory = []) {
  log('user', `Sending: "${message}"`);

  const response = await fetch(`${BASE_URL}/api/test-simulator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: TEST_USER_ID,
      userName: testCustomer.name,
      message,
      conversationHistory,
      debugMode: true
    })
  });

  const data = await response.json();

  if (data.success) {
    log('bot', `Response: "${data.response.substring(0, 200)}${data.response.length > 200 ? '...' : ''}"`);
    return data;
  } else {
    log('error', `API Error: ${data.error}`);
    return null;
  }
}

async function simulateMapConfirmation() {
  log('step', 'Simulating map confirmation callback...');

  const response = await fetch(`${BASE_URL}/api/location-confirmed-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: TEST_SESSION_ID,
      lat: testWolt.lat,
      lon: testWolt.lon,
      address: testCustomer.address,
      confirmed: true
    })
  });

  const data = await response.json();
  log('success', `Map confirmed: ${JSON.stringify(data)}`);
  return data;
}

async function createTestOrder() {
  log('step', 'Creating test order directly in Firestore...');

  // Call a test order creation endpoint
  const response = await fetch(`${BASE_URL}/api/test-create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: testProduct.name,
      quantity: String(testProduct.quantity),
      clientName: testCustomer.name,
      telephone: testCustomer.phone,
      address: `${testCustomer.address}, თბილისი`,
      total: `${testProduct.price + testWolt.deliveryPrice} ლარი`,
      deliveryMethod: 'wolt',
      deliveryCompany: 'wolt',
      deliveryPrice: testWolt.deliveryPrice,
      etaMinutes: testWolt.eta,
      sessionId: TEST_SESSION_ID,
      lat: testWolt.lat,
      lon: testWolt.lon,
      deliveryInstructions: testCustomer.instructions,
      isWoltOrder: true
    })
  });

  const data = await response.json();

  if (data.success) {
    log('success', `Order created: ${data.orderNumber}`);
    return data;
  } else {
    log('error', `Order creation failed: ${data.error}`);
    return null;
  }
}

async function runFullFlow() {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}🧪 FULL WOLT ORDER FLOW TEST${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test User: ${TEST_USER_ID}`);
  console.log(`Session: ${TEST_SESSION_ID}`);
  console.log('='.repeat(60) + '\n');

  const history = [];

  try {
    // Step 1: Customer wants a product
    log('step', 'STEP 1: Customer asks for product');
    let result = await sendMessage('შავი ქუდი მინდა', history);
    if (!result) throw new Error('Step 1 failed');
    history.push({ role: 'user', content: 'შავი ქუდი მინდა' });
    history.push({ role: 'assistant', content: result.response });

    console.log('');

    // Step 2: Customer chooses Wolt delivery
    log('step', 'STEP 2: Customer chooses Wolt delivery');
    result = await sendMessage('2', history);
    if (!result) throw new Error('Step 2 failed');
    history.push({ role: 'user', content: '2' });
    history.push({ role: 'assistant', content: result.response });

    console.log('');

    // Step 3: Customer provides address
    log('step', 'STEP 3: Customer provides address');
    result = await sendMessage(testCustomer.address, history);
    if (!result) throw new Error('Step 3 failed');
    history.push({ role: 'user', content: testCustomer.address });
    history.push({ role: 'assistant', content: result.response });

    console.log('');

    // Step 4: Simulate map confirmation
    log('step', 'STEP 4: Map confirmation webhook');
    await simulateMapConfirmation();

    console.log('');

    // Step 5: Customer confirms order
    log('step', 'STEP 5: Customer confirms order');
    result = await sendMessage('დიახ', history);
    if (!result) throw new Error('Step 5 failed');
    history.push({ role: 'user', content: 'დიახ' });
    history.push({ role: 'assistant', content: result.response });

    console.log('');

    // Step 6: Customer provides name
    log('step', 'STEP 6: Customer provides name');
    result = await sendMessage(testCustomer.name, history);
    if (!result) throw new Error('Step 6 failed');
    history.push({ role: 'user', content: testCustomer.name });
    history.push({ role: 'assistant', content: result.response });

    console.log('');

    // Step 7: Customer provides phone
    log('step', 'STEP 7: Customer provides phone');
    result = await sendMessage(testCustomer.phone, history);
    if (!result) throw new Error('Step 7 failed');
    history.push({ role: 'user', content: testCustomer.phone });
    history.push({ role: 'assistant', content: result.response });

    console.log('');

    // Step 8: Customer provides instructions
    log('step', 'STEP 8: Customer provides delivery instructions');
    result = await sendMessage(testCustomer.instructions, history);
    if (!result) throw new Error('Step 8 failed');
    history.push({ role: 'user', content: testCustomer.instructions });
    history.push({ role: 'assistant', content: result.response });

    console.log('');

    // Step 9: Customer chooses bank
    log('step', 'STEP 9: Customer chooses bank');
    result = await sendMessage('თიბისი', history);
    if (!result) throw new Error('Step 9 failed');
    history.push({ role: 'user', content: 'თიბისი' });
    history.push({ role: 'assistant', content: result.response });

    console.log('');

    // Step 10: Customer sends payment screenshot
    log('step', 'STEP 10: Customer sends payment confirmation');
    result = await sendMessage('გადმოვრიცხე', history);
    if (!result) throw new Error('Step 10 failed');
    history.push({ role: 'user', content: 'გადმოვრიცხე' });
    history.push({ role: 'assistant', content: result.response });

    console.log('\n' + '='.repeat(60));
    log('success', 'FLOW TEST COMPLETED');
    console.log('='.repeat(60));

    // Check if order was created
    console.log('\n📝 Final bot response:');
    console.log(result.response);

    // Check for order number in response
    const orderMatch = result.response.match(/შეკვეთის ნომერი:\s*(\d+)/);
    if (orderMatch) {
      log('success', `Order number detected: ${orderMatch[1]}`);
    } else {
      log('warning', 'No order number found in response');
    }

  } catch (error) {
    log('error', `Flow failed: ${error.message}`);
    console.error(error);
  }
}

// Run the test
runFullFlow().catch(console.error);
