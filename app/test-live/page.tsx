"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: any;
}

interface ConversationResponse {
  success: boolean;
  response?: string;
  metadata?: any;
  conversationLength?: number;
  woltSessionId?: string;
  mapConfirmed?: boolean;
  error?: string;
}

// Fixed testerId so Claude Code can send messages and you see them here
const SHARED_TESTER_ID = "claude-shared-test";

export default function TestLivePage() {
  const [testerId] = useState(SHARED_TESTER_ID);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [autoStep, setAutoStep] = useState(0);
  const [attachImage, setAttachImage] = useState(false);
  const [watchMode, setWatchMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Track last update time to detect changes
  const lastUpdateRef = useRef<string>("");

  // Watch Mode - poll for messages sent by Claude Code
  useEffect(() => {
    if (!watchMode) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/test-conversation?testerId=${SHARED_TESTER_ID}`);
        const data = await response.json();

        // Check if conversation exists and has been updated
        if (data.messages && data.updatedAt !== lastUpdateRef.current) {
          lastUpdateRef.current = data.updatedAt;

          // Update the UI with all messages
          setMessages(data.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            metadata: m.metadata
          })));

          setSessionInfo({
            woltSessionId: data.woltSessionId,
            mapConfirmed: data.mapConfirmed,
            conversationLength: data.messageCount
          });
        }
      } catch (e) {
        // Ignore 404 errors (conversation not started yet)
        if (!(e instanceof Error && e.message.includes("404"))) {
          console.error("Poll error:", e);
        }
      }
    }, 500); // Poll every 500ms for faster updates

    return () => clearInterval(pollInterval);
  }, [watchMode]);

  const sendMessage = async (message: string, withImage = false) => {
    if (!message.trim()) return;

    setIsLoading(true);

    // Add user message to UI
    const displayContent = withImage ? `${message} [+ Payment Screenshot]` : message;
    const userMsg: Message = {
      role: "user",
      content: displayContent,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setAttachImage(false);

    try {
      const response = await fetch("/api/test-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          testerId,
          message,
          hasPaymentScreenshot: withImage,
        }),
      });

      const data: ConversationResponse = await response.json();

      if (data.success && data.response) {
        // Add bot response to UI
        const botMsg: Message = {
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
          metadata: data.metadata,
        };
        setMessages((prev) => [...prev, botMsg]);

        // Update session info
        setSessionInfo({
          woltSessionId: data.woltSessionId,
          mapConfirmed: data.mapConfirmed,
          conversationLength: data.conversationLength,
          metadata: data.metadata,
        });
      } else {
        // Error message
        const errorMsg: Message = {
          role: "system",
          content: `❌ Error: ${data.error || "Unknown error"}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (error) {
      const errorMsg: Message = {
        role: "system",
        content: `❌ Network Error: ${error instanceof Error ? error.message : "Unknown"}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsLoading(false);
  };

  const confirmMap = async () => {
    setIsLoading(true);

    // Add system message
    const sysMsg: Message = {
      role: "system",
      content: "🗺️ Simulating map confirmation...",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, sysMsg]);

    try {
      const response = await fetch("/api/test-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_map",
          testerId,
        }),
      });

      const data = await response.json();

      const resultMsg: Message = {
        role: "system",
        content: data.success
          ? `✅ Map confirmed! Wolt price: ${data.woltPrice}₾, ETA: ${data.woltEta} min`
          : `❌ Map confirmation failed: ${data.error}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, resultMsg]);

      setSessionInfo((prev: any) => ({
        ...prev,
        mapConfirmed: data.success,
        woltPrice: data.woltPrice,
        woltEta: data.woltEta,
      }));
    } catch (error) {
      const errorMsg: Message = {
        role: "system",
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown"}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsLoading(false);
  };

  const resetConversation = async () => {
    setIsLoading(true);

    try {
      await fetch("/api/test-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          testerId,
        }),
      });

      setMessages([]);
      setSessionInfo(null);
      setAutoStep(0);
    } catch (error) {
      console.error("Reset error:", error);
    }

    setIsLoading(false);
  };

  // Auto-test flow
  const autoTestSteps = [
    { message: "შავი ქუდი მინდა", description: "Ask for black hat" },
    { message: "2", description: "Choose Wolt delivery" },
    { message: "ვაჟა-ფშაველას 71", description: "Provide address" },
    { action: "confirm_map", description: "Confirm map location" },
    { message: "დიახ", description: "Confirm order" },
    { message: "გიორგი ნოზაძე", description: "Provide name" },
    { message: "555123456", description: "Provide phone" },
    { message: "მე-2 სადარბაზო", description: "Delivery instructions" },
    { message: "თიბისი", description: "Choose bank" },
    { message: "გადავიხადე", withImage: true, description: "Send payment screenshot" },
  ];

  const runAutoStep = async () => {
    if (autoStep >= autoTestSteps.length) {
      setAutoMode(false);
      return;
    }

    const step = autoTestSteps[autoStep];

    // Add step description
    const descMsg: Message = {
      role: "system",
      content: `📍 Step ${autoStep + 1}: ${step.description}`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, descMsg]);

    if (step.action === "confirm_map") {
      await confirmMap();
    } else if (step.message) {
      await sendMessage(step.message, step.withImage || false);
    }

    setAutoStep((prev) => prev + 1);
  };

  useEffect(() => {
    if (autoMode) {
      const timer = setTimeout(runAutoStep, 2000); // 2 second delay between steps
      return () => clearTimeout(timer);
    }
  }, [autoMode, autoStep]);

  const startAutoTest = () => {
    resetConversation().then(() => {
      setAutoMode(true);
      setAutoStep(0);
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h1 className="text-2xl font-bold mb-2">🧪 Live Conversation Test</h1>
          <p className="text-gray-400 text-sm">
            Watch Claude Code test the chatbot in real-time
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <button
              onClick={() => setWatchMode(!watchMode)}
              className={`px-4 py-2 rounded text-sm font-bold ${watchMode ? "bg-purple-600 animate-pulse" : "bg-purple-700 hover:bg-purple-600"}`}
            >
              {watchMode ? "👁️ WATCHING..." : "👁️ Watch Claude Test"}
            </button>
            <button
              onClick={startAutoTest}
              disabled={isLoading || autoMode || watchMode}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded text-sm"
            >
              {autoMode ? "🔄 Running..." : "▶️ Run Auto Test"}
            </button>
            <button
              onClick={resetConversation}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded text-sm"
            >
              🔄 Reset
            </button>
            <button
              onClick={confirmMap}
              disabled={isLoading || !sessionInfo?.woltSessionId}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded text-sm"
            >
              🗺️ Confirm Map
            </button>
          </div>
          {watchMode && (
            <div className="mt-2 text-sm text-purple-400 animate-pulse">
              👁️ Watching for messages from Claude Code... (testerId: {SHARED_TESTER_ID})
            </div>
          )}
        </div>

        {/* Session Info */}
        {sessionInfo && (
          <div className="bg-gray-800 rounded-lg p-3 mb-4 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <span className="text-gray-400">Session:</span>{" "}
                <span className="text-yellow-400 font-mono text-xs">
                  {sessionInfo.woltSessionId?.substring(0, 15) || "none"}...
                </span>
              </div>
              <div>
                <span className="text-gray-400">Map:</span>{" "}
                <span
                  className={
                    sessionInfo.mapConfirmed ? "text-green-400" : "text-red-400"
                  }
                >
                  {sessionInfo.mapConfirmed ? "✓ Confirmed" : "✗ Pending"}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Messages:</span>{" "}
                <span>{sessionInfo.conversationLength || 0}</span>
              </div>
              {sessionInfo.metadata?.mapLink && (
                <div>
                  <a
                    href={sessionInfo.metadata.mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline"
                  >
                    🗺️ View Map
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="bg-gray-800 rounded-lg p-4 h-[500px] overflow-y-auto mb-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <p>No messages yet</p>
              <p className="text-sm mt-2">
                Click "Run Auto Test" or type a message below
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-4 ${
                  msg.role === "user"
                    ? "text-right"
                    : msg.role === "system"
                      ? "text-center"
                      : "text-left"
                }`}
              >
                {msg.role === "system" ? (
                  <div className="inline-block bg-gray-700 px-3 py-1 rounded text-sm text-gray-300">
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className={`inline-block max-w-[80%] px-4 py-2 rounded-lg ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-white"
                    }`}
                  >
                    <div className="text-xs text-gray-400 mb-1">
                      {msg.role === "user" ? "👤 You" : "🤖 Bot"}
                    </div>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.metadata?.mapLink && (
                      <div className="mt-2 text-xs">
                        <a
                          href={msg.metadata.mapLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-300 underline"
                        >
                          🗺️ Map Link
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
          {isLoading && (
            <div className="text-center text-gray-400">
              <span className="animate-pulse">⏳ Processing...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <button
            onClick={() => setAttachImage(!attachImage)}
            className={`px-3 py-2 rounded-lg ${attachImage ? "bg-green-600" : "bg-gray-700 hover:bg-gray-600"}`}
            title="Attach payment screenshot"
          >
            {attachImage ? "📎✓" : "📎"}
          </button>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(inputMessage, attachImage)}
            placeholder={attachImage ? "Type message + payment screenshot..." : "Type a message in Georgian..."}
            disabled={isLoading || autoMode}
            className={`flex-1 bg-gray-800 border rounded-lg px-4 py-2 text-white placeholder-gray-500 ${attachImage ? "border-green-500" : "border-gray-700"}`}
          />
          <button
            onClick={() => sendMessage(inputMessage, attachImage)}
            disabled={isLoading || autoMode || !inputMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded-lg"
          >
            Send
          </button>
        </div>

        {/* Quick messages */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            "შავი ქუდი მინდა",
            "2",
            "ვაჟა-ფშაველას 71",
            "დიახ",
            "არა",
            "გიორგი ნოზაძე",
            "555123456",
            "თიბისი",
          ].map((msg, i) => (
            <button
              key={i}
              onClick={() => sendMessage(msg)}
              disabled={isLoading || autoMode}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 px-3 py-1 rounded text-sm"
            >
              {msg}
            </button>
          ))}
          <button
            onClick={() => {
              setAttachImage(true);
              setInputMessage("გადავიხადე");
            }}
            disabled={isLoading || autoMode}
            className="bg-green-700 hover:bg-green-600 disabled:bg-gray-800 px-3 py-1 rounded text-sm"
          >
            💳 Send Payment Screenshot
          </button>
        </div>

        {/* Tester ID */}
        <div className="mt-4 text-center text-xs text-gray-500">
          Tester ID: {testerId}
        </div>
      </div>
    </div>
  );
}
