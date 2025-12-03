# Image Sending Fix - Complete Solution

## Problem
Bot was not sending product photos even though:
1. Image sending code was implemented in process-batch-redis/route.ts
2. SEND_IMAGE instruction existed in image-handling.md
3. Bot was processing everything else correctly

## Root Cause
The AI model didn't know about SEND_IMAGE commands because:
- `bot-instructions.md` referenced `image-handling.md` for image commands
- BUT `image-handling.md` was NOT being loaded into the system prompt
- So the AI never saw the SEND_IMAGE instruction

## Solution Applied (Commit 14f4032)

### 1. Modified `lib/bot-core.ts` to load image-handling.md:
```typescript
// BEFORE: Only loaded 5 files
const [instructions, services, faqs, delivery, payment] = await Promise.all([
  loadContentFile(instructionFile, baseDir),
  loadContentFile("services.md", baseDir),
  loadContentFile("faqs.md", baseDir),
  loadContentFile("delivery-info.md", baseDir),
  loadContentFile("payment-info.md", baseDir),
]);

// AFTER: Now loads 6 files including image-handling.md
const [instructions, services, faqs, delivery, payment, imageHandling] = await Promise.all([
  loadContentFile(instructionFile, baseDir),
  loadContentFile("services.md", baseDir),
  loadContentFile("faqs.md", baseDir),
  loadContentFile("delivery-info.md", baseDir),
  loadContentFile("payment-info.md", baseDir),
  loadContentFile("image-handling.md", baseDir),  // CRITICAL: Instructions for SEND_IMAGE command
]);
```

### 2. Added imageHandling to the system prompt:
```typescript
const systemPrompt = isKa
  ? `${content.instructions}

# Image Handling Instructions
${content.imageHandling}  // <-- ADDED THIS SECTION

# Our Services
${content.services}
...
```

## How Image Sending Works

### 1. AI generates SEND_IMAGE commands:
When the AI mentions a product, it includes:
```
SEND_IMAGE: 9016
```

### 2. Batch processor parses commands:
```typescript
const imageRegex = /SEND_IMAGE:\s*(.+?)(?:\n|$)/gi;
const productIds = imageMatches.map(match => match[1].trim());
```

### 3. Images sent via Facebook API:
```typescript
await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
  method: 'POST',
  body: JSON.stringify({
    recipient: { id: senderId },
    message: {
      attachment: {
        type: 'image',
        payload: {
          url: product.image,
          is_reusable: true
        }
      }
    }
  })
});
```

## Testing
After deployment, test by:
1. Asking bot about a specific product (e.g., "შავი ქუდი")
2. Bot should respond with text AND send the product image
3. Check logs for "SEND_IMAGE" commands and "Sent image for" messages

## Important Files
- `/data/content/image-handling.md` - Contains SEND_IMAGE instructions
- `/lib/bot-core.ts` - Loads and includes image-handling in system prompt
- `/app/api/process-batch-redis/route.ts` - Processes SEND_IMAGE commands (lines 307-363)

## Status
✅ Fixed and deployed to production
- Commit: 14f4032
- Deployed: December 3, 2024