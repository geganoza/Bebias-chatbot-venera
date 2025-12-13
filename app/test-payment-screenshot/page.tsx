"use client";

import { useState, useRef } from "react";

export default function TestPaymentScreenshot() {
  const [amount, setAmount] = useState("57.99");
  const [bank, setBank] = useState<"tbc" | "bog">("tbc");
  const [recipient, setRecipient] = useState("BEBIAS");
  const [showScreenshot, setShowScreenshot] = useState(false);
  const screenshotRef = useRef<HTMLDivElement>(null);

  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString("ka-GE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = currentDate.toLocaleTimeString("ka-GE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const transactionId = `TRX${Date.now().toString().slice(-8)}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-4">Test Payment Screenshot Generator</h1>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (GEL)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Bank</label>
            <div className="flex gap-2">
              <button
                onClick={() => setBank("tbc")}
                className={`flex-1 py-2 rounded ${bank === "tbc" ? "bg-blue-600" : "bg-gray-700"}`}
              >
                TBC
              </button>
              <button
                onClick={() => setBank("bog")}
                className={`flex-1 py-2 rounded ${bank === "bog" ? "bg-orange-600" : "bg-gray-700"}`}
              >
                BOG
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Recipient</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2"
            />
          </div>

          <button
            onClick={() => setShowScreenshot(true)}
            className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-bold"
          >
            Generate Screenshot
          </button>
        </div>

        {/* Screenshot Preview */}
        {showScreenshot && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              Right-click and save, or take a screenshot of this:
            </p>

            {/* Mobile Frame */}
            <div
              ref={screenshotRef}
              className="mx-auto"
              style={{ width: "375px" }}
            >
              {bank === "tbc" ? (
                // TBC Bank Style
                <div className="bg-white text-black rounded-3xl overflow-hidden shadow-xl">
                  {/* Status bar */}
                  <div className="bg-[#00A3E0] px-4 py-2 flex justify-between items-center text-white text-xs">
                    <span>{timeStr}</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>

                  {/* Header */}
                  <div className="bg-[#00A3E0] px-4 pb-6 pt-2">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-white text-2xl">←</span>
                      <span className="text-white text-lg font-medium">გადარიცხვა</span>
                    </div>
                  </div>

                  {/* Success Card */}
                  <div className="px-4 -mt-4">
                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                      {/* Success Icon */}
                      <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <span className="text-white text-4xl">✓</span>
                      </div>

                      <h2 className="text-xl font-bold text-gray-800 mb-1">
                        წარმატებით შესრულდა
                      </h2>
                      <p className="text-gray-500 text-sm mb-6">
                        თანხა გადარიცხულია
                      </p>

                      {/* Amount */}
                      <div className="text-4xl font-bold text-[#00A3E0] mb-6">
                        {amount} ₾
                      </div>

                      {/* Details */}
                      <div className="text-left space-y-3 border-t pt-4">
                        <div className="flex justify-between">
                          <span className="text-gray-500">მიმღები</span>
                          <span className="font-medium">{recipient}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">თარიღი</span>
                          <span className="font-medium">{dateStr}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">დრო</span>
                          <span className="font-medium">{timeStr}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">ტრანზაქცია</span>
                          <span className="font-medium text-xs">{transactionId}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom padding */}
                  <div className="h-8"></div>
                </div>
              ) : (
                // BOG Bank Style
                <div className="bg-white text-black rounded-3xl overflow-hidden shadow-xl">
                  {/* Status bar */}
                  <div className="bg-[#F26522] px-4 py-2 flex justify-between items-center text-white text-xs">
                    <span>{timeStr}</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>

                  {/* Header */}
                  <div className="bg-[#F26522] px-4 pb-6 pt-2">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-white text-2xl">←</span>
                      <span className="text-white text-lg font-medium">გადახდა</span>
                    </div>
                  </div>

                  {/* Success Card */}
                  <div className="px-4 -mt-4">
                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                      {/* Success Icon */}
                      <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <span className="text-white text-4xl">✓</span>
                      </div>

                      <h2 className="text-xl font-bold text-gray-800 mb-1">
                        ოპერაცია წარმატებულია
                      </h2>
                      <p className="text-gray-500 text-sm mb-6">
                        გადარიცხვა შესრულდა
                      </p>

                      {/* Amount */}
                      <div className="text-4xl font-bold text-[#F26522] mb-6">
                        {amount} ₾
                      </div>

                      {/* Details */}
                      <div className="text-left space-y-3 border-t pt-4">
                        <div className="flex justify-between">
                          <span className="text-gray-500">მიმღები</span>
                          <span className="font-medium">{recipient}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">თარიღი</span>
                          <span className="font-medium">{dateStr}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">დრო</span>
                          <span className="font-medium">{timeStr}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">ID</span>
                          <span className="font-medium text-xs">{transactionId}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom padding */}
                  <div className="h-8"></div>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              This is for testing purposes only
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
