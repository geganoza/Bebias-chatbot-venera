import { kv } from "@vercel/kv";

// Helper function to log messages (can be imported by other routes)
export async function logMessage(
  source: string,
  level: "info" | "error" | "warn",
  message: string,
  data?: any
) {
  try {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    // Get existing logs
    const logs = await kv.get<Array<any>>(`logs:${source}`) || [];

    // Add new log
    logs.push(log);

    // Keep only last 200 logs
    if (logs.length > 200) {
      logs.splice(0, logs.length - 200);
    }

    // Store back
    await kv.set(`logs:${source}`, logs, { ex: 86400 }); // 24 hour TTL

    // Also store in 'all' logs
    const allLogs = await kv.get<Array<any>>(`logs:all`) || [];
    allLogs.push({ ...log, source });
    if (allLogs.length > 500) {
      allLogs.splice(0, allLogs.length - 500);
    }
    await kv.set(`logs:all`, allLogs, { ex: 86400 });

  } catch (error) {
    console.error("Failed to store log:", error);
  }
}
