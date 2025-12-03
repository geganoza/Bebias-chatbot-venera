# Claude Launcher for BEBIAS CHATBOT VENERA

## Overview
This macOS application automatically launches Claude with your project's runbook context, ensuring you always start with up-to-date information.

## Installation

### Option 1: Use the Mac App (Recommended)
1. The `Claude Launcher.app` is ready to use in your project folder
2. Double-click `Claude Launcher.app` to run it
3. Optional: Drag it to your Applications folder or Dock for easy access

### Option 2: Use the Shell Script
Run the launcher directly from terminal:
```bash
./claude-launcher.sh
```

## What It Does
1. **Loads the AI_DEVELOPMENT_RUNBOOK.md** - Ensures you have the latest project context
2. **Opens Claude Terminal** - Attempts to open Claude CLI if installed
3. **Creates a Startup Prompt** - Generates a comprehensive prompt with your runbook
4. **Opens TextEdit** - Shows the prompt for easy copying if Claude CLI isn't available

## Features
- ✅ Automatic runbook loading
- ✅ Project directory setup
- ✅ Temporary prompt file generation
- ✅ Multiple Claude launch methods
- ✅ Automatic cleanup after 5 minutes

## How It Works

### When Claude CLI is installed:
- Opens Terminal with Claude CLI
- Loads the runbook context automatically

### When Claude CLI is NOT installed:
- Opens Terminal with instructions
- Opens the prompt in TextEdit for copying
- Provides installation instructions for Claude CLI

## Files Created
- **Temporary Prompt**: `/tmp/claude_startup_prompt_$$.md`
  - Contains full runbook context
  - Auto-deleted after 5 minutes
  - Opens in TextEdit for easy copying

## Troubleshooting

### App Won't Open
If macOS blocks the app:
1. Right-click the app and select "Open"
2. Click "Open" in the security dialog
3. Or go to System Preferences > Security & Privacy and allow the app

### Claude CLI Not Found
Install Claude CLI with:
```bash
npm install -g @anthropic-ai/claude-cli
```

### Runbook Not Found
Ensure `AI_DEVELOPMENT_RUNBOOK.md` exists in the project directory.

## Project Integration
This launcher ensures you always start with:
1. Latest batching system understanding
2. Current project status
3. Critical priorities and issues
4. Full development context

## Quick Start Every Day
1. Double-click `Claude Launcher.app`
2. Wait for Claude to load with context
3. Start working with full project knowledge!

---
*Created for the BEBIAS CHATBOT VENERA project to streamline AI-assisted development.*