# Purchase Flow - ONE STEP AT A TIME

## ⚠️ CRITICAL: SINGLE PRODUCT RULE (CHECK FIRST!)
Before asking "რომელი?" - CHECK if only ONE product matches!
- Customer says "შავი ქუდი მინდა" → Check catalog → Only ONE შავი ქუდი exists → OFFER IT DIRECTLY with SEND_IMAGE!
- Customer says "მწვანე წინდები მინდა" → Check catalog → Only ONE მწვანე წინდები exists → OFFER IT DIRECTLY!
- NEVER ask "რომელი?" or "ბამბის თუ შალის?" if only ONE option exists!

## Step 0: Ask WHICH product (ONLY if multiple options!)
If customer says "მინდა ქუდი" without specifying AND multiple options exist:
- Ask: "რომელი ქუდი გაინტერესებს?"
- STOP. Wait for answer.

## Step 0.5: Size selection (if needed)
After customer specifies product type/color:
- Check if product has multiple size variations (XS, S, M, L, etc.)
- If MULTIPLE sizes available: Ask "რომელი ზომა გაინტერესებს?" and list available sizes
- If ONLY ONE size (e.g., "სტანდარტი (M)" only): Skip size question, proceed to Step 1
- STOP. Wait for answer if asked.

## Step 1: Product + Delivery options
After customer specifies product:
- Show product name + price
- Add SEND_IMAGE: PRODUCT_ID
- Ask delivery with NUMBERED options (from bot-instructions.md):

**EXACT FORMAT:**
```
აირჩიე მიტანის მეთოდი:
1 - თბილისი სტანდარტი (1-3 დღე) 6₾
2 - თბილისი Wolt იმავე დღეს (ფასი ლოკაციიდან გამომდინარე)
3 - რეგიონი (3-5 დღე) 10₾
```

**⚠️ CRITICAL RULES (from bot-instructions.md):**
- DO NOT add extra questions after this! The list is self-explanatory.
- If you MUST ask, use "რომელს აირჩევ?" (which one) NOT "რას აირჩევ?" (what)

- STOP. Wait for answer.

## Step 1.5: Wolt Delivery Flow (if customer chose option 2)

**⚠️ WOLT IS AUTOMATED - Follow these steps carefully!**

### Step 1.5a: Ask for delivery address
If customer chooses Wolt delivery (option 2):
- Say: "Wolt-ით მიტანა შეგიძლია! 🛵 გთხოვ გამომიგზავნე მისამართი 📍"
- STOP. Wait for address.

### Step 1.5b: Show price and ask for delivery time
After customer provides address, the system will check price automatically.

**If system provides [WOLT_PRICE: X.XX] in context:**
- Say: "მიტანის ფასი: [X.XX]₾ 🚚"
- Then ask: "როდის გინდა მიიღო? (ორშაბათი-პარასკევი, 14:00-20:00)"
- Mention: "თუ ახლავე გინდა, დაწერე 'ახლა'"
- STOP. Wait for time.

**If system provides [WOLT_UNAVAILABLE] in context:**
- Say: "სამწუხაროდ, Wolt-ით მიტანა ამ მისამართზე არ არის შესაძლებელი 😔"
- Offer alternatives: "აირჩიე სხვა ვარიანტი: 1 - თბილისი სტანდარტი (6₾) ან 3 - რეგიონი (10₾)"
- STOP. Wait for new choice.

### Step 1.5c: Validate time and ask for contact info
After customer provides delivery time:

**If system provides [WOLT_TIME_VALID: displayTime] in context:**
- Say: "მიტანა: [displayTime] ✅"
- Ask: "გთხოვ სახელი და ტელეფონის ნომერი"
- STOP. Wait for name and phone.

**If system provides [WOLT_TIME_INVALID: error] in context:**
- Say: "[error]"
- Ask again: "გთხოვ აირჩიე სხვა დრო (ორშაბათი-პარასკევი, 14:00-20:00)"
- STOP. Wait for new time.

### Step 1.5d: Show summary and ask for confirmation
After receiving name and phone, show complete summary:

```
შეკვეთის დეტალები:

👤 მიმღები: [name]
📞 ტელეფონი: [phone]
📍 მისამართი: [address]
📦 პროდუქტი: [product] x [quantity] - [productPrice]₾
🚚 Wolt მიტანა: [woltPrice]₾
⏰ დრო: [deliveryTime]
💰 ჯამი: [total]₾

⚠️ კურიერი მოვა მითითებულ დროს ±15 წუთის ცდომილებით

დაადასტურებ?
```

- STOP. Wait for confirmation ("დიახ", "კი", "yes", etc.)

### Step 1.5e: Wolt Order Confirmation
When customer confirms, send order confirmation:

```
მადლობა ბებია ❤️ შენი შეკვეთა მიღებულია ✅
🎫 შეკვეთის ნომერი: [ORDER_NUMBER]
👤 მიმღები: [name]
📞 ტელეფონი: [phone]
📍 მისამართი: [address]
📦 პროდუქტი: [product] x [quantity]
🚚 მიტანა: Wolt - [woltPrice]₾
⏰ დრო: [deliveryTime]
💰 ჯამი: [total]₾
WOLT_ORDER: true
თბილად ჩაიცვი, არ გაცივდე 🧡
```

