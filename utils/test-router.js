/**
 * Test Router - Routes test users to test instructions
 * DO NOT ACTIVATE until ready to test
 */

const fs = require('fs');
const path = require('path');

// Load test configuration
const testConfigPath = path.join(__dirname, '../config/test-users.json');
let testConfig = {};

try {
  if (fs.existsSync(testConfigPath)) {
    testConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
  }
} catch (error) {
  console.error('Error loading test config:', error);
  testConfig = { testMode: { enabled: false } };
}

/**
 * Check if user is a test user
 * @param {string} userId - Facebook user ID
 * @returns {boolean}
 */
function isTestUser(userId) {
  if (!testConfig.testMode?.enabled) return false;

  const testUsers = testConfig.testUsers?.facebook || [];
  return testUsers.some(user => user.userId === userId);
}

/**
 * Get instructions path for user
 * @param {string} userId - Facebook user ID
 * @returns {string} Path to instructions file
 */
function getInstructionsPath(userId) {
  // Default production path
  const defaultPath = 'data/content/bot-instructions.md';

  if (!testConfig.testMode?.enabled) {
    return defaultPath;
  }

  const testUsers = testConfig.testUsers?.facebook || [];
  const testUser = testUsers.find(user => user.userId === userId);

  if (testUser) {
    console.log(`[TEST MODE] Using test instructions for user ${testUser.name}`);
    return testUser.instructionsPath || defaultPath;
  }

  return defaultPath;
}

/**
 * Get all instruction files for user
 * @param {string} userId - Facebook user ID
 * @returns {object} Object with paths to all instruction files
 */
function getAllInstructionPaths(userId) {
  const basePath = isTestUser(userId) ? 'data/content/test' : 'data/content';

  // For test users with modular instructions
  const testUser = testConfig.testUsers?.facebook?.find(user => user.userId === userId);
  if (testUser?.useModularInstructions) {
    return {
      main: testUser.instructionsPath,
      contextRetention: path.join(basePath, 'context/context-retention-rules.md'),
      contextAwareness: path.join(basePath, 'context/context-awareness-rules.md'),
      criticalRules: path.join(basePath, 'core/critical-rules.md'),
      orderFlow: path.join(basePath, 'core/order-flow-steps.md'),
      orderLookup: path.join(basePath, 'core/order-lookup-system.md'),
      // Existing files
      toneStyle: path.join(basePath, 'tone-style.md'),
      imageHandling: path.join(basePath, 'image-handling.md'),
      productRecognition: path.join(basePath, 'product-recognition.md'),
      purchaseFlow: path.join(basePath, 'purchase-flow.md'),
      deliveryInfo: path.join(basePath, 'delivery-info.md'),
      deliveryCalculation: path.join(basePath, 'delivery-calculation.md'),
      contactPolicies: path.join(basePath, 'contact-policies.md'),
      paymentInfo: path.join(basePath, 'payment-info.md'),
      services: path.join(basePath, 'services.md'),
      faqs: path.join(basePath, 'faqs.md')
    };
  }

  // For regular users or test users with single-file instructions
  return {
    main: getInstructionsPath(userId),
    toneStyle: path.join(basePath, 'tone-style.md'),
    imageHandling: path.join(basePath, 'image-handling.md'),
    productRecognition: path.join(basePath, 'product-recognition.md'),
    purchaseFlow: path.join(basePath, 'purchase-flow.md'),
    deliveryInfo: path.join(basePath, 'delivery-info.md'),
    deliveryCalculation: path.join(basePath, 'delivery-calculation.md'),
    contactPolicies: path.join(basePath, 'contact-policies.md'),
    paymentInfo: path.join(basePath, 'payment-info.md'),
    services: path.join(basePath, 'services.md'),
    faqs: path.join(basePath, 'faqs.md')
  };
}

/**
 * Check if test features are enabled for user
 * @param {string} userId - Facebook user ID
 * @returns {object} Test features configuration
 */
function getTestFeatures(userId) {
  if (!isTestUser(userId)) {
    return {
      enableDebugLogging: false,
      showInstructionSource: false,
      skipOrderEmail: false,
      testPaymentVerification: false
    };
  }

  return testConfig.testFeatures || {};
}

module.exports = {
  isTestUser,
  getInstructionsPath,
  getAllInstructionPaths,
  getTestFeatures,
  testConfig
};