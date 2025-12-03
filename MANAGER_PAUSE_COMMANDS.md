# Manager Pause/Resume Commands

## Why This System?
**Echo messages are DISABLED** to avoid double API costs (they were creating duplicate requests and costing twice as much money). Without echo messages, the bot cannot automatically detect when a manager responds.

## Solution: Simple Commands

### To Take Over a Conversation:
**Type any of these in the customer conversation:**
- `pause`
- `pause bot`
- `/pause`

**Bot will confirm:** 🔴 Bot paused - Manager taking over conversation

### To Resume Bot:
**Type any of these:**
- `resume`
- `resume bot`
- `/resume`

**Bot will confirm:** 🟢 Bot resumed - Automated responses active

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