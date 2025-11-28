# 🧪 Test Chat - Access Instructions

## ✅ NOW LIVE AND WORKING!

### Your Test Chat URLs:

**Primary Access:**
```
https://bebias-venera-chatbot-j56m1hsq0-giorgis-projects-cea59354.vercel.app/test-chat/
```

**Alternative (if you have custom domain):**
```
https://your-custom-domain.vercel.app/test-chat/
```

**API Endpoint:**
```
https://bebias-venera-chatbot-j56m1hsq0-giorgis-projects-cea59354.vercel.app/api/test-simulator
```

---

## 🎮 How to Use:

1. **Open the URL** (click link above)
2. **You'll see** a Messenger-like interface
3. **Click a test user** from the left sidebar
4. **Click quick action buttons** OR type your own message
5. **Get bot response** immediately!

---

## 🎯 Quick Test Actions:

Once you open the chat:

- **👋 Greeting** - Test Georgian greeting
- **🧢 Order product** - Test product ordering
- **📦 Check order** - Test order lookup
- **🔍 Browse** - Test product browsing

---

## 📝 Current Status:

**Test Simulator:**
- ✅ UI: Live and accessible
- ✅ API: Working
- ⚠️ Responses: Currently MOCK (need to add OpenAI integration)

**Production Bot:**
- ✅ Completely unaffected
- ✅ Working normally
- ✅ All real users safe

---

## 🔧 To Enable Real AI Responses:

The simulator currently returns mock responses. To get real AI responses using your OpenAI key:

1. **Edit the file:**
   ```
   app/api/test-simulator/route.ts
   ```

2. **Find the `generateBotResponse` function** (around line 130)

3. **Replace with this:**
   ```typescript
   import OpenAI from 'openai';

   async function generateBotResponse(
     userMessage: string,
     systemPrompt: string,
     userId: string
   ): Promise<string> {
     const openai = new OpenAI({
       apiKey: process.env.OPENAI_API_KEY
     });

     const response = await openai.chat.completions.create({
       model: 'gpt-4o-mini',
       messages: [
         { role: 'system', content: systemPrompt },
         { role: 'user', content: userMessage }
       ],
       temperature: 0.7,
       max_tokens: 500
     });

     return response.choices[0].message.content || 'ბოდიში, ვერ გავიგე';
   }
   ```

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

Now it will use real AI with your test instructions!

---

## 💡 Tips:

**Test Different Scenarios:**
- Switch between test users to test different conversations
- Clear messages to start fresh
- Export chat to save test results

**Debug Mode:**
- Check the "Debug Mode" checkbox in settings
- Open browser console (F12)
- See detailed logs

**Share with Team:**
- Just send them the URL
- No setup needed on their end
- Works on any device!

---

## 🔍 Verify It's Working:

### Test the API:
Visit:
```
https://bebias-venera-chatbot-j56m1hsq0-giorgis-projects-cea59354.vercel.app/api/test-simulator
```

Should return:
```json
{
  "status": "Test Simulator API Active",
  "mode": "test",
  "instructionsPath": "test-bot/data/content/",
  "isolation": "Complete - No production impact"
}
```

### Test the UI:
1. Open chat URL
2. Click "Test User 1"
3. Click "👋 Greeting" button
4. Should see: "გამარჯობა ბებია! 💛 რით დაგეხმარო?"

---

## 📊 What's Being Used:

**Instructions:**
- ✅ test-bot/data/content/bot-instructions-modular.md
- ✅ test-bot/data/content/core/*
- ✅ test-bot/data/content/context/*
- ❌ NOT using production data/content/

**API Key:**
- ✅ Same OpenAI key (safe, just extra API calls)
- 💰 Minimal cost (~$2/month for testing)

**Resources:**
- ✅ Same Vercel project
- ✅ Different routes
- ✅ No shared state with production

---

## 🚨 Troubleshooting:

### Still getting 404?
Try adding a trailing slash:
```
https://bebias-venera-chatbot-j56m1hsq0-giorgis-projects-cea59354.vercel.app/test-chat/
```

### API not responding?
Check Vercel logs:
```bash
vercel logs --follow
```

Look for `[TEST SIMULATOR]` logs.

### Mock responses only?
That's normal until you add OpenAI integration (see instructions above).

---

## 🎉 Ready to Use!

**Your test chat is now live at:**
https://bebias-venera-chatbot-j56m1hsq0-giorgis-projects-cea59354.vercel.app/test-chat/

**Production bot is safe and unaffected!**

Share this URL with your team and start testing! 🚀