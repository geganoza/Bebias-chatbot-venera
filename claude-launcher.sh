#!/bin/bash

# Claude AI Launcher with Runbook Context - Standalone Script
# Can be run directly from terminal: ./claude-launcher.sh

# Set project directory
PROJECT_DIR="/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"
cd "$PROJECT_DIR" || exit 1

# Set runbook path
RUNBOOK_FILE="${PROJECT_DIR}/AI_DEVELOPMENT_RUNBOOK.md"

# Verify runbook exists
if [ ! -f "$RUNBOOK_FILE" ]; then
    echo "Error: Runbook not found at: ${RUNBOOK_FILE}"
    exit 1
fi

# Create temp file for the prompt
TEMP_PROMPT="/tmp/claude_runbook_$$_$(date +%s).md"

echo "Creating prompt file with runbook context..."

# Write the prompt header
cat > "$TEMP_PROMPT" << 'HEADER'
I'm starting a new work session on the BEBIAS CHATBOT VENERA project. Please load and review the following runbook to ensure you have the latest context:

---RUNBOOK START---
HEADER

# Append the runbook
cat "$RUNBOOK_FILE" >> "$TEMP_PROMPT"

# Write the prompt footer
cat >> "$TEMP_PROMPT" << 'FOOTER'

---RUNBOOK END---

Please confirm you've loaded the runbook and are ready to assist with the BEBIAS CHATBOT VENERA project. Summarize the key points you understand about:
1. The batching system and its critical importance
2. Current project status
3. Any critical issues or priorities

After confirmation, I'll begin working on specific tasks.
FOOTER

# Check if file was created successfully
if [ ! -s "$TEMP_PROMPT" ]; then
    echo "Error: Failed to create prompt file"
    exit 1
fi

echo "✅ Runbook loaded successfully!"
echo ""
echo "Prompt file created at: $TEMP_PROMPT"
echo "Opening in TextEdit for easy copying..."
echo ""

# Open the file in TextEdit
open -e "$TEMP_PROMPT"

# Check for claude command
if command -v claude &> /dev/null; then
    echo "Claude CLI detected. Starting Claude..."
    echo ""
    echo "Instructions:"
    echo "1. Copy the content from TextEdit"
    echo "2. Paste into Claude when ready"
    echo ""
    claude
else
    echo "Claude CLI not found."
    echo ""
    echo "Instructions:"
    echo "1. Copy all text from the TextEdit window"
    echo "2. Open https://claude.ai in your browser"
    echo "3. Paste the prompt to start with full context"
    echo ""
    echo "To install Claude CLI for next time:"
    echo "npm install -g @anthropic-ai/claude-cli"
fi

echo ""
echo "The prompt file will be automatically deleted in 5 minutes."

# Schedule cleanup (5 minutes)
( sleep 300 && rm -f "$TEMP_PROMPT" 2>/dev/null && echo "Temp file cleaned up." ) &

# Keep the terminal open
read -p "Press Enter to close this window..."