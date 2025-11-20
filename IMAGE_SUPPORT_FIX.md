# 🖼️ Image Support Fix - Facebook Messenger Bot

## Problem Summary

The bot was **NOT receiving images** from Facebook Messenger. Users would send photos, but the bot would crash with error: `"Sorry, there was an error processing your request."`

## Root Causes Identified

### 1. **Facebook Webhook Subscription Fields Missing** ⭐
- **Problem**: Only `messages` and `messaging_optins` were subscribed
- **Impact**: Facebook wasn't sending image attachment data in webhook payload
- **Solution**: Subscribe to ALL required fields in Facebook Developer Console

### 2. **OpenAI Cannot Download Facebook CDN URLs** ⭐⭐⭐
- **Problem**: OpenAI's vision API cannot access Facebook CDN URLs directly
- **Error**: `400 Error while downloading https://scontent.xx.fbcdn.net/...`
- **Reason**: Facebook CDN URLs require authentication/cookies and expire quickly
- **Solution**: Download images server-side and convert to base64 before sending to OpenAI

### 3. **Expired URLs in Conversation History** ⭐⭐
- **Problem**: Old Facebook CDN URLs were stored in conversation history
- **Impact**: On subsequent messages, expired URLs were sent to OpenAI causing failures
- **Solution**: Sanitize conversation history to remove expired Facebook URLs

## Complete Solution

### Step 1: Subscribe to All Facebook Webhook Fields

**Location**: Facebook Developer Console → Messenger → Settings → Webhooks

**Required Fields**:
- ✅ `messages` (CRITICAL - receives message content + attachments)
- ✅ `messaging_postbacks` (for button clicks)
- ✅ `messaging_optins`
- ✅ `message_deliveries`
- ✅ `message_reads`
- ✅ `message_echoes` (optional but recommended)

**Why this matters**:
- When you subscribe to only SOME fields, Meta sometimes silently breaks attachment delivery
- You must subscribe to ALL fields together, not one at a time
- This is a known Meta API bug/quirk

### Step 2: Convert Facebook Images to Base64

**File**: `app/api/messenger/route.ts`

**Added Function**:
```typescript
async function facebookImageToBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log(`📥 Downloading Facebook image: ${imageUrl.substring(0, 100)}...`);

    // Download image from Facebook CDN
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`❌ Failed to download image: ${response.status} ${response.statusText}`);
      return null;
    }

    // Convert to Buffer and then base64
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Detect image type from URL
    let mimeType = 'image/jpeg';
    if (imageUrl.includes('.png')) mimeType = 'image/png';
    else if (imageUrl.includes('.gif')) mimeType = 'image/gif';
    else if (imageUrl.includes('.webp')) mimeType = 'image/webp';

    // Create data URL
    const dataUrl = `data:${mimeType};base64,${base64}`;
    console.log(`✅ Converted image to base64 (${(base64.length / 1024).toFixed(2)} KB)`);

    return dataUrl;
  } catch (error) {
    console.error(`❌ Error converting Facebook image to base64:`, error);
    return null;
  }
}
```

**Usage in Message Handler**:
```typescript
if (messageAttachments) {
  for (const attachment of messageAttachments) {
    if (attachment.type === "image") {
      console.log(`🖼️ Identified image attachment: ${attachment.payload.url}`);

      // Convert Facebook image URL to base64 for OpenAI compatibility
      const base64Image = await facebookImageToBase64(attachment.payload.url);

      if (base64Image) {
        contentParts.push({ type: "image_url", image_url: { url: base64Image } });
        console.log(`✅ Image converted to base64 and added to message`);
      } else {
        console.warn(`⚠️ Failed to convert image, skipping attachment`);
        if (!messageText) {
          contentParts.push({ type: "text", text: "[User sent an image]" });
        }
      }
    }
  }
}
```

### Step 3: Sanitize Conversation History

**File**: `app/api/messenger/route.ts`

**Added Function**:
```typescript
function sanitizeConversationHistory(history: Message[]): Message[] {
  return history.map(msg => {
    if (typeof msg.content === 'string') {
      return msg; // Text-only message, no changes needed
    }

    // Check if content is array with image_url parts
    if (Array.isArray(msg.content)) {
      const sanitizedParts = msg.content.map(part => {
        if (part.type === 'image_url' && part.image_url?.url) {
          // Check if it's a Facebook CDN URL (not base64)
          if (part.image_url.url.includes('scontent.xx.fbcdn.net') ||
              part.image_url.url.includes('fbcdn.net')) {
            console.log(`🧹 Removing expired Facebook CDN URL from history`);
            // Replace with text placeholder
            return { type: 'text' as const, text: '[Image was sent]' };
          }
        }
        return part;
      });

      // If all parts were removed, return text message
      if (sanitizedParts.length === 0) {
        return { ...msg, content: '[Image was sent]' };
      }

      return { ...msg, content: sanitizedParts };
    }

    return msg;
  });
}
```

