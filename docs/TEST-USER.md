# Test User Quick Reference

## Test User ID
```
3282789748459241
```
This is Giorgi's Facebook Messenger account used for testing.

---

## Clear Test User History

Before testing, clear the conversation history to start fresh:

```bash
node scripts/clear-test-user-history.js 3282789748459241
```

This clears:
- Conversation history
- Order history
- Processed message records
- Processing locks

---

## List All Users (Find Other Test Users)

```bash
node scripts/clear-test-user-history.js
```
Running without arguments lists the 10 most recent conversations.

---

## View Test User's Conversation

```bash
node scripts/get-full-conversation.js 3282789748459241
```

---

## Useful Commands for Testing

| Command | Description |
|---------|-------------|
| `node scripts/clear-test-user-history.js 3282789748459241` | Clear history |
| `node scripts/check-bot-status.js` | Check if bot is paused/killed |
| `node scripts/reset-circuit-breaker.js` | Reset rate limits |
| `vercel logs bebias-venera-chatbot.vercel.app` | View live logs |

---

## Testing Workflow

1. **Clear history** before testing:
   ```bash
   node scripts/clear-test-user-history.js 3282789748459241
   ```

2. **Watch logs** in a separate terminal:
   ```bash
   timeout 60 vercel logs bebias-venera-chatbot.vercel.app
   ```

3. **Send test message** via Facebook Messenger to the Bebias page

4. **Check for errors** in logs

---

**Last Updated:** November 24, 2025
