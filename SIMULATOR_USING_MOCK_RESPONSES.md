# ⚠️ Simulator Currently Using MOCK Responses

## What You're Seeing:

The test simulator is currently returning **hardcoded mock responses** - NOT using the actual test instructions or AI.

That's why you're seeing incorrect/outdated information like "Martivi consulting".

## Why This Happens:

The test API endpoint (`app/api/test-simulator/route.ts`) has a placeholder `generateBotResponse` function that returns mock responses instead of calling OpenAI.

**Current code** (line ~130):
```typescript
// Mock response for now
const msg = userMessage.toLowerCase();

if (msg.includes('გამარჯობა')) {
  return 'გამარჯობა ბებია! 💛 რით დაგეხმარო?';
}
// ... more hardcoded responses
```

## ✅ Your Test Instructions Are Correct!

The files in `test-bot/data/content/` are correct and say **BEBIAS** (not Martivi):
- ✅ bot-instructions-modular.md - Says "BEBIAS"
- ✅ contact-policies.md - BEBIAS info
- ✅ All files - Correct BEBIAS content

**The problem:** They're just not being used yet because there's no AI connection.

## 🔧 How to Fix (Connect to OpenAI):

### Option 1: Quick Fix - Use Your Existing OpenAI Setup

Edit `app/api/test-simulator/route.ts` and replace the `generateBotResponse` function:

```typescript
import OpenAI from 'openai';

async function generateBotResponse(
  userMessage: string,
  systemPrompt: string,
  userId: string
): Promise<string> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Or 'gpt-4' if you prefer
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return response.choices[0].message.content || 'ბოდიში, ვერ გავიგე';
  } catch (error) {
    console.error('[TEST SIMULATOR] OpenAI Error:', error);
    return 'ბოდიში, ტექნიკური პრობლემაა. მალე დაგიკავშირდება მენეჯერი 💛';
  }
}
```

Then redeploy:
```bash
vercel --prod
```

### Option 2: Copy from Production

Your production bot already has working OpenAI integration. You can copy that logic:

1. **Find your production OpenAI call** in `app/api/messenger/route.ts`
2. **Copy the relevant parts** to test-simulator
3. **Make sure it uses `systemPrompt`** (which contains test instructions)
4. **Redeploy**

## After Fixing:

Once you add real OpenAI integration:

✅ Simulator will use test-bot/data/content/ instructions
✅ Will say BEBIAS (not Martivi)
✅ Will follow all test instruction rules
✅ Will be actual working bot

## Current Status:

**Test Instructions:** ✅ Correct (BEBIAS)
**Test API:** ✅ Deployed and working
**Test UI:** ✅ Accessible
**OpenAI Integration:** ❌ Not connected yet (using mocks)

**Next Step:** Add OpenAI integration to get real responses using your BEBIAS test instructions.

---

## Quick Verification:

You can verify test instructions are correct:

```bash
# Check main test instructions
head -30 test-bot/data/content/bot-instructions-modular.md

# Should show:
# "BEBIAS chatbot"
# "Emma Grandma"
# etc.
```

The instructions are fine - just need to connect them to OpenAI! 🔌