**Usage Before Sending to OpenAI**:
```typescript
// Sanitize conversation history to remove expired Facebook CDN URLs
const sanitizedHistory = sanitizeConversationHistory(conversationData.history);

// Get AI response with sanitized history
const response = await getAIResponse(userContent, sanitizedHistory, ...);
```

### Step 4: Added Runtime Configuration

**File**: `app/api/messenger/route.ts` (top of file)

```typescript
// Force dynamic rendering to ensure console.log statements appear in production
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Force Node.js runtime (not Edge)
export const maxDuration = 60; // Maximum duration for this function
```

**Why**:
- Ensures the route is always dynamically rendered
- Uses Node.js runtime (required for Buffer operations)
- Allows up to 60 seconds for image processing

## Testing & Verification

### Clear Stuck Conversation History

If users have old Facebook URLs in their conversation history, clear it:

```bash
node scripts/clear-test-user-history.js --clear
```

This script:
- Finds all conversations with image URLs in history
- Clears the history (keeps user info)
- Allows users to send fresh images without errors

### Check Error Logs

To see what errors are happening in production:

```bash
node scripts/check-errors.js
```

Error logs are stored in Vercel KV with key pattern: `error:openai:*`

### Monitor Logs in Production

```bash
vercel logs <deployment-url> --follow
```

Look for these log messages:
- ✅ `📥 Downloading Facebook image:...`
- ✅ `✅ Converted image to base64 (...KB)`
- ✅ `✅ Image converted to base64 and added to message`
- ✅ `🧹 Removing expired Facebook CDN URL from history`

## Web Research Findings

### Key Stack Overflow / GitHub Issues Referenced

1. **Webhook subscriptions breaking attachments**:
   - When subscribing to specific fields via API, it can unsubscribe other fields
   - Solution: Subscribe to all fields together: `?subscribed_fields=messages,messaging_postbacks,message_deliveries,message_reads`

2. **~20% of messages with images have no attachment field**:
   - This is a known intermittent Meta API bug
   - Our solution handles this gracefully with fallback to text placeholder

3. **OpenAI cannot download external URLs with authentication**:
   - Facebook CDN URLs require cookies/authentication
   - OpenAI's API cannot bypass this
   - Solution: Server-side download → base64 conversion

4. **Console.log not appearing in Vercel production**:
   - Next.js can statically optimize routes and drop console.log statements
   - Solution: `export const dynamic = 'force-dynamic'`

## Files Modified

1. ✅ `app/api/messenger/route.ts` - Main webhook handler
   - Added `facebookImageToBase64()` function
   - Added `sanitizeConversationHistory()` function
   - Modified message attachment handling
   - Added runtime configuration exports

2. ✅ `scripts/clear-test-user-history.js` - Utility script (NEW)
   - Clears conversation history for users with images

3. ✅ `scripts/check-errors.js` - Debug utility (existing, used for diagnosis)

## Deployment

```bash
# Deploy to production
vercel --prod

# The fix includes:
# 1. Base64 image conversion
# 2. History sanitization
# 3. Runtime configuration
```

## Success Metrics

After deployment:
- ✅ Bot receives image attachments from Facebook
- ✅ Images are converted to base64 (check logs)
- ✅ OpenAI vision API processes images successfully
- ✅ Bot responds intelligently about image content
- ✅ No more `400 Error while downloading` errors
- ✅ Subsequent messages don't crash due to expired URLs

## Known Limitations

1. **Image size**: Very large images (>20MB) may timeout during conversion
   - Vercel serverless function timeout: 60 seconds
   - Most messenger images are <5MB, so this is rarely an issue

2. **GIF attachments**: Facebook API sometimes doesn't send GIF attachments
   - This is a known Meta limitation, not our bug

3. **Rate limits**: OpenAI has token-per-minute limits
   - Base64 images consume more tokens than URLs
   - Monitor your OpenAI usage if many users send images

## Future Improvements (Optional)

1. **Image compression**: Compress large images before base64 conversion to reduce token usage
2. **Vercel Blob Storage**: Upload images to Vercel Blob and send URLs instead of base64
3. **Image caching**: Cache processed images in KV store for repeated sends
4. **Better error messages**: Tell user specifically when image is too large or invalid

---

## 🎉 WORKING AS OF: November 20, 2025

**Deployment**: `bebias-venera-chatbot-89w422wom-giorgis-projects-cea59354.vercel.app`

**Verified by**: Real test with production users sending images successfully! 🚀
