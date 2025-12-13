#!/usr/bin/env node
/**
 * Full Wolt Order Flow Test
 *
 * This script runs a complete order flow and shows all messages.
 * Payment screenshot is automatically included when needed.
 */

const BASE_URL = 'https://bebias-venera-chatbot.vercel.app';
// Use shared tester ID so /test-live Watch Mode can see the conversation
const TESTER_ID = 'claude-shared-test';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

function log(prefix, message, color = colors.reset) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function sendMessage(message, hasPaymentScreenshot = false) {
  const screenshotNote = hasPaymentScreenshot ? ' [+ Payment Screenshot]' : '';
  log('👤 ME:', `${message}${screenshotNote}`, colors.blue);

  const response = await fetch(`${BASE_URL}/api/test-conversation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send',
      testerId: TESTER_ID,
      message,
      hasPaymentScreenshot
    })
  });

  const data = await response.json();

  if (data.success) {
    log('🤖 BOT:', data.response, colors.green);
    if (data.metadata?.mapLink) {
      log('🗺️ MAP:', data.metadata.mapLink, colors.cyan);
    }
    return data;
  } else {
    log('❌ ERR:', data.error, colors.red);
    return null;
  }
}

async function confirmMap() {
  log('🗺️ ACTION:', 'Confirming map location...', colors.yellow);

  const response = await fetch(`${BASE_URL}/api/test-conversation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'confirm_map',
      testerId: TESTER_ID
    })
  });

  const data = await response.json();

  if (data.success) {
    log('✅ MAP:', `Confirmed! Price: ${data.woltPrice}₾, ETA: ${data.woltEta} min`, colors.green);
    return data;
  } else {
    log('❌ MAP:', data.error || 'Failed to confirm', colors.red);
    return null;
  }
}

async function runTest() {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bold}🧪 FULL WOLT ORDER FLOW TEST${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`Tester ID: ${TESTER_ID}`);
  console.log(`Screenshot: https://bebias-venera-chatbot.vercel.app/test-payment-screenshot.svg`);
  console.log('='.repeat(60) + '\n');

  // Reset first
  await fetch(`${BASE_URL}/api/test-conversation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset', testerId: TESTER_ID })
  });

  const delay = ms => new Promise(r => setTimeout(r, ms));

  // Step 1: Ask for product
  console.log(`\n${colors.dim}--- Step 1: Ask for product ---${colors.reset}`);
  await sendMessage('შავი ქუდი მინდა');
  await delay(1000);

  // Step 2: Choose Wolt
  console.log(`\n${colors.dim}--- Step 2: Choose Wolt delivery ---${colors.reset}`);
  await sendMessage('2');
  await delay(1000);

  // Step 3: Provide address
  console.log(`\n${colors.dim}--- Step 3: Provide address ---${colors.reset}`);
  await sendMessage('ვაჟა-ფშაველას 71');
  await delay(1000);

  // Step 4: Confirm map
  console.log(`\n${colors.dim}--- Step 4: Confirm map location ---${colors.reset}`);
  await confirmMap();
  await delay(1000);

  // Step 5: Confirm order
  console.log(`\n${colors.dim}--- Step 5: Confirm order ---${colors.reset}`);
  await sendMessage('დიახ');
  await delay(1000);

  // Step 6: Provide name
  console.log(`\n${colors.dim}--- Step 6: Provide name ---${colors.reset}`);
  await sendMessage('გიორგი ნოზაძე');
  await delay(1000);

  // Step 7: Provide phone
  console.log(`\n${colors.dim}--- Step 7: Provide phone ---${colors.reset}`);
  await sendMessage('555123456');
  await delay(1000);

  // Step 8: Delivery instructions
  console.log(`\n${colors.dim}--- Step 8: Delivery instructions ---${colors.reset}`);
  await sendMessage('მე-2 სადარბაზო, მე-3 სართული');
  await delay(1000);

  // Step 9: Choose bank
  console.log(`\n${colors.dim}--- Step 9: Choose bank ---${colors.reset}`);
  await sendMessage('თიბისი');
  await delay(1000);

  // Step 10: Send payment screenshot
  console.log(`\n${colors.dim}--- Step 10: Send payment with screenshot ---${colors.reset}`);
  console.log(`${colors.cyan}📷 Attaching screenshot: test-payment-screenshot.svg${colors.reset}`);
  await sendMessage('გადავიხადე', true);  // true = hasPaymentScreenshot

  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bold}✅ TEST COMPLETE${colors.reset}`);
  console.log('='.repeat(60) + '\n');
}

runTest().catch(console.error);
