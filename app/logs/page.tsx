"use client";

import { useEffect, useState } from "react";
import { toGeorgiaTime } from "@/lib/timeUtils";

type Log = {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  data?: any;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [source, setSource] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/logs?source=${source}&limit=100`);
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [source]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchLogs, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, source]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-100 text-red-800";
      case "warn":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">System Logs</h1>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto-refresh (3s)</span>
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2"
            >
              <option value="all">All Sources</option>
              <option value="chat">Chat API</option>
              <option value="messenger">Messenger</option>
              <option value="webhook">Webhook</option>
              <option value="bank">Bank</option>
            </select>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="divide-y divide-gray-200 max-h-[800px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No logs available
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(
                          log.level
                        )}`}
                      >
                        {log.level.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-gray-500">
                          {toGeorgiaTime(log.timestamp)}
                        </span>
                        {log.source && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {log.source}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 font-mono text-sm">
                        {log.message}
                      </p>
                      {log.data && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
                            Show data
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {logs.length} most recent logs
        </div>
      </div>
    </div>
  );
}
