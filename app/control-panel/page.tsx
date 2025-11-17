'use client';

import { useEffect, useState } from 'react';

type Message = {
  id: string;
  senderId: string;
  senderType: 'user' | 'bot' | 'human';
  text: string;
  timestamp: string;
};

type Conversation = {
  userId: string;
  userName?: string;
  profilePic?: string;
  messages: Message[];
  manualMode?: boolean;
  botInstruction?: string | null;
};

export default function ControlPanelPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [directMessage, setDirectMessage] = useState('');
  const [botInstruction, setBotInstruction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch messages and manual mode status
  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/meta-messages');
      const data = await response.json();
      const convos = data.conversations || [];

      // Fetch manual mode status and user profile for each conversation
      for (const convo of convos) {
        try {
          // Fetch manual mode status
          const statusResponse = await fetch(`/api/manual-control?userId=${convo.userId}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            convo.manualMode = statusData.manualMode;
            convo.botInstruction = statusData.botInstruction;
          }

          // Fetch user profile
          const profileResponse = await fetch(`/api/user-profile?userId=${convo.userId}`);
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            if (profileData.profile) {
              convo.userName = profileData.profile.name;
              convo.profilePic = profileData.profile.profile_pic;
            }
          }
        } catch (err) {
          // Ignore errors for individual conversations
        }
      }

      setConversations(convos);
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

  // Control actions
  const toggleManualMode = async (userId: string, enable: boolean) => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/manual-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: enable ? 'enable_manual_mode' : 'disable_manual_mode',
          userId
        })
      });

      if (response.ok) {
        setStatusMessage(enable ? '🎮 Manual mode ENABLED' : '🤖 Auto mode RESUMED');
        setTimeout(() => setStatusMessage(''), 3000);
        fetchMessages();
      } else {
        setStatusMessage('❌ Failed to toggle manual mode');
      }
    } catch (err) {
      setStatusMessage('❌ Error: ' + err);
    }
    setActionLoading(false);
  };

  const sendDirectMessage = async () => {
    if (!selectedUserId || !directMessage.trim()) return;

    setActionLoading(true);
    try {
      const response = await fetch('/api/manual-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_direct_message',
          userId: selectedUserId,
          message: directMessage
        })
      });

      if (response.ok) {
        setStatusMessage('✅ Message sent directly');
        setDirectMessage('');
        setTimeout(() => setStatusMessage(''), 3000);
        fetchMessages();
      } else {
        setStatusMessage('❌ Failed to send message');
      }
    } catch (err) {
      setStatusMessage('❌ Error: ' + err);
    }
    setActionLoading(false);
  };

  const instructBot = async () => {
    if (!selectedUserId || !botInstruction.trim()) return;

    setActionLoading(true);
    try {
      const response = await fetch('/api/manual-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'instruct_bot',
          userId: selectedUserId,
          instruction: botInstruction
        })
      });

      if (response.ok) {
        setStatusMessage('✅ Bot instruction saved');
        setBotInstruction('');
        setTimeout(() => setStatusMessage(''), 3000);
        fetchMessages();
      } else {
        setStatusMessage('❌ Failed to save instruction');
      }
    } catch (err) {
      setStatusMessage('❌ Error: ' + err);
    }
    setActionLoading(false);
  };

  const selectedConversation = conversations.find(c => c.userId === selectedUserId);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1877f2',
        color: 'white',
        padding: '20px 40px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: 'bold' }}>
          🎮 VENERA Control Panel
        </h1>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
          Take over conversations • Instruct bot • Send direct messages
        </p>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 85px)' }}>
        {/* Left Sidebar - Conversation List */}
        <div style={{
          width: '300px',
          backgroundColor: 'white',
          borderRight: '1px solid #e0e0e0',
          overflowY: 'auto'
        }}>
          <div style={{ padding: '15px', borderBottom: '1px solid #e0e0e0' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: '#666' }}>
              ACTIVE CONVERSATIONS
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
              {conversations.length} total
            </p>
          </div>

          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              Loading...
            </div>
          )}

          {!loading && conversations.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>💬</div>
              <p style={{ fontSize: '13px', margin: 0 }}>No conversations yet</p>
            </div>
          )}

          {!loading && conversations.map((convo) => (
            <div
              key={convo.userId}
              onClick={() => setSelectedUserId(convo.userId)}
              style={{
                padding: '15px',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                backgroundColor: selectedUserId === convo.userId ? '#e3f2fd' : 'white',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (selectedUserId !== convo.userId) {
                  e.currentTarget.style.backgroundColor = '#f9f9f9';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedUserId !== convo.userId) {
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                {/* Profile Picture */}
                {convo.profilePic ? (
                  <img
                    src={convo.profilePic}
                    alt={convo.userName || 'User'}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: convo.manualMode ? '2px solid #ff9800' : '2px solid #44b700'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#e4e6eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    border: convo.manualMode ? '2px solid #ff9800' : '2px solid #44b700'
                  }}>
                    👤
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#333',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {convo.userName || `User ${convo.userId.slice(0, 8)}...`}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {convo.messages.length} messages
                  </div>
                </div>
              </div>
              {convo.manualMode && (
                <div style={{
                  marginTop: '5px',
                  marginLeft: '46px',
                  fontSize: '10px',
                  color: '#ff9800',
                  fontWeight: '600'
                }}>
                  🎮 MANUAL MODE
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!selectedUserId && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>👈</div>
                <h2 style={{ margin: '0 0 10px 0' }}>Select a conversation</h2>
                <p style={{ margin: 0 }}>Choose a user from the left to start</p>
              </div>
            </div>
          )}

          {selectedUserId && selectedConversation && (
            <>
              {/* Conversation Header */}
              <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderBottom: '2px solid #e0e0e0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Profile Picture */}
                    {selectedConversation.profilePic ? (
                      <img
                        src={selectedConversation.profilePic}
                        alt={selectedConversation.userName || 'User'}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: '#e4e6eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                      }}>
                        👤
                      </div>
                    )}

                    <div>
                      <h2 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                        {selectedConversation.userName || `User ${selectedUserId.slice(0, 12)}...`}
                      </h2>
                      <div style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: selectedConversation.manualMode ? '#fff3e0' : '#e8f5e9',
                        color: selectedConversation.manualMode ? '#e65100' : '#2e7d32'
                      }}>
                        {selectedConversation.manualMode ? '🎮 MANUAL MODE' : '🤖 AUTO MODE'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleManualMode(selectedUserId, !selectedConversation.manualMode)}
                    disabled={actionLoading}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      backgroundColor: selectedConversation.manualMode ? '#4caf50' : '#ff9800',
                      color: 'white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: actionLoading ? 0.6 : 1
                    }}
                  >
                    {selectedConversation.manualMode ? '🤖 Resume Auto' : '🎮 Take Over'}
                  </button>
                </div>

                {statusMessage && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    borderRadius: '6px',
                    backgroundColor: statusMessage.startsWith('❌') ? '#ffebee' : '#e8f5e9',
                    color: statusMessage.startsWith('❌') ? '#c62828' : '#2e7d32',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {statusMessage}
                  </div>
                )}
              </div>

              {/* Messages Area */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                backgroundColor: '#fafafa'
              }}>
                {selectedConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      flexDirection: message.senderType === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: '10px',
                      marginBottom: '15px'
                    }}
                  >
                    {/* Avatar */}
                    {message.senderType === 'user' && selectedConversation.profilePic ? (
                      <img
                        src={selectedConversation.profilePic}
                        alt={selectedConversation.userName || 'User'}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: message.senderType === 'user' ? '#e4e6eb' : message.senderType === 'human' ? '#ff9800' : '#1877f2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        flexShrink: 0
                      }}>
                        {message.senderType === 'user' ? '👤' : message.senderType === 'human' ? '👨‍💼' : '🤖'}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{
                        backgroundColor: message.senderType === 'user' ? '#e4e6eb' : message.senderType === 'human' ? '#ff9800' : '#1877f2',
                        color: message.senderType === 'user' ? 'black' : 'white',
                        padding: '10px 14px',
                        borderRadius: '18px',
                        wordWrap: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {message.text}
                      </div>

                      <div style={{
                        fontSize: '10px',
                        color: '#65676b',
                        marginTop: '4px',
                        textAlign: message.senderType === 'user' ? 'right' : 'left'
                      }}>
                        {message.senderType === 'bot' ? 'VENERA Bot' : message.senderType === 'human' ? 'Human Operator' : (selectedConversation.userName || 'User')}
                        {' · '}
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Control Panel Footer */}
              <div style={{
                backgroundColor: 'white',
                borderTop: '2px solid #e0e0e0',
                padding: '20px'
              }}>
                {/* Bot Instruction */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    📋 INSTRUCT BOT (next response only):
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={botInstruction}
                      onChange={(e) => setBotInstruction(e.target.value)}
                      placeholder="e.g., Tell them we'll call back tomorrow"
                      disabled={selectedConversation.manualMode}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        opacity: selectedConversation.manualMode ? 0.5 : 1
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') instructBot();
                      }}
                    />
                    <button
                      onClick={instructBot}
                      disabled={actionLoading || !botInstruction.trim() || selectedConversation.manualMode}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: (actionLoading || !botInstruction.trim() || selectedConversation.manualMode) ? 'not-allowed' : 'pointer',
                        backgroundColor: '#2196f3',
                        color: 'white',
                        opacity: (actionLoading || !botInstruction.trim() || selectedConversation.manualMode) ? 0.5 : 1
                      }}
                    >
                      Instruct
                    </button>
                  </div>
                  {selectedConversation.manualMode && (
                    <div style={{ fontSize: '11px', color: '#ff9800', marginTop: '5px' }}>
                      ⚠️ Disable manual mode to use bot instructions
                    </div>
                  )}
                </div>

                {/* Direct Message */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    💬 SEND DIRECT MESSAGE (you answer):
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={directMessage}
                      onChange={(e) => setDirectMessage(e.target.value)}
                      placeholder="Type your message..."
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendDirectMessage();
                      }}
                    />
                    <button
                      onClick={sendDirectMessage}
                      disabled={actionLoading || !directMessage.trim()}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: (actionLoading || !directMessage.trim()) ? 'not-allowed' : 'pointer',
                        backgroundColor: '#ff9800',
                        color: 'white',
                        opacity: (actionLoading || !directMessage.trim()) ? 0.5 : 1
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>

                {selectedConversation.botInstruction && (
                  <div style={{
                    marginTop: '15px',
                    padding: '10px',
                    borderRadius: '6px',
                    backgroundColor: '#e3f2fd',
                    fontSize: '12px',
                    color: '#1565c0'
                  }}>
                    📋 Active instruction: "{selectedConversation.botInstruction}"
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
