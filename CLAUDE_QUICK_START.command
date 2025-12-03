#!/bin/bash

# BEBIAS CHATBOT - Quick Claude Launcher with Auto-Copy
# Double-click to launch Claude with context copied to clipboard

clear
echo "╔════════════════════════════════════════════════╗"
echo "║     BEBIAS CHATBOT - CLAUDE QUICK LAUNCHER    ║"
echo "╔════════════════════════════════════════════════╝"
echo ""

# Set project directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# Generate context with current status
echo "📊 Gathering current project status..."

# Get current git status
GIT_STATUS=$(git status --short 2>/dev/null || echo "Git not available")
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log -1 --oneline 2>/dev/null || echo "No commits")

# Check if batching is enabled
BATCHING_STATUS="Unknown"
if grep -q 'ENABLE_REDIS_BATCHING=true' .env.local 2>/dev/null; then
    BATCHING_STATUS="✅ Enabled (local)"
fi

# Create the initial message for Claude
CLAUDE_MESSAGE="I need help with the BEBIAS CHATBOT VENERA project.

CRITICAL: Please IMMEDIATELY read the AI_DEVELOPMENT_RUNBOOK.md file in the project folder. This contains all critical warnings, especially about BATCHING which is the #1 priority (user spent 2 weeks fixing it).

Project Path: $PROJECT_DIR
Current Branch: $CURRENT_BRANCH
Last Commit: $LAST_COMMIT

Current Status:
$GIT_STATUS

Batching Status: $BATCHING_STATUS

IMPORTANT RULES:
1. NEVER break batching (increases costs 1000%)
2. Always test before deploying
3. Ask permission before major changes
4. Update AI_DEVELOPMENT_RUNBOOK.md after fixes

Please start by:
1. Reading AI_DEVELOPMENT_RUNBOOK.md
2. Checking if batching is working properly
3. Asking me what needs to be done today

The project is a Facebook Messenger bot for BEBIAS (Georgian clothing brand) that handles orders, payments, and customer service."

# Copy to clipboard
echo "$CLAUDE_MESSAGE" | pbcopy

echo "✅ Context copied to clipboard!"
echo ""
echo "📋 The following has been copied to your clipboard:"
echo "------------------------------------------------"
echo "$CLAUDE_MESSAGE" | head -15
echo "..."
echo "------------------------------------------------"
echo ""

# Open Claude
echo "🌐 Opening Claude.ai..."
open "https://claude.ai"

# Also open the runbook
echo "📖 Opening AI Development Runbook..."
open "$PROJECT_DIR/AI_DEVELOPMENT_RUNBOOK.md"

echo ""
echo "✨ NEXT STEPS:"
echo "1. Claude.ai is opening in your browser"
echo "2. Start a new conversation"
echo "3. PASTE (Cmd+V) the context that's already copied"
echo "4. Make sure Claude reads the runbook first!"
echo ""
echo "⚠️  REMEMBER: Batching is CRITICAL - test everything!"
echo ""
echo "Press Enter to close..."
read