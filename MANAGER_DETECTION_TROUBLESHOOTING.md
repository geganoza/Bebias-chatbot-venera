# Manager Detection Troubleshooting Guide

## Problem: Bot Still Responds After Manager Intervention

### Potential Causes:

1. **Facebook Webhook Not Configured for Echo Messages**
   - Facebook needs to be configured to send `message_echoes` events
   - Without this, the webhook won't receive echo messages at all

2. **Echo Messages Only Sent for API Messages**
   - Facebook might only send echo events for messages sent via API
   - Messages sent through Facebook Business Suite might not trigger echoes

3. **Different App ID Structure**
   - Human messages might have a different structure than expected
   - The `app_id` field might not be present or reliable

## How to Test Manager Detection:

### 1. Check Enhanced Logs
After the manager responds, check logs for:
```bash
vercel logs bebias-venera-chatbot.vercel.app --since 2m | grep -E "ECHO|Echo|app_id"
```

Look for:
- `📨 Event received:` - Shows all webhook events
- `Is Echo: true/false` - Confirms if echo message received
- `App ID: NONE (likely human)` - Indicates human message

### 2. Manual Testing Method
If echo detection isn't working, manually enable manual mode:

```bash
# Enable manual mode for test user
curl -X POST "https://bebias-venera-chatbot.vercel.app/api/manager-status" \
  -H "Content-Type: application/json" \
  -d '{"userId":"252143893748","reason":"Manager testing"}'

# Check status
curl "https://bebias-venera-chatbot.vercel.app/api/manager-status?userId=252143893748"

# Disable when done
curl -X DELETE "https://bebias-venera-chatbot.vercel.app/api/manager-status?userId=252143893748"
```

### 3. Verify Facebook Webhook Configuration

The webhook needs to subscribe to these events:
- `messages` - Regular messages
- `message_echoes` - **CRITICAL for manager detection**
- `messaging_postbacks` - Button clicks

To check/update:
1. Go to Facebook App Dashboard
2. Navigate to Messenger → Settings → Webhooks
3. Edit subscription
4. Ensure `message_echoes` is checked

### 4. Alternative Detection Methods

If echo messages aren't reliable, consider:

1. **Manual Toggle in Control Panel**
   - Add a "Manager Mode" toggle per conversation
   - Manager manually enables when taking over

2. **Special Command Detection**
   - Manager types `/manager on` to take over
   - Bot recognizes and enables manual mode

3. **Time-Based Detection**
   - If conversation has manual mode history
   - Auto-enable for 30 minutes after manager message

## Current Implementation:

The system checks for manager intervention using:
1. **Echo message detection** (`is_echo: true`)
2. **App ID check** (no `app_id` = likely human)
3. **Content pattern analysis** (detects bot patterns)

## Debug Information:

When testing, the logs now show:
```
📨 [WH:abc123] Event received:
   Sender: PAGE_ID
   Recipient: USER_ID
   Message ID: mid.xxxxx
   Is Echo: true
   🔊 ECHO MESSAGE DETAILS: {full message structure}
```

This helps identify:
- If echo messages are being received
- The structure of echo messages
- Whether app_id is present

## Quick Fix if Not Working:

If echo detection fails during testing:

1. **Use the API to manually enable:**
   ```bash
   curl -X POST "https://bebias-venera-chatbot.vercel.app/api/manager-status" \
     -H "Content-Type: application/json" \
     -d '{"userId":"USER_ID","reason":"Manual intervention"}'
   ```

2. **Use control panel:**
   - Go to /control-panel
   - Find conversation
   - Enable manual mode

3. **Check Facebook App Settings:**
   - Ensure webhook has proper permissions
   - Verify `message_echoes` subscription

## Next Steps:

1. Test with enhanced logging to see echo message structure
2. Verify Facebook webhook subscriptions
3. Consider implementing fallback detection methods
4. Add manual toggle in control panel UI