# Manager Intervention Detection System

**Created: December 3, 2024**
**Purpose: Automatically detect when a manager responds to customers and pause the bot**

## Overview

This system automatically detects when a manager or page admin responds to a customer through the Facebook Page and temporarily disables the bot for that conversation. This prevents the bot and manager from responding simultaneously.

## How It Works

### 1. Echo Message Detection
When someone from the Facebook Page responds to a customer, Facebook sends an "echo" webhook event. We analyze these echo messages to determine if they're from:
- **The Bot**: Has specific patterns (order confirmations, emoji prefixes, etc.)
- **A Human Manager**: Natural language without bot patterns

### 2. Automatic Manual Mode
When a human manager message is detected:
1. The system automatically enables "manual mode" for that conversation
2. All pending messages in the Redis queue are cleared
3. The bot stops responding to that customer
4. A system note is logged
5. **IMPORTANT**: Both customer and manager messages continue to be saved to history

### 3. History Preservation
Even when the bot is not responding (manual mode active):
- **Customer messages** are saved to conversation history with `role: "user"`
- **Manager messages** are saved to conversation history with `role: "assistant"` and `[MANAGER]:` prefix
- When the bot resumes, it has full context of what was discussed
- This ensures seamless handoff back to the bot with complete conversation context

### 3. Message Patterns

#### Bot Message Patterns (Will NOT trigger manual mode):
```
✅ შეკვეთა მიღებულია
შეკვეთა #BEB00156
📦 პროდუქტი: შავი ქუდი
💰 ფასი: 45 ლარი
🚚 მიწოდება: 2-3 დღე
SEND_IMAGE: HAT_BLACK
```

#### Human Manager Messages (WILL trigger manual mode):
```
გამარჯობა, როგორ შემიძლია დაგეხმაროთ?
Let me check that for you
კი, ეს პროდუქტი ხელმისაწვდომია
I'll handle this order personally
```

## Files Created/Modified

### New Files:
1. **`/lib/managerDetection.ts`** - Core detection logic
   - `isHumanManagerMessage()` - Detects human vs bot messages
   - `processPageEchoMessage()` - Processes echo events
   - `enableManualModeForConversation()` - Enables manual mode
   - `disableManualMode()` - Re-enables bot

2. **`/app/api/manager-status/route.ts`** - Management API
   - GET: Check manual mode status
   - POST: Manually enable manual mode
   - DELETE: Disable manual mode

3. **`/scripts/test-manager-detection.js`** - Test utilities

### Modified Files:
1. **`/app/api/messenger/route.ts`**
   - Line 2154-2166: Process echo messages for manager detection
   - Line 2399-2408: Check manual mode before queuing messages

## API Endpoints

### Check Status
```bash
# Check specific user
GET /api/manager-status?userId=USER_ID

# Check all users with manual mode
GET /api/manager-status?all=true
```

### Enable Manual Mode
```bash
POST /api/manager-status
{
  "userId": "USER_ID",
  "reason": "Manager taking over"
}
```

### Disable Manual Mode
```bash
DELETE /api/manager-status?userId=USER_ID
```

## Testing

### Run Test Script
```bash
node scripts/test-manager-detection.js
```

### Manual Testing
1. Have a customer send a message to the bot
2. As the page admin, respond to the customer via Facebook Business Suite
3. Check logs - should see: `👨‍💼 Manager intervention detected`
4. Customer sends another message - bot should not respond
5. Use API to disable manual mode when done

### Check Logs
```bash
# Check Vercel logs for detection events
vercel logs bebias-venera-chatbot.vercel.app --since 5m | grep -E "Manager|manual mode|ECHO"
```

## Control Panel Integration

The existing control panel at `/control-panel` already has manual mode controls. When manager intervention is auto-detected:
- The conversation will show "Manual Mode: Active"
- Manager can disable it when done
- History shows when it was auto-enabled

## Important Notes

### 1. NO BATCHING CHANGES
This system does NOT modify the Redis batching system. It simply:
- Skips messages if manual mode is active
- Clears pending messages when enabling manual mode

### 2. Fail-Safe Design
- If detection fails, bot continues normally
- If Firestore is down, bot continues normally
- Manual mode can always be disabled via API/control panel

### 3. Performance Impact
- Minimal - only adds one Firestore check per message
- Echo messages are processed separately
- No changes to batching or core flow

## Troubleshooting

### Bot Still Responding After Manager Intervention
1. Check if echo messages are being received:
   ```bash
   vercel logs | grep "ECHO message"
   ```
2. Verify manual mode was enabled:
   ```bash
   curl https://your-domain.vercel.app/api/manager-status?userId=USER_ID
   ```

### Manual Mode Stuck On
1. Disable via API:
   ```bash
   curl -X DELETE https://your-domain.vercel.app/api/manager-status?userId=USER_ID
   ```
2. Or use control panel

### False Positives (Bot messages detected as human)
- Review patterns in `isHumanManagerMessage()` function
- Add more bot patterns if needed

## Future Improvements

1. **Auto-disable after timeout** - Re-enable bot after 30 minutes of inactivity
2. **Manager notification** - Send alert when taking over
3. **Statistics tracking** - Track how often managers intervene
4. **Pattern learning** - Learn manager message patterns over time

## Summary

This feature provides seamless handoff between bot and human managers without requiring manual intervention. When a manager responds through Facebook, the bot automatically steps back and lets the human handle the conversation.