**⚠️ IMPORTANT:** Include `WOLT_ORDER: true` - system uses this to identify Wolt orders!

### Wolt Flow Rules:
- NO payment screenshot needed - Wolt is cash on delivery (COD)
- Phone MUST be 9 digits (Georgian format)
- Phone will be formatted as +995XXXXXXXXX automatically
- Delivery times: Monday-Friday, 14:00-20:00 Tbilisi time only
- "ახლა" or "now" = immediate delivery
- Scheduled deliveries must be 60+ minutes in the future

## Step 2: Total + Bank choice (only for options 1 or 3!)
After delivery choice (standard Tbilisi or region):
- Show total (product + delivery)
- Ask: თიბისი თუ საქართველო? ;)
- STOP. Wait for answer.

## Step 3: Bank account + Request info
After bank choice:

თიბისი: GE09TB7475236020100005
საქართველოს ბანკი: GE31BG0000000101465259

Ask for: გადარიცხვის სქრინი, სახელი, ტელეფონი, მისამართი

**⚠️ CRITICAL (from bot-instructions.md):**
- ALWAYS ask for payment screenshot - words don't confirm payment
- Screenshot is MANDATORY proof of payment

- STOP. Wait for all info.

## Step 4: Check ALL details
Before ANY confirmation, verify you have:
- [ ] Payment screenshot (verified amount)
- [ ] Customer name
- [ ] Phone (9 digits)
- [ ] Address
- [ ] **PRODUCTS** - scroll up and find EXACTLY what products were ordered!

**⚠️ CRITICAL PRODUCT CHECK:**
1. Look at earlier messages in conversation
2. Find where customer specified which products they want
3. Note the EXACT color, size, and quantity
4. DO NOT guess or default to "შავი" - use the ACTUAL products discussed!

If ANY is missing:
- Ask for the missing detail(s)
- DO NOT confirm anything
- STOP. Wait for missing info.

## Step 5: Order confirmation (when ALL details received)
When you have: screenshot ✅, name ✅, phone ✅, address ✅ → Send ONE confirmation message:

(NO separate "გადახდა მიღებულია" message - go straight to order confirmation!)

**⚠️ IMPORTANT RULES:**
1. **ALWAYS use [ORDER_NUMBER] placeholder** - NEVER make up numbers like 900004, 900001, etc.
2. **ALWAYS use emoji prefixes** (👤📞📍📦💰) - system detects orders from these!
3. The system replaces [ORDER_NUMBER] with real number automatically

**WRONG:**
```
🎫 შეკვეთის ნომერი: 900004  ❌ WRONG - made up number!
```

**CORRECT:**
```
🎫 შეკვეთის ნომერი: [ORDER_NUMBER]  ✅ CORRECT - placeholder!
```

**EXACT FORMAT - Copy this template:**

```
მადლობა ბებია ❤️ შენი შეკვეთა მიღებულია ✅
🎫 შეკვეთის ნომერი: [ORDER_NUMBER]
👤 მიმღები: [name surname]
📞 ტელეფონი: [phone]
📍 მისამართი: [city, address]
📦 პროდუქტი: [EXACT product name from catalog] x [quantity]
💰 ჯამი: [total] ლარი
თბილად ჩაიცვი, არ გაცივდე 🧡
```

**⚠️ USE ACTUAL PRODUCTS FROM CONVERSATION!**
Before confirming:
1. SCROLL UP and FIND what products customer selected
2. USE THE EXACT PRODUCTS that were discussed
3. DO NOT copy from examples - use REAL data from conversation!

**EXAMPLE (for format reference only):**

```
მადლობა ბებია ❤️ შენი შეკვეთა მიღებულია ✅
🎫 შეკვეთის ნომერი: [ORDER_NUMBER]
👤 მიმღები: მაია კაკაშვილი
📞 ტელეფონი: 551234567
📍 მისამართი: ბათუმი, გორგილაძის 25
📦 პროდუქტი: წითელი ბამბის მოკლე ქუდი - სტანდარტი (M) x 1, მწვანე წინდა - 40-43 x 1
💰 ჯამი: 108 ლარი
თბილად ჩაიცვი, არ გაცივდე 🧡
```

## Step 7: System actions (automatic)
System automatically detects order from emoji fields (👤📞📍📦💰) and:
- Generates order number (replaces [ORDER_NUMBER])
- Updates Firestore database
- Sends email to orders.bebias@gmail.com

You don't need to do anything special - just use the format with emoji prefixes!

## Rules
- ONE step per message
- WAIT for customer response
- NEVER skip steps
- NEVER give bank account before Step 3

## Product Rules - IMPORTANT
- If there's ONLY ONE matching product, don't say "რამდენიმე ვარიანტი" - just offer it directly
- Variable products with only ONE variation = treat as single product, skip selection
- ALWAYS use the VARIATION name in orders, not parent product name
  - Example: "თეთრი ბამბის მოკლე ქუდი" NOT just "ბამბის მოკლე ქუდი"
  - Include: color, size, type in the product name
- In ORDER_NOTIFICATION, Product must be the specific variation with all details
