# ARCHIVED: Bank API Payment Verification System

**Status:** ARCHIVED - On hold for future use
**Date Archived:** 2025-01-20
**Reason:** Currently using screenshot-based verification only

---

## Overview

This is an automatic bank API verification system that checks BOG (Bank of Georgia) and TBC transactions via Cloud Function integration. It was designed to automatically verify payments without requiring screenshots.

## How It Worked

### Trigger Conditions

1. **User mentions payment keywords:**
   - Georgian: გადავიხადე, გადმოვრიცხე, გავაგზავნე, ჩავრიცხე, გადავრიცხე
   - English: paid, sent, transferred

2. **User provides details after bot sent bank account:**
   - Bot sent bank account (GE09TB or GE31BG) in previous message
   - User provides phone number (9 digits) + name

### Verification Flow

1. **Extract Payment Details:**
   - Expected amount (from conversation history or user message)
   - Sender name (Georgian or Latin characters)

2. **Call Cloud Function (Async):**
   - URL: `https://us-central1-bebias-wp-db-handler.cloudfunctions.net/verifyPayment`
   - Sends: `{ expectedAmount, name, isKa, senderId, delayMs: 10000 }`
   - Delay: 10 seconds before checking bank API

3. **Immediate Response:**
   - User gets instant acknowledgment message
   - System checks bank in background
   - Follow-up message sent after verification (10-20 seconds)

## Code Location

**Original Location:** `/app/api/messenger/route.ts` (Lines 899-996)

### Full Function Code

