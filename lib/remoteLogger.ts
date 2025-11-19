// Remote logger - sends logs to local dev server in real-time
// Only active when REMOTE_LOG_URL is set

const REMOTE_LOG_URL = process.env.REMOTE_LOG_URL;

interface LogData {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}

export async function remoteLog(level: LogData['level'], message: string, data?: any) {
  // Always log locally
  const emoji = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    success: '✅'
  }[level];

  console.log(`${emoji} ${message}`, data || '');

  // Send to remote logger if configured
  if (REMOTE_LOG_URL) {
    try {
      await fetch(REMOTE_LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, data, timestamp: new Date().toISOString() }),
      }).catch(() => {}); // Silently fail if remote logger is down
    } catch (error) {
      // Don't log remote logging errors to avoid recursion
    }
  }
}

// Convenience functions
export const logInfo = (message: string, data?: any) => remoteLog('info', message, data);
export const logWarn = (message: string, data?: any) => remoteLog('warn', message, data);
export const logError = (message: string, data?: any) => remoteLog('error', message, data);
export const logSuccess = (message: string, data?: any) => remoteLog('success', message, data);
