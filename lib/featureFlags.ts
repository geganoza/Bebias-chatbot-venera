/**
 * Feature flags for gradual rollout of new features
 * This allows us to test new functionality with specific users first
 */

// Test user IDs - add your test Facebook user IDs here
const TEST_USER_IDS: string[] = [
  '3282789748459241', // Giorgi's test account - Re-enabled to prevent context duplication
  '252143893748', // New test user - can clear history with "clear history" command
];

// Feature flags
const FEATURES = {
  REDIS_MESSAGE_BATCHING: {
    enabled: process.env.ENABLE_REDIS_BATCHING === 'true',
    testUsers: TEST_USER_IDS,
    rolloutPercentage: 0, // 0% rollout initially, can increase gradually
  }
};

/**
 * Check if a feature is enabled for a specific user
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES, userId: string): boolean {
  const config = FEATURES[feature];

  if (!config || !config.enabled) {
    return false;
  }

  // Check if user is in test group
  if (config.testUsers.includes(userId)) {
    console.log(`✅ Feature ${feature} enabled for test user ${userId}`);
    return true;
  }

  // Check rollout percentage
  if (config.rolloutPercentage > 0) {
    // Simple hash-based rollout (deterministic per user)
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const userPercentage = hash % 100;

    if (userPercentage < config.rolloutPercentage) {
      console.log(`✅ Feature ${feature} enabled for ${userId} (${userPercentage}% < ${config.rolloutPercentage}%)`);
      return true;
    }
  }

  return false;
}

/**
 * Add a user to the test group for a feature
 */
export function addTestUser(userId: string) {
  if (!TEST_USER_IDS.includes(userId)) {
    TEST_USER_IDS.push(userId);
    console.log(`👤 Added ${userId} to test users`);
  }
}

/**
 * Get current feature status
 */
export function getFeatureStatus() {
  return {
    REDIS_MESSAGE_BATCHING: {
      ...FEATURES.REDIS_MESSAGE_BATCHING,
      testUserCount: FEATURES.REDIS_MESSAGE_BATCHING.testUsers.length,
    }
  };
}