```typescript
/**
 * Handle automatic payment verification when user provides payment details
 */
async function handlePaymentVerification(userMessage: string, history: Message[], senderId: string): Promise<string | null> {
  const isKa = detectGeorgian(userMessage);

  // Check if bot just provided bank account in previous message
  const lastBotMsg = [...history].reverse().find((m) => m.role === "assistant");
  const lastBotText = typeof lastBotMsg?.content === 'string' ? lastBotMsg.content : '';
  const botProvidedBankAccount = lastBotText.includes('GE09TB') || lastBotText.includes('GE31BG');

  // Keywords indicating payment was made
  const paymentKeywords = isKa
    ? ['გადავიხადე', 'გადმოვრიცხე', 'გავაგზავნე', 'ჩავრიცხე', 'გადავრიცხე']
    : ['paid', 'sent', 'transferred'];
  const mentionsPayment = paymentKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

  // If user just sent name + phone + address after bank account was provided, treat as payment confirmation
  const hasPhoneNumber = /\d{9}/.test(userMessage); // Georgian phone numbers
  const hasName = /[ა-ჰ]{2,}/.test(userMessage) || /[a-z]{2,}/i.test(userMessage);

  const likelyPaymentConfirmation = botProvidedBankAccount && hasPhoneNumber && hasName;

  if (!mentionsPayment && !likelyPaymentConfirmation) {
    return null;
  }

  // Extract expected amount - first try user's message, then conversation history
  let expectedAmount: number | null = null;

  // Priority 1: Check if user included amount in their message (e.g., "ჩავრიცხე 55 ლარი")
  const userAmountMatch = userMessage.match(/(\d{1,5}(\.\d{1,2})?)\s*ლარ/);
  if (userAmountMatch) {
    expectedAmount = parseFloat(userAmountMatch[1]);
  }

  // Priority 2: Look in conversation history
  if (!expectedAmount) {
    for (let i = history.length - 1; i >= 0 && i >= history.length - 5; i--) {
      const msg = history[i];
      if (msg.role === 'assistant') {
        const msgText = typeof msg.content === 'string' ? msg.content : '';
        // Look for "ჯამში X ლარი" (total)
        let amountMatch = msgText.match(/ჯამში\s+(\d{1,5}(\.\d{1,2})?)\s*ლარ/);

        // Look for "ჩარიცხოთ X ლარი" (transfer X GEL)
        if (!amountMatch) {
          amountMatch = msgText.match(/ჩარიცხოთ\s+(\d{1,5}(\.\d{1,2})?)\s*ლარ/);
        }

        // Amount right before bank account number
        if (!amountMatch) {
          amountMatch = msgText.match(/(\d{1,5}(\.\d{1,2})?)\s*ლარ[ი\s]*\s*(?:საქართველოს ბანკის|თიბისის|ანგარიშზე|GE\d)/);
        }

        if (amountMatch) {
          expectedAmount = parseFloat(amountMatch[1]);
          break;
        }
      }
    }
  }

  // Extract name from user message (Georgian or Latin)
  let name: string | null = null;
  const georgianNameMatch = userMessage.match(/([ა-ჰ]+\s+[ა-ჰ]+)/);
  const latinNameMatch = userMessage.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
  name = georgianNameMatch?.[1] || latinNameMatch?.[1] || null;

  if (!expectedAmount || !name) {
    console.log(`⚠️ Payment verification skipped - missing amount (${expectedAmount}) or name (${name})`);
    return null;
  }

  console.log(`🏦 Starting async payment verification: ${expectedAmount} GEL from "${name}"`);

  // ASYNC: Call Cloud Function for verification (doesn't block)
  // This allows us to respond immediately to the user
  const cloudFunctionUrl = process.env.CLOUD_FUNCTION_URL || 'https://us-central1-bebias-wp-db-handler.cloudfunctions.net/verifyPayment';

  fetch(cloudFunctionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expectedAmount,
      name,
      isKa,
      senderId,
      delayMs: 10000
    })
  }).catch(err => {
    console.error('❌ Cloud Function call failed:', err);
  });

  // Return immediate acknowledgment - user gets instant feedback
  const immediateReply = isKa
    ? `მადლობა! ❤️\n\nთქვენი გადახდა ${expectedAmount} ლარი "${name}"-ის სახელზე მიიღება.\n\n⏳ ვამოწმებთ გადახდას ბანკში... (10-20 წამი)\n\nგადახდის დადასტურების შემდეგ მიიღებთ შეტყობინებას შეკვეთის დეტალებით.`
    : `Thank you! ❤️\n\nYour payment of ${expectedAmount} GEL from "${name}" is being processed.\n\n⏳ Verifying with bank... (10-20 seconds)\n\nYou'll receive confirmation once payment is verified.`;

  return immediateReply;
}
```

### Where It Was Called (REMOVED)

**Original Location:** Line ~2004-2008 in `/app/api/messenger/route.ts`

**Original Integration Code:**
```typescript
const paymentVerificationResult = await handlePaymentVerification(userTextForProcessing, conversationData.history, senderId);
if (paymentVerificationResult) {
  console.log(`💳 Payment verification triggered`);
  conversationData.history.push({ role: "assistant", content: paymentVerificationResult });
  await saveConversation(conversationData);
  await sendMessage(senderId, paymentVerificationResult);
  continue; // Skip normal AI response
}
```

## Cloud Function Details

**Function Name:** `verifyPayment`
**Project:** `bebias-wp-db-handler`
**Region:** `us-central1`

### Request Payload

```typescript
{
  expectedAmount: number,    // Amount to verify (e.g., 55)
  name: string,              // Sender name (Georgian or Latin)
  isKa: boolean,             // Is Georgian language
  senderId: string,          // Facebook sender ID
  delayMs: number            // Delay before checking bank (10000 = 10 seconds)
}
```

### Response Flow

1. Cloud Function waits 10 seconds (gives time for bank to process)
2. Queries BOG/TBC API for recent transactions
3. Finds matching transaction (amount ±1 GEL, sender name match)
4. If valid: Logs order, sends email, sends confirmation message to user
5. If invalid: Sends error message asking for screenshot

## Environment Variables

```bash
CLOUD_FUNCTION_URL=https://us-central1-bebias-wp-db-handler.cloudfunctions.net/verifyPayment
```

## Why It Was Archived

**User Decision:** "bank verification on hold for now"

**Reasons:**
1. Screenshot-based verification is more reliable and deterministic
2. Bank API has delays and potential inconsistencies
3. Requires Cloud Function infrastructure
4. Text-based triggers ("გადავიხადე") were causing false positives
5. Screenshot verification provides visual proof

## How to Restore

To restore this system:

1. **Uncomment the function in route.ts:**
   - Function is still present at lines 899-996 (currently unused)
   - Or copy code from this document

2. **Add back the integration point:**
   - After line 2003 in route.ts (after screenshot verification)
   - Add the integration code shown above

3. **Verify environment variables:**
   - Ensure `CLOUD_FUNCTION_URL` is set in Vercel
   - Ensure Cloud Function is deployed and active

4. **Update bot instructions:**
   - Add text-based payment keywords back to instructions
   - Explain the 10-20 second verification wait

5. **Test with real bank transaction:**
   - Send message: "გადავიხადე 55 ლარი გიორგი ნოზაძე"
   - Should trigger immediate acknowledgment
   - Should receive follow-up after 10-20 seconds

## Integration Priority

When both systems are active:

1. **Priority 1:** Screenshot verification (lines 1987-2000)
2. **Priority 2:** Bank API verification (lines 2004-2008)
3. **Priority 3:** Normal AI response

Screenshot verification should ALWAYS run first, as it's more reliable.

## Cloud Function Source Code Location

**Repository:** (User should specify)
**File:** `/cloud-functions/verifyPayment/index.js`

## Related Files

- `/app/api/messenger/route.ts` - Main implementation
- `/cloud-functions/verifyPayment/` - Cloud Function code
- `/docs/ARCHIVED_BANK_VERIFICATION.md` - This document

## Bank API Endpoints

**BOG (Bank of Georgia):**
- API endpoint: (User should specify)
- Authentication: (User should specify)

**TBC Bank:**
- API endpoint: (User should specify)
- Authentication: (User should specify)

---

**Date Created:** 2025-01-20
**Last Modified:** 2025-01-20
**Archived By:** Claude Code
**Status:** Ready to restore when needed
