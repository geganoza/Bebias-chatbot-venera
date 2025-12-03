#!/bin/bash

# BEBIAS CHATBOT VENERA - Claude Assistant Launcher
# Double-click this file to open Claude with full project context

echo "================================================"
echo "    BEBIAS CHATBOT VENERA - CLAUDE ASSISTANT   "
echo "================================================"
echo ""
echo "Loading project context for Claude..."
echo ""

# Set the project directory (script's location)
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# Create a comprehensive context file for Claude
CONTEXT_FILE="$PROJECT_DIR/CLAUDE_CONTEXT.md"

# Generate the context file with all critical information
cat > "$CONTEXT_FILE" << 'EOF'
# CLAUDE ASSISTANT - BEBIAS CHATBOT CONTEXT

**Project**: BEBIAS CHATBOT VENERA
**Type**: Facebook Messenger E-commerce Bot (Georgian clothing brand)
**Location**: /Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2
**Repository**: https://github.com/geganoza/Bebias-chatbot-venera

---

## ⛔ CRITICAL: READ AI_DEVELOPMENT_RUNBOOK.md FIRST!

The most important file in this project is:
**`AI_DEVELOPMENT_RUNBOOK.md`**

This file contains:
- All critical warnings (especially about BATCHING)
- Complete system architecture
- Chronological fix log
- Known issues and solutions
- Emergency procedures

---

## 🔴 #1 PRIORITY: NEVER BREAK BATCHING

**BATCHING IS THE MOST CRITICAL FEATURE**
- User spent 2 WEEKS fixing it
- Breaking it = 1000% cost increase
- Breaking it = bot stops working
- Breaking it = EXTREME user anger

Rules:
1. NEVER process messages in webhook
2. NEVER skip 3-second QStash delay
3. ALWAYS test batching after ANY change

---

## 📁 Critical Files to Review

1. **AI_DEVELOPMENT_RUNBOOK.md** - Complete guide (READ FIRST!)
2. **CRITICAL_FIXES_DECEMBER_2024.md** - Recent fixes
3. **/app/api/messenger/route.ts** - Webhook (DO NOT modify processing)
4. **/app/api/process-batch-redis/route.ts** - Batch processor
5. **/lib/bot-core.ts** - System prompt and AI integration
6. **/data/content/*** - All bot instructions

---

## 🛠 Recent Fixes (December 2024)

1. **Batching Error** - Environment variable had hidden newline
2. **Image Sending** - image-handling.md wasn't loaded in prompt
3. **Order Flow** - [ORDER_NUMBER] replacement issues

---

## 💻 Common Commands

```bash
# Check logs
vercel logs bebias-venera-chatbot.vercel.app --since 5m

# Deploy to production
git add -A
git commit -m "fix: [description]"
git push
vercel --prod

# Test batching
node scripts/test-batching.js

# Environment variables (NEVER use Vercel UI)
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production
```

---

## 🚨 What Angers the User

1. Breaking batching ("spent two weeks fixing this")
2. Making changes without permission
3. Not understanding simple things
4. Being slow to fix issues
5. Not testing before deploying

---

## 📋 Your First Actions

1. Read **AI_DEVELOPMENT_RUNBOOK.md** completely
2. Check current git status: `git status`
3. Review recent commits: `git log --oneline -10`
4. Verify batching works: Test with multiple quick messages
5. Ask user what needs to be done today

---

**Remember**: When in doubt, ASK FIRST. Breaking things causes extreme frustration.
EOF

echo "✅ Context file generated"
echo ""
echo "Opening Claude with project context..."
echo ""
echo "================================================"
echo "    IMPORTANT INSTRUCTIONS FOR CLAUDE:         "
echo "================================================"
echo ""
echo "1. First, read AI_DEVELOPMENT_RUNBOOK.md"
echo "2. NEVER break batching (user spent 2 weeks fixing it)"
echo "3. Test everything before deploying"
echo "4. Ask permission before major changes"
echo "5. Update the runbook after making fixes"
echo ""
echo "Project location: $PROJECT_DIR"
echo ""

# Try to open Claude in browser
if command -v open &> /dev/null; then
    echo "Opening Claude.ai in your browser..."
    open "https://claude.ai"

    # Also open the context file so user can copy it
    echo "Opening context file for you to copy to Claude..."
    open "$CONTEXT_FILE"

    # Open the runbook too
    echo "Opening the AI Development Runbook..."
    open "$PROJECT_DIR/AI_DEVELOPMENT_RUNBOOK.md"
else
    echo "Please open https://claude.ai in your browser"
    echo "Then copy the contents of CLAUDE_CONTEXT.md to start the conversation"
fi

echo ""
echo "================================================"
echo "         CLAUDE ASSISTANT READY TO HELP        "
echo "================================================"
echo ""
echo "Copy the contents of CLAUDE_CONTEXT.md to Claude to begin."
echo "Make sure Claude reads AI_DEVELOPMENT_RUNBOOK.md first!"
echo ""
echo "Press any key to close this window..."
read -n 1