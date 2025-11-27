# Test System Documentation

## Overview
This test system allows you to test new bot instructions and flows with specific test users while keeping production users on stable instructions.

## Structure

### Test Folder Structure
```
data/content/test/
├── bot-instructions-test.md       # Copy of original instructions
├── bot-instructions-modular.md    # New modular version
├── core/                          # Core functionality modules
│   ├── critical-rules.md         # Language and mandatory rules
│   ├── order-flow-steps.md       # Purchase flow steps
│   └── order-lookup-system.md    # Order lookup logic
├── context/                       # Context management modules
│   ├── context-retention-rules.md    # Context memory rules
│   └── context-awareness-rules.md    # 7 awareness rules
└── [copies of other instruction files]
```

### Configuration Files
- **config/test-users.json** - Test user configuration
- **utils/test-router.js** - Routing logic (ready to use)

## How to Activate Test Mode

### Step 1: Configure Test Users
Edit `config/test-users.json`:

```json
{
  "testMode": {
    "enabled": true  // <-- Change to true
  },
  "testUsers": {
    "facebook": [
      {
        "userId": "ACTUAL_FB_USER_ID",  // <-- Add real Facebook user ID
        "name": "Test User Name",
        "phone": "595000001",
        "instructionsPath": "data/content/test/bot-instructions-modular.md",
        "useModularInstructions": true
      }
    ]
  }
}
```

### Step 2: Integrate in Your Webhook Handler

**IMPORTANT: Only do this when ready, as it will affect the running bot!**

In your webhook handler file (likely `api/webhook.js` or similar), add at the top:

```javascript
const testRouter = require('../utils/test-router');
```

Then, when loading instructions:

```javascript
// Instead of:
const instructions = fs.readFileSync('data/content/bot-instructions.md', 'utf8');

// Use:
const instructionsPath = testRouter.getInstructionsPath(senderId);
const instructions = fs.readFileSync(instructionsPath, 'utf8');

// For modular instructions:
const allPaths = testRouter.getAllInstructionPaths(senderId);
// Load each module as needed
```

### Step 3: Add Test User Detection
In your message processing:

```javascript
// Check if test user
const isTest = testRouter.isTestUser(senderId);
const features = testRouter.getTestFeatures(senderId);

if (features.enableDebugLogging) {
  console.log('[TEST USER] Processing message:', message);
}

// Optional: Add test indicator in responses
if (features.showInstructionSource && isTest) {
  response += '\n[TEST MODE]';
}
```

## Test Scenarios

### Scenario 1: Test New Modular Instructions
1. Set user to use `bot-instructions-modular.md`
2. Test that modules are properly referenced
3. Verify order flow works with separated files

### Scenario 2: A/B Testing
1. Configure User A with original instructions
2. Configure User B with modular instructions
3. Compare performance and accuracy

### Scenario 3: Gradual Rollout
1. Start with 1 test user
2. Add more test users gradually
3. Monitor for issues
4. Switch to production when stable

## Important Notes

1. **Keep Order Confirmation Format in Main File**
   - As you noted, this is critical and problematic
   - It stays in the main instruction file for both test and production

2. **Test Features Available:**
   - `enableDebugLogging` - Extra console logs
   - `showInstructionSource` - Shows which instructions are being used
   - `skipOrderEmail` - Don't send real order emails during testing
   - `testPaymentVerification` - Accept test payment screenshots

3. **Safety Measures:**
   - Test mode is OFF by default
   - Each user must be explicitly added
   - Easy rollback - just set enabled to false
   - No changes to production users

## Testing Checklist

Before activating:
- [ ] Backup current working code
- [ ] Get actual Facebook user IDs for test accounts
- [ ] Verify test instruction files are complete
- [ ] Test router.js is imported but NOT active

During testing:
- [ ] Test order flow completely
- [ ] Test context retention
- [ ] Test order lookup
- [ ] Test image handling
- [ ] Test error scenarios

After testing:
- [ ] Document any issues found
- [ ] Update instruction files as needed
- [ ] Plan production rollout

## Rollback Procedure

If issues occur:
1. Set `testMode.enabled` to `false` in config
2. All users immediately return to production instructions
3. No code changes needed

## Production Migration

When ready to go live:
1. Copy tested files from `test/` to main `content/` folder
2. Update production bot-instructions.md
3. Remove test configuration
4. Deploy normally

---

**Current Status:** Test system is built but NOT connected. Safe to proceed with other work.