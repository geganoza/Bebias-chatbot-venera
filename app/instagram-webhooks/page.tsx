'use client';

import { useEffect, useState } from 'react';

type Webhook = {
  id: string;
  type: string;
  data: any;
  status: 'received' | 'processing' | 'completed' | 'error';
  timestamp: string;
};

export default function InstagramWebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch('/api/instagram-webhooks?limit=100');
      const data = await response.json();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearWebhooks = async () => {
    if (!confirm('Clear all webhook logs?')) return;
    try {
      await fetch('/api/instagram-webhooks', { method: 'DELETE' });
      setWebhooks([]);
    } catch (error) {
      console.error('Failed to clear webhooks:', error);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchWebhooks, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return { bg: '#dbeafe', text: '#1d4ed8', icon: '📥' };
      case 'processing': return { bg: '#fef3c7', text: '#d97706', icon: '⚙️' };
      case 'completed': return { bg: '#dcfce7', text: '#16a34a', icon: '✅' };
      case 'error': return { bg: '#fee2e2', text: '#dc2626', icon: '❌' };
      default: return { bg: '#f3f4f6', text: '#6b7280', icon: '📋' };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'webhook_received': return '📨';
      case 'message_event': return '💬';
      case 'message_processed': return '🤖';
      case 'error': return '❌';
      default: return '📋';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)',
        padding: '24px 40px',
        boxShadow: '0 4px 20px rgba(124, 58, 237, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>📸</span>
              Instagram Webhook Monitor
            </h1>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
              Real-time Instagram DM webhook events - For App Review Demonstration
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '14px' }}>Auto-refresh (2s)</span>
            </label>
            <button
              onClick={fetchWebhooks}
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              Refresh
            </button>
            <button
              onClick={clearWebhooks}
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '8px',
                color: '#fca5a5',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              Clear Logs
            </button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        backgroundColor: '#1e293b',
        padding: '16px 40px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        gap: '32px',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: autoRefresh ? '#22c55e' : '#6b7280',
            animation: autoRefresh ? 'pulse 2s infinite' : 'none'
          }} />
          <span style={{ fontSize: '14px', color: '#94a3b8' }}>
            {autoRefresh ? 'Listening for webhooks...' : 'Paused'}
          </span>
        </div>
        <div style={{ fontSize: '14px', color: '#94a3b8' }}>
          Total events: <strong style={{ color: 'white' }}>{webhooks.length}</strong>
        </div>
        <div style={{ fontSize: '14px', color: '#94a3b8' }}>
          Webhook URL: <code style={{ color: '#a78bfa', backgroundColor: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
            /api/instagram
          </code>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '24px 40px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <p>Loading webhook events...</p>
          </div>
        ) : webhooks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            backgroundColor: '#1e293b',
            borderRadius: '16px',
            border: '2px dashed #334155'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📭</div>
            <h2 style={{ margin: '0 0 12px 0', color: '#e2e8f0' }}>No Webhook Events Yet</h2>
            <p style={{ color: '#94a3b8', margin: 0 }}>
              Click "Test" in Meta Developer Dashboard under Instagram Webhook settings
            </p>
            <p style={{ color: '#64748b', margin: '8px 0 0 0', fontSize: '14px' }}>
              Events will appear here in real-time
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {webhooks.map((webhook) => {
              const statusStyle = getStatusColor(webhook.status);
              return (
                <div
                  key={webhook.id}
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #334155',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>{getTypeIcon(webhook.type)}</span>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '16px', color: '#f1f5f9' }}>
                          {webhook.type.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                          {formatTime(webhook.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.text,
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {statusStyle.icon} {webhook.status.toUpperCase()}
                    </div>
                  </div>

                  {/* Message Preview */}
                  {webhook.data?.messageText && (
                    <div style={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '12px',
                      borderLeft: '4px solid #7c3aed'
                    }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                        Message from {webhook.data.senderId || 'unknown'}:
                      </div>
                      <div style={{ color: '#e2e8f0', fontSize: '15px' }}>
                        "{webhook.data.messageText}"
                      </div>
                    </div>
                  )}

                  {/* Raw Data Toggle */}
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{
                      cursor: 'pointer',
                      color: '#7c3aed',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      View Raw Data
                    </summary>
                    <pre style={{
                      marginTop: '8px',
                      backgroundColor: '#0f172a',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      overflow: 'auto',
                      maxHeight: '200px',
                      color: '#94a3b8'
                    }}>
                      {JSON.stringify(webhook.data, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '20px 40px',
        borderTop: '1px solid #334155',
        backgroundColor: '#1e293b',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '13px'
      }}>
        Instagram Webhook Monitor - VENERA Chatbot | For Meta App Review Demonstration
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
