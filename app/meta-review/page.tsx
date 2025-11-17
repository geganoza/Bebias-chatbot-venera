'use client';

import { useEffect, useState } from 'react';

type Message = {
  id: string;
  senderId: string;
  senderType: 'user' | 'bot';
  text: string;
  timestamp: string;
};

type Conversation = {
  userId: string;
  messages: Message[];
};

export default function MetaReviewPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/meta-messages');
      const data = await response.json();
      setConversations(data.conversations || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Auto-refresh every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#1877f2',
          color: 'white',
          padding: '30px',
          borderRadius: '12px',
          marginBottom: '30px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: 'bold' }}>
            VENERA - Meta Review Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
            Real-time Two-Way Messaging Display for Meta App Review
          </p>
        </div>

        {/* Instructions */}
        <div style={{
          backgroundColor: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>📋 For Meta Reviewers:</h3>
          <p style={{ margin: 0, color: '#856404', lineHeight: '1.6' }}>
            This dashboard shows <strong>real-time incoming messages</strong> from Facebook Messenger users
            and our bot's responses. Each message displays the <strong>User PSID</strong> (Page-Scoped ID)
            and timestamp. Messages auto-refresh every 3 seconds.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #1877f2',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p>Loading conversations...</p>
          </div>
        )}

        {/* No Messages */}
        {!loading && conversations.length === 0 && (
          <div style={{
            backgroundColor: 'white',
            padding: '60px 40px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>💬</div>
            <h2 style={{ color: '#666', margin: '0 0 10px 0' }}>No conversations yet</h2>
            <p style={{ color: '#999', margin: 0 }}>
              Send a message to your Facebook Page to see the conversation appear here
            </p>
          </div>
        )}

        {/* Conversations */}
        {!loading && conversations.map((conversation) => (
          <div key={conversation.userId} style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {/* Conversation Header */}
            <div style={{
              borderBottom: '2px solid #e0e0e0',
              paddingBottom: '15px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#44b700',
                  borderRadius: '50%'
                }}></div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                  Active Conversation
                </h3>
              </div>
              <div style={{
                backgroundColor: '#f0f2f5',
                padding: '10px 15px',
                borderRadius: '6px',
                marginTop: '10px',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}>
                <strong>User PSID:</strong> {conversation.userId}
              </div>
            </div>

            {/* Messages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {conversation.messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    flexDirection: message.senderType === 'bot' ? 'row' : 'row-reverse',
                    alignItems: 'flex-end',
                    gap: '10px'
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: message.senderType === 'bot' ? '#1877f2' : '#e4e6eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0
                  }}>
                    {message.senderType === 'bot' ? '🤖' : '👤'}
                  </div>

                  {/* Message Bubble */}
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{
                      backgroundColor: message.senderType === 'bot' ? '#1877f2' : '#e4e6eb',
                      color: message.senderType === 'bot' ? 'white' : 'black',
                      padding: '12px 16px',
                      borderRadius: '18px',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {message.text}
                    </div>

                    {/* Timestamp and Sender Info */}
                    <div style={{
                      fontSize: '11px',
                      color: '#65676b',
                      marginTop: '4px',
                      textAlign: message.senderType === 'bot' ? 'left' : 'right'
                    }}>
                      {message.senderType === 'bot' ? 'VENERA Bot' : `User ${message.senderId.slice(0, 8)}...`}
                      {' · '}
                      {new Date(message.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div style={{
              marginTop: '20px',
              paddingTop: '15px',
              borderTop: '1px solid #e0e0e0',
              fontSize: '12px',
              color: '#666',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Total messages: {conversation.messages.length}</span>
              <span>Last activity: {new Date(conversation.messages[conversation.messages.length - 1]?.timestamp).toLocaleString()}</span>
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          padding: '20px',
          color: '#666',
          fontSize: '14px'
        }}>
          <p style={{ margin: '0 0 10px 0' }}>
            🔄 Auto-refreshing every 3 seconds
          </p>
          <p style={{ margin: 0 }}>
            BEBIAS VENERA · Facebook Messenger Integration · Two-Way Messaging Enabled
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
