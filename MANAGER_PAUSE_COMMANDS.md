# Manager Pause/Resume System

## Why This System?
**Echo messages are DISABLED** to avoid double API costs (they were creating duplicate requests and costing twice as much money). Without echo messages, the bot cannot automatically detect when a manager responds.

## Solution: Web-Based Control

### Quick Pause URL Method (Recommended)

**To pause bot for a specific user:**
1. Get the user's Facebook ID from the conversation
2. Visit: `https://bebias-venera-chatbot.vercel.app/api/quick-pause?userId=USER_ID_HERE&action=pause`
3. You'll see a confirmation page
4. Bot stops responding to that user
5. **Customer sees nothing** - completely invisible

**To resume bot:**
1. Visit: `https://bebias-venera-chatbot.vercel.app/api/quick-pause?userId=USER_ID_HERE&action=resume`
2. Bot resumes responding

**Pro tip:** Bookmark the URL for frequent customers!

### Example URLs:
```
# For test user Giorgi (252143893748)
Pause: https://bebias-venera-chatbot.vercel.app/api/quick-pause?userId=252143893748&action=pause
Resume: https://bebias-venera-chatbot.vercel.app/api/quick-pause?userId=252143893748&action=resume
Status: https://bebias-venera-chatbot.vercel.app/api/quick-pause?userId=252143893748
```

## How It Works:

1. **Customer asks complex question**
2. **Manager sees it needs human help**
3. **Manager types:** `pause`
4. **Bot stops responding to that customer**
5. **Manager handles the conversation**
6. **When done, manager types:** `resume`
7. **Bot resumes normal operation**

## Important Notes:

- ✅ Commands work immediately
- ✅ History is preserved during pause
- ✅ Bot has full context when resuming
- ✅ Each conversation is controlled separately
- ✅ No echo messages needed
- ✅ No double API costs

## Testing:

### Test with Giorgi (252143893748):
1. Send a message as test user
2. As manager, type `pause` in the conversation
3. Bot should confirm and stop responding
4. Handle the customer
5. Type `resume` when done
6. Bot should resume

### Check Status via API:
```bash
# Check if paused
curl "https://bebias-venera-chatbot.vercel.app/api/manager-status?userId=252143893748"

# Manually pause (backup method)
curl -X POST "https://bebias-venera-chatbot.vercel.app/api/manager-status" \
  -H "Content-Type: application/json" \
  -d '{"userId":"252143893748","reason":"Manual intervention"}'

# Manually resume (backup method)
curl -X DELETE "https://bebias-venera-chatbot.vercel.app/api/manager-status?userId=252143893748"
```

## Why Not Automatic Detection?

Automatic detection would require:
- **Echo messages** → Double API costs
- **Webhook changes** → Complex Facebook configuration
- **Different infrastructure** → More maintenance

The simple command approach:
- **Works immediately**
- **No extra costs**
- **Easy to understand**
- **100% reliable**

## Summary:

**Just type `pause` to take over, `resume` when done!**