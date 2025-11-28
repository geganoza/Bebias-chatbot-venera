# Test Bot - Employee Editing Guide

## 🎯 Purpose
This test bot lets you safely edit and improve bot instructions without affecting real customers. You can experiment, make changes, and test - completely risk-free!

## ✅ What You Can Safely Edit

All files in `test-bot/data/content/` are safe to edit:

### Most Common Edits:

#### 1. **Order Flow** → `core/order-flow-steps.md`
Want to change how the bot handles purchases? Edit this file.

Example changes:
- Modify delivery option wording
- Change the order of steps
- Add new payment methods

#### 2. **Tone & Language** → `bot-instructions-modular.md` (top section)
Want to adjust how the bot talks? Edit the "Critical Tone Rules" section.

Example changes:
- Add new banned phrases
- Modify sweet calling frequency
- Update greeting style

#### 3. **Context Rules** → `context/context-awareness-rules.md`
Want to improve how bot understands customer intent?

Example changes:
- Add new keywords for order status
- Improve context retention rules
- Add new examples

#### 4. **Order Lookup** → `core/order-lookup-system.md`
Want to change how customers check their orders?

Example changes:
- Update search parameters
- Modify status response format
- Add new order status keywords

## 📝 How to Make Changes

### Step 1: Find the Right File
Use the table below to find which file to edit:

| Want to Change | Edit This File |
|----------------|---------------|
| How bot talks (tone, language) | `bot-instructions-modular.md` |
| Purchase process | `core/order-flow-steps.md` |
| Order checking | `core/order-lookup-system.md` |
| Context understanding | `context/context-awareness-rules.md` |
| Critical rules | `core/critical-rules.md` |
| Detailed tone examples | `tone-style.md` |
| Image handling | `image-handling.md` |
| Product descriptions | `product-recognition.md` |

### Step 2: Edit the File
1. Open the file in any text editor
2. Make your changes
3. Save the file

**That's it!** Your changes are ready to test.

### Step 3: Test Your Changes
Once the test webhook is activated (boss will do this):
1. Send a message as a test user
2. Bot uses your new instructions
3. See if it works as expected
4. If not, edit again and retry!

## 💡 Best Practices

### DO:
- ✅ Read the existing content before editing
- ✅ Keep the same format (markdown structure)
- ✅ Test after every change
- ✅ Ask questions if unsure
- ✅ Make small changes at a time
- ✅ Keep notes on what you changed

### DON'T:
- ❌ Delete entire sections without understanding them
- ❌ Remove emoji markers (like 👤📞📍📦💰) from order format
- ❌ Change critical rules without discussing
- ❌ Edit files outside `test-bot/data/content/` folder

## 🔍 Example Edit: Adding a New Banned Phrase

Let's say customers are confused when the bot says "მოიცა ერთი წუთი"...

**File:** `bot-instructions-modular.md`

**Find this section:**
```markdown
### Most Critical Banned Phrases:
- ❌ "მინდა გკითხო" → ✅ Just ask directly
- ❌ "ვერ ვიცანი" → ✅ Always help
```

**Add your rule:**
```markdown
### Most Critical Banned Phrases:
- ❌ "მინდა გკითხო" → ✅ Just ask directly
- ❌ "ვერ ვიცანი" → ✅ Always help
- ❌ "მოიცა ერთი წუთი" → ✅ Use "მოიცა ბებია, სათვალე გავიკეთო... 👓"
```

**Save and test!**

## 🚫 Critical Files - Ask Before Editing

These files contain critical logic - discuss before major changes:
- `core/order-confirmation-format.md` - Order system depends on this
- Main `bot-instructions-modular.md` top section - Core functionality

Minor edits are fine, but for major changes, discuss with the team first.

## 🆘 Help & Support

### If Something Breaks:
1. Don't panic - test users are isolated!
2. Revert your last change
3. Test again
4. If still broken, ask for help

### If Unsure About Edit:
1. Make the edit in a comment first: `<!-- NEW: your text here -->`
2. Ask boss or teammate to review
3. Finalize after approval

### Where to Ask Questions:
- Team chat
- Weekly bot improvement meeting
- Direct message to bot manager

## 📊 Testing Checklist

After making changes, test these scenarios:

- [ ] Greeting - does bot respond warmly?
- [ ] Product inquiry - shows correct products?
- [ ] Order flow - walks through all steps?
- [ ] Order lookup - finds existing orders?
- [ ] Image handling - receives and sends images?
- [ ] Payment processing - asks for all details?
- [ ] Context - remembers previous messages?

## 🎓 Learning Resources

### Understanding Markdown
- `**bold text**` makes **bold text**
- `- item` makes bullet points
- `## Heading` makes headings

### Georgian Language Notes
- Use informal შენ (not formal თქვენ)
- Max 1-2 sweet callings per conversation
- No Russian words ever!

### Bot Behavior
- Bot processes instructions top to bottom
- More specific rules override general ones
- Examples help bot understand better

---

**Remember:** Changes here are 100% safe. Test users only. Production customers never affected. Experiment freely! 🚀