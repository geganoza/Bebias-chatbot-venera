# Pending Bank Account Changes

## Overview
Discussion about disabling TBC Bank temporarily while keeping BOG (Bank of Georgia) as the only active payment option.

## Current Situation
- **TBC Bank**: Cannot automatically verify payments yet (feature coming soon)
- **BOG Bank**: Has automatic payment verification working

## Proposed Changes

### 1. Disable TBC Bank (Temporarily)
- Keep TBC IBAN visible in files but mark as "temporarily unavailable"
- Bot should only offer BOG during the ordering process
- If user asks about TBC, bot should say: "ამ მომენტისთვის მხოლოდ საქართველოს ბანკის ანგარიშია ხელმისაწვდომი"

### 2. Create Separate Ordering Process Document
Instead of having the ordering process embedded in `bot-instructions.md`, create a new file:
- **New file**: `data/content/ordering-process.md`
- **Purpose**: Easier to edit ordering logic without touching other bot instructions
- **Benefits**: Clean separation of concerns, easier maintenance

### 3. Update Payment Info Document
**File**: `data/content/payment-info.md`

Proposed structure:
```markdown
# გადახდის ინფორმაცია / Payment Information

## დროებითი შეზღუდვა / Temporary Limitation
**ამ მომენტისთვის მხოლოდ საქართველოს ბანკის ანგარიშია ხელმისაწვდომი ავტომატური გადახდის დადასტურებისთვის.**

Currently, only Bank of Georgia account is available for automatic payment verification.

## საბანკო ანგარიშები / Bank Accounts

### საქართველოს ბანკი / Bank of Georgia (BOG) ✅
**IBAN:** GE31BG0000000101465259
**სტატუსი:** აქტიური | Status: Active
**ავტომატური გადახდის დადასტურება:** კი | Automatic verification: Yes

### თიბისი ბანკი / TBC Bank 🔧
**IBAN:** GE09TB7475236020100005
**სტატუსი:** დროებით გამორთულია | Status: Temporarily disabled
**ავტომატური გადახდის დადასტურება:** არა (მალე დაემატება) | Automatic verification: No (coming soon)
```

### 4. Update Bot Instructions
**File**: `data/content/bot-instructions.md`

Modify the ordering flow (Step 2 and Step 3):
- **Step 2**: Remove bank selection question, go directly to BOG
- **Step 3**: Only provide BOG IBAN
- Add instruction: If customer asks about TBC, explain it's temporarily unavailable

### 5. Update Chat Route
**File**: `app/api/chat/route.ts`

Load the new ordering-process file:
```javascript
const [instructions, services, faqs, delivery, payment, ordering] = await Promise.all([
  loadContentFile("bot-instructions.md"),
  loadContentFile("services.md"),
  loadContentFile("faqs.md"),
  loadContentFile("delivery-info.md"),
  loadContentFile("payment-info.md"),
  loadContentFile("ordering-process.md"), // NEW
]);
```

## Implementation Status
**Status**: ⚠️ Not implemented yet - Pending due to other changes in progress
**Reason**: User is making other changes separately and wants to avoid conflicts

## Bank Details Reference
- **TBC Bank IBAN**: GE09TB7475236020100005
- **BOG Bank IBAN**: GE31BG0000000101465259

## When TBC is Ready
When TBC bank integration is complete:
1. Update `payment-info.md` - Change TBC status to "Active"
2. Update `ordering-process.md` - Re-enable bank selection in Step 2
3. Update bot instructions - Remove the "temporarily unavailable" message

## Notes
- TBC information should be kept in files (not deleted) - just marked as unavailable
- This is a temporary measure until TBC automatic payment verification is implemented
- The goal is to prevent confusion for customers who might select TBC when it can't auto-verify

## Files to Modify (When Ready)
1. `data/content/payment-info.md` - Update bank status
2. `data/content/ordering-process.md` - Create new file with ordering flow
3. `data/content/bot-instructions.md` - Remove ordering flow, keep other instructions
4. `app/api/chat/route.ts` - Load ordering-process.md file

## Related Files
- `lib/bank.ts` - Bank integration logic
- `app/api/bank/verify-payment/route.ts` - Payment verification endpoint
