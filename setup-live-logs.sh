#!/bin/bash

echo "🔧 Setting up live logging..."
echo ""

# Start local log server
echo "Starting local log server on port 3001..."
node log-server.js &
LOG_SERVER_PID=$!
echo "✅ Log server started (PID: $LOG_SERVER_PID)"
echo ""

# Install ngrok if not installed
if ! command -v ngrok &> /dev/null; then
    echo "⚠️  ngrok not found. Please install it:"
    echo "   brew install ngrok  # macOS"
    echo "   or download from https://ngrok.com/download"
    exit 1
fi

# Start ngrok tunnel
echo "Starting ngrok tunnel..."
ngrok http 3001 > /dev/null &
NGROK_PID=$!
sleep 3

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL"
    kill $LOG_SERVER_PID $NGROK_PID
    exit 1
fi

echo "✅ Ngrok tunnel: $NGROK_URL"
echo ""

# Set REMOTE_LOG_URL in Vercel
echo "Setting REMOTE_LOG_URL in Vercel..."
echo "$NGROK_URL/log" | vercel env add REMOTE_LOG_URL production

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Deploy to Vercel: vercel --prod"
echo "   2. Watch logs: tail -f live-logs.txt"
echo "   3. Test the chatbot"
echo ""
echo "🛑 To stop:"
echo "   kill $LOG_SERVER_PID $NGROK_PID"
echo ""
