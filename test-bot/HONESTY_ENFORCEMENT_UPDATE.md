# 🤖 Bot Honesty & Anti-Fabrication Update

## Problem Identified

**Incident:** Bot fabricated order status when no order existed
- Customer phone: 577273090
- Reality: NO ORDER FOUND in system
- Bot response: "შენი შეკვეთა 📋 მზადდება და მალე გაიგზავნება!" ❌

**Root cause:** Bot saw status emojis (📋 მზადდება) in instructions as examples and hallucinated them as real responses.

---

## Solution: Multiple Layers of Honesty Enforcement

### 1. ✅ bot-instructions-modular.md

**Added to ALWAYS section:**
```markdown
- 🤖 **BE HONEST when you don't know** - Customers trust honesty more than fake answers!
```

**Added to NEVER section:**
```markdown
- 🚨 **NEVER MAKE UP INFORMATION** - If you don't know, say so and offer manager help
- 🚨 **NEVER invent order status** - If system says "NO ORDER FOUND", be HONEST: "ვერ ვიპოვე შეკვეთა"
- 🚨 **NEVER say "შეკვეთა მზადდება"** or use status emojis (📋🚚🚗✅) when NO order exists
- 🚨 **NEVER pretend to know something you don't** - Admitting "I don't know" builds trust!
```

**Added NEW section: "When You Don't Know or Are Uncertain"**
```markdown
## 🤖 When You Don't Know or Are Uncertain

**If you're unsure, confused, or don't have information:**

**DO THIS ✅:**
```
ბოდიში, ამ კითხვაზე ზუსტად ვერ გიპასუხებ 🤖
მენეჯერი მალე დაგიკავშირდება და დაგეხმარება 💛
დამიტოვე ტელეფონის ნომერი?
```

**Example situations requiring honesty:**
- System returns no data → Admit it: "ვერ ვიპოვე ინფორმაცია"
- Complex technical question → "ამაზე მენეჯერი უკეთ გიპასუხებს"
- Unusual request → "ამ თემაზე ჯერ არ ვსწავლობ, მენეჯერს გადავცემ"
- Customer seems confused → "ბოდიში თუ ვერ გაგიგე, მენეჯერი დაგიკავშირდება"

**Remember:** Being honest about limitations = Good! Making up answers = Very Bad!
```

---

### 2. ✅ core/order-lookup-system.md

**Added NEW section: "If Order NOT Found - CRITICAL BEHAVIOR"**

```markdown
## 🚨 If Order NOT Found - CRITICAL BEHAVIOR

**⚠️ NEVER MAKE UP ORDER INFORMATION!**

If system returns NO order found, you MUST:
1. Be HONEST: "ვერ ვიპოვე შეკვეთა ამ ინფორმაციით" (Can't find order with this info)
2. Ask for different identifier: "შეამოწმე თუ სწორი ნომერია? ან მომეცი შეკვეთის ნომერი"
3. Offer manager help: "ან თუ გინდა, მენეჯერი დაგეხმარება - დამიტოვე ტელეფონი 💛"

**🛑 ABSOLUTELY FORBIDDEN:**
- ❌ NEVER say "შეკვეთა მზადდება" when NO order found
- ❌ NEVER say "მალე გაიგზავნება" when NO order found
- ❌ NEVER invent order status from thin air
- ❌ NEVER use status emojis (📋🚚🚗✅) if NO order exists

**Examples of WRONG behavior:**
- Customer: 577273090
- System: NO ORDER FOUND
- Bot: ❌ "შენი შეკვეთა 📋 მზადდება და მალე გაიგზავნება!" ← THIS IS A LIE!

**Correct behavior:**
- Customer: 577273090
- System: NO ORDER FOUND
- Bot: ✅ "ვერ ვიპოვე შეკვეთა ამ ნომერზე. შეამოწმე ნომერი ან მომეცი შეკვეთის ნომერი 📞"
```

---

### 3. ✅ context/context-awareness-rules.md

**Enhanced Rule 6: Unknown Request = Be Honest, Involve Manager**

Added:
- 🚨 **CRITICAL: Honesty is better than making things up!**
- Template responses for "I don't know" situations
- Clear list of when to use honesty responses

```markdown
**Template responses when you don't know:**

**Simple version:**
```
ბოდიში, ამ კითხვაზე ზუსტად ვერ გიპასუხებ 🤖
მენეჯერი მალე დაგიკავშირდება და დაგეხმარება 💛
დამიტოვე ტელეფონის ნომერი?
```

**Detailed version:**
```
მე AI ბოტი ვარ და ჯერ კიდევ ვსწავლობ 🤖
ამ კითხვაზე ვერ დაგეხმარები, მაგრამ მენეჯერი მალე დაგიკავშირდება!
თუ გინდა, დამიტოვე ტელეფონის ნომერი და მოკლედ აღწერე რა გჭირდება 💛
```

**When to use this:**
- System returns NO DATA (orders, products, etc.)
- Customer asks something not in your instructions
- You're confused about what they want
- Complex or unusual request
- Customer repeats themselves (you probably misunderstood)
```

---

### 4. ✅ tone-style.md

**Clarified the "ვერ ვიცანი" ban:**

Changed from absolute ban to conditional:
- ❌ Don't say "ვერ ვიცანი" to avoid helping
- ✅ DO say "ვერ ვიცანი" when genuinely lacking information

Added:
```markdown
**🚨 EXCEPTION - When "ვერ ვიცანი" IS ALLOWED:**
When you genuinely DON'T have information (system returns no data, unusual request, etc.):
- ✅ "ბოდიში, ამ კითხვაზე ზუსტად ვერ გიპასუხებ"
- ✅ "ამაზე მენეჯერი უკეთ გიპასუხებს"
- ✅ "ვერ ვიპოვე ინფორმაცია"

**Being honest about limitations builds customer trust!**
```

---

## Key Philosophy Change

**BEFORE:**
- "Never say you can't help" → Led to fabrication
- "Always try to help" → Led to making things up

**AFTER:**
- "Be honest when you don't know" → Builds trust
- "Offer manager help instead of guessing" → Better customer experience
- "Admitting limitations is GOOD" → Prevents lies

---

## Expected Behavior Changes

### Before This Update:
❌ No order found → Bot invents status "შეკვეთა მზადდება"
❌ Unusual question → Bot makes up answer
❌ No data available → Bot pretends to know

### After This Update:
✅ No order found → Bot admits: "ვერ ვიპოვე შეკვეთა"
✅ Unusual question → Bot says: "მენეჯერი უკეთ გიპასუხებს"
✅ No data available → Bot offers: "დამიტოვე ტელეფონი, მენეჯერი დაგიკავშირდება"

---

## Files Modified

1. `test-bot/data/content/bot-instructions-modular.md`
   - Added honesty to ALWAYS rules
   - Added anti-fabrication to NEVER rules
   - Added new section "When You Don't Know or Are Uncertain"

2. `test-bot/data/content/core/order-lookup-system.md`
   - Added section "If Order NOT Found - CRITICAL BEHAVIOR"
   - Shows exact WRONG vs CORRECT examples

3. `test-bot/data/content/context/context-awareness-rules.md`
   - Enhanced Rule 6 with template responses
   - Added when-to-use list

4. `test-bot/data/content/tone-style.md`
   - Clarified "ვერ ვიცანი" exception
   - Added "Being honest builds trust" message

---

## Testing Recommendations

After deployment, test these scenarios:

1. **Non-existent order lookup:**
   - Input: Phone number with no order
   - Expected: "ვერ ვიპოვე შეკვეთა" + offer to check different identifier

2. **Unusual request:**
   - Input: Something outside bot's knowledge
   - Expected: Honest admission + manager handoff offer

3. **System error/no data:**
   - Input: Query that returns no results
   - Expected: "ვერ ვიპოვე ინფორმაცია" instead of fabrication

---

**Date:** 2025-11-28
**Status:** Ready for deployment
**Priority:** HIGH - Prevents customer misinformation
