#!/usr/bin/env node

/**
 * Test script for manager detection feature
 *
 * This script tests the automatic detection of manager intervention
 * when they respond to customers via Facebook Page
 */

const TEST_USER_ID = '252143893748'; // Test user ID

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

async function checkStatus(baseUrl, userId) {
  const url = `${baseUrl}/api/manager-status?userId=${userId}`;
  log(`Checking status for ${userId}...`, 'cyan');

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.manualMode) {
      log(`✅ Manual mode is ENABLED`, 'green');
      log(`   Enabled at: ${data.enabledAt}`, 'green');
      log(`   Reason: ${data.reason}`, 'green');
    } else {
      log(`❌ Manual mode is DISABLED`, 'yellow');
    }

    return data;
  } catch (error) {
    log(`❌ Error checking status: ${error.message}`, 'red');
    return null;
  }
}

async function enableManualMode(baseUrl, userId, reason) {
  const url = `${baseUrl}/api/manager-status`;
  log(`Enabling manual mode for ${userId}...`, 'cyan');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason })
    });

    const data = await response.json();

    if (data.success) {
      log(`✅ Manual mode enabled successfully`, 'green');
    } else {
      log(`❌ Failed to enable: ${data.error}`, 'red');
    }

    return data;
  } catch (error) {
    log(`❌ Error enabling manual mode: ${error.message}`, 'red');
    return null;
  }
}

async function disableManualMode(baseUrl, userId) {
  const url = `${baseUrl}/api/manager-status?userId=${userId}`;
  log(`Disabling manual mode for ${userId}...`, 'cyan');

  try {
    const response = await fetch(url, { method: 'DELETE' });
    const data = await response.json();

    if (data.success) {
      log(`✅ Manual mode disabled successfully`, 'green');
    } else {
      log(`❌ Failed to disable: ${data.error}`, 'red');
    }

    return data;
  } catch (error) {
    log(`❌ Error disabling manual mode: ${error.message}`, 'red');
    return null;
  }
}

async function checkAllActiveUsers(baseUrl) {
  const url = `${baseUrl}/api/manager-status?all=true`;
  log(`Checking all users with active manual mode...`, 'cyan');

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      log(`Found ${data.count} users with manual mode active:`, 'green');
      data.users.forEach(user => {
        log(`   • ${user.userId}: ${user.reason} (${user.enabledAt})`, 'yellow');
      });
    }

    return data;
  } catch (error) {
    log(`❌ Error checking all users: ${error.message}`, 'red');
    return null;
  }
}

async function simulateManagerMessage(message) {
  log(`Simulating manager message: "${message}"`, 'cyan');

  // Import the detection function
  const { isHumanManagerMessage } = await import('../lib/managerDetection.js');

  const isHuman = isHumanManagerMessage(message);

  if (isHuman) {
    log(`✅ Detected as HUMAN manager message`, 'green');
  } else {
    log(`🤖 Detected as BOT message`, 'yellow');
  }

  return isHuman;
}

async function runTests() {
  // Determine if running locally or on Vercel
  const isLocal = !process.env.VERCEL_URL;
  const baseUrl = isLocal ? 'http://localhost:3000' : `https://${process.env.VERCEL_URL}`;

  log(`🧪 Starting Manager Detection Tests`, 'bright');
  log(`Base URL: ${baseUrl}`, 'cyan');
  log(`Test User: ${TEST_USER_ID}`, 'cyan');
  console.log('');

  // Test 1: Check initial status
  log(`TEST 1: Check initial status`, 'magenta');
  await checkStatus(baseUrl, TEST_USER_ID);
  console.log('');

  // Test 2: Test message detection patterns
  log(`TEST 2: Test message detection patterns`, 'magenta');

  const testMessages = [
    // Human manager messages
    { text: "გამარჯობა, როგორ შემიძლია დაგეხმაროთ?", expected: true },
    { text: "კი, ეს პროდუქტი ხელმისაწვდომია", expected: true },
    { text: "დიდი მადლობა შეკვეთისთვის!", expected: true },
    { text: "Sorry for the delay, I'll check this now", expected: true },
    { text: "Let me help you with that order", expected: true },

    // Bot messages
    { text: "✅ შეკვეთა მიღებულია\n📦 პროდუქტი: შავი ქუდი\n💰 ფასი: 45 ლარი", expected: false },
    { text: "შეკვეთა #BEB00156 მიღებულია", expected: false },
    { text: "📦 პროდუქტი: წითელი შარფი\n💰 ფასი: 35 ლარი\n🚚 მიწოდება: 2-3 დღე", expected: false },
    { text: "SEND_IMAGE: SCARF_RED", expected: false },
    { text: "❌ შეცდომა: გთხოვთ სცადოთ მოგვიანებით", expected: false }
  ];

  for (const testMessage of testMessages) {
    const result = await simulateManagerMessage(testMessage.text);
    const passed = result === testMessage.expected;

    if (passed) {
      log(`   ✅ PASS: "${testMessage.text.substring(0, 50)}..."`, 'green');
    } else {
      log(`   ❌ FAIL: "${testMessage.text.substring(0, 50)}..." (expected ${testMessage.expected}, got ${result})`, 'red');
    }
  }
  console.log('');

  // Test 3: Enable manual mode
  log(`TEST 3: Enable manual mode`, 'magenta');
  await enableManualMode(baseUrl, TEST_USER_ID, 'Test: Manager intervention detected');
  console.log('');

  // Test 4: Verify it's enabled
  log(`TEST 4: Verify manual mode is enabled`, 'magenta');
  await checkStatus(baseUrl, TEST_USER_ID);
  console.log('');

  // Test 5: Check all active users
  log(`TEST 5: Check all active manual mode users`, 'magenta');
  await checkAllActiveUsers(baseUrl);
  console.log('');

  // Test 6: Disable manual mode
  log(`TEST 6: Disable manual mode`, 'magenta');
  await disableManualMode(baseUrl, TEST_USER_ID);
  console.log('');

  // Test 7: Verify it's disabled
  log(`TEST 7: Verify manual mode is disabled`, 'magenta');
  await checkStatus(baseUrl, TEST_USER_ID);
  console.log('');

  log(`✅ All tests completed!`, 'bright');
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    log(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  checkStatus,
  enableManualMode,
  disableManualMode,
  checkAllActiveUsers,
  simulateManagerMessage
};