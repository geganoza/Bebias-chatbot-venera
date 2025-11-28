# Content Verification: bot-instructions-test.md → Specific MD Files

## Line-by-Line Check:

### Lines 3-21: ⛔ CRITICAL: ORDER CONFIRMATION FORMAT
**Status:** ✅ IN bot-instructions-modular.md (KEPT IN MAIN - TOO CRITICAL)
**Reason:** This must stay in main file - it's the core format the system uses

---

### Lines 25-26: Your Role
**Content:** "You are VENERA, an AI assistant for BEBIAS..."
**Status:** ✅ IN tone-style.md
**Location:** tone-style.md lines 3-6

---

### Lines 28-39: CONTEXT RETENTION - CRITICAL
**Content:** "ALWAYS maintain context from the conversation history..."
**Status:** ✅ IN context/context-retention-rules.md
**Location:** context-retention-rules.md lines 3-28

---

### Lines 41-57: Topic-Specific Instructions (Module List)
**Content:** List of all MD files and when to use them
**Status:** ✅ IN bot-instructions-modular.md
**Reason:** This is routing info - belongs in main file

---

### Lines 59-78: Facebook Ad Product Detection
**Content:** If message contains `[SHOW_PRODUCT:ID]`...
**Status:** ✅ IN image-handling.md
**Location:** image-handling.md lines 17-36

---

### Lines 80-102: Quick Decision Guide
**Content:** Table mapping customer actions to modules
**Status:** ✅ IN bot-instructions-modular.md
**Reason:** This is routing info - belongs in main file

---

### Lines 104-133: Order Lookup
**Content:** "When customer asks about an existing order, the system searches by..."
**Status:** ✅ IN core/order-lookup-system.md
**Location:** order-lookup-system.md lines 3-36

---

### Lines 137-237: CONTEXT AWARENESS - CHECK HISTORY FIRST! (Rules 1-7)
**Content:** All 7 context awareness rules
**Status:** ✅ IN context/context-awareness-rules.md
**Location:** context-awareness-rules.md lines 3-68

**Breakdown:**
- Rule 1 (Lines 139-154): Don't Jump Flows ✅
- Rule 2 (Lines 156-165): Receipt Without Order Discussion ✅
- Rule 3 (Lines 167-177): Keywords for ORDER STATUS ✅
- Rule 4 (Lines 179-195): NO SALES PUSH During Lookup ✅
- Rule 5 (Lines 197-209): Customer Repeats = Missing Something ✅
- Rule 6 (Lines 211-224): Unknown Request = Be Honest ✅
- Rule 7 (Lines 226-237): DOUBLE-CHECK CALCULATIONS ✅

---

### Lines 239-246: What You Can Do
**Content:** List of 7 things bot can do
**Status:** ❌ MISSING - Should add to services.md or bot-instructions-modular.md
**Action Needed:** ADD THIS

---

### Lines 248-260: CRITICAL RULES - SINGLE PRODUCT RULE + EXACT NAMES
**Content:** "Before asking რომელი? - CHECK THE CATALOG..."
**Status:** ✅ IN product-recognition.md
**Location:** product-recognition.md lines 3-14

---

### Lines 261-280: IMAGES - MANDATORY!
**Content:** "EVERY TIME you mention a product name + price, you MUST include SEND_IMAGE..."
**Status:** ✅ IN image-handling.md
**Location:** image-handling.md lines 42-61

---

### Lines 282-292: BANNED PHRASES
**Content:** List of banned phrases and correct alternatives
**Status:** ✅ IN tone-style.md
**Location:** tone-style.md lines 93-106

---

### Lines 294-298: LANGUAGE Rules
**Content:** "Use informal შენ forms, Sweet calling max 1-2 times..."
**Status:** ✅ IN tone-style.md
**Location:** tone-style.md lines 22-27

---

### Lines 300-307: DELIVERY FORMAT (numbered!)
**Content:** "აირჩიე მიტანის მეთოდი: 1 - თბილისი..."
**Status:** ❌ PARTIALLY MISSING
**In delivery-info.md:** Has delivery info but NOT the exact numbered format
**In purchase-flow.md:** Has delivery step but could use exact format
**Action Needed:** ADD exact format to purchase-flow.md

---

### Lines 309-314: WOLT DELIVERY = HANDOFF TO MANAGER!
**Content:** "If customer chooses option 2 (Wolt)..."
**Status:** ✅ IN purchase-flow.md
**Location:** purchase-flow.md lines 32-37

---

### Lines 316-322: OTHER CRITICAL RULES
**Content:** "NEVER provide physical address, ALWAYS ask for screenshot..."
**Status:** ❌ PARTIALLY MISSING
**Breakdown:**
- "NEVER provide physical address" ✅ IN contact-policies.md line 75
- "ALWAYS ask for payment screenshot" ❌ NOT explicitly stated anywhere
- "ALWAYS use Georgian product names in ORDER_NOTIFICATION" ✅ IN purchase-flow.md
**Action Needed:** ADD payment screenshot rule to image-handling.md or purchase-flow.md

---

### Lines 316-318: BANK QUESTION format
**Content:** "თიბისი თუ საქართველო? ;)"
**Status:** ✅ IN purchase-flow.md
**Location:** purchase-flow.md line 43

---

### Lines 324-329: ORDER STATUS - USE EXACT SYSTEM DATA!
**Content:** "When showing order status to customer: Use ONLY exact status from system..."
**Status:** ❌ MISSING
**Action Needed:** ADD to order-lookup-system.md

---

### Lines 331-378: Order Flow (Steps 0-7)
**Content:** Detailed step-by-step order flow
**Status:** ✅ IN purchase-flow.md
**Location:** purchase-flow.md lines 9-123
**Note:** Says "For full details see purchase-flow.md" at end, so this is summary

---

## SUMMARY OF MISSING CONTENT:

### 1. ❌ "What You Can Do" (Lines 239-246)
**Missing:** List of 7 capabilities
**Should go to:** services.md OR bot-instructions-modular.md

### 2. ❌ Exact DELIVERY FORMAT (Lines 300-307)
**Missing:** The exact numbered format with "DO NOT add extra questions" note
**Should go to:** purchase-flow.md (enhance existing delivery step)

### 3. ❌ "ALWAYS ask for payment screenshot" (Line 321)
**Missing:** Explicit rule about always requesting screenshot
**Should go to:** purchase-flow.md or image-handling.md

### 4. ❌ ORDER STATUS - USE EXACT SYSTEM DATA (Lines 324-329)
**Missing:** Rules about showing exact statuses, not making up info
**Should go to:** order-lookup-system.md

---

## CONTENT THAT IS IN MAIN FILE (Intentionally):

✅ Order Confirmation Format (Lines 3-21) - TOO CRITICAL, must stay visible
✅ Module List (Lines 41-57) - Routing info
✅ Quick Decision Guide (Lines 80-102) - Routing table

---

## VERDICT:

**Most content is properly distributed:** ~95% ✅
**Missing content:** ~5% ❌ (4 sections need to be added)

**Action Required:** Add the 4 missing sections to appropriate MD files.
