'use client';

import { useEffect, useState, useRef } from 'react';

// Media query hook for mobile detection
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

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
  needsAttention?: boolean;
  escalationReason?: string;
  escalationDetails?: string;
  hasConfirmedOrder?: boolean;
};

export default function ControlPanelDashboard() {
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [directMessage, setDirectMessage] = useState('');
  const [botInstruction, setBotInstruction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Mobile view states
  const [showConversationList, setShowConversationList] = useState(true);
  const [showBotControls, setShowBotControls] = useState(false);

  // Bot control states
  const [botPaused, setBotPaused] = useState<boolean | null>(null);
  const [botControlLoading, setBotControlLoading] = useState(false);
  const [botControlMessage, setBotControlMessage] = useState('');

  // Ref for auto-scrolling to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Check bot status
  const checkBotStatus = async () => {
    try {
      const response = await fetch('/api/bot-status');
      const data = await response.json();
      setBotPaused(data.paused || false);
    } catch (error) {
      console.error('Error checking bot status:', error);
    }
  };

  // Toggle bot pause/resume
  const toggleBot = async () => {
    setBotControlLoading(true);
    setBotControlMessage('');

    try {
      const response = await fetch('/api/bot-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !botPaused })
      });

      if (response.ok) {
        const data = await response.json();
        setBotPaused(data.paused);
        setBotControlMessage(data.paused ? '✅ Bot paused globally' : '✅ Bot resumed');
        setTimeout(() => setBotControlMessage(''), 3000);
      } else {
        setBotControlMessage('❌ Failed to update bot status');
      }
    } catch (error) {
      setBotControlMessage('❌ Error: ' + error);
    } finally {
      setBotControlLoading(false);
    }
  };

  // Fetch messages and manual mode status
  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/meta-messages');
      const data = await response.json();
      const convos = data.conversations || [];

      // Fetch manual mode status and user profile for each conversation
      for (const convo of convos) {
        try {
          // Check if conversation has confirmed order (ORDER_NOTIFICATION in messages)
          convo.hasConfirmedOrder = convo.messages.some(msg =>
            msg.senderType === 'bot' && msg.text.includes('ORDER_NOTIFICATION')
          );

          // Fetch manual mode status and escalation data
          const statusResponse = await fetch(`/api/manual-control?userId=${convo.userId}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            convo.manualMode = statusData.manualMode;
            convo.botInstruction = statusData.botInstruction;
            convo.needsAttention = statusData.needsAttention;
            convo.escalationReason = statusData.escalationReason;
            convo.escalationDetails = statusData.escalationDetails;
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
    checkBotStatus();
    // Auto-refresh every 3 seconds
    const interval = setInterval(() => {
      fetchMessages();
      checkBotStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedUserId, conversations]);

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
        padding: isMobile ? '12px 15px' : '20px 40px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            margin: '0 0 5px 0',
            fontSize: isMobile ? '18px' : '24px',
            fontWeight: 'bold',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            🎮 VENERA {!isMobile && 'Control Panel'}
          </h1>
          {!isMobile && (
            <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
              Take over conversations • Instruct bot • Send direct messages
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isMobile && (
            <button
              onClick={() => setShowBotControls(!showBotControls)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: '500'
              }}
            >
              ⚙️
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: isMobile ? '8px 12px' : '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: '500',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        height: isMobile ? 'calc(100vh - 60px)' : 'calc(100vh - 85px)',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        {/* Left Sidebar - Conversation List */}
        {(!isMobile || (isMobile && showConversationList)) && (
        <div style={{
          width: isMobile ? '100%' : '280px',
          backgroundColor: 'white',
          borderRight: isMobile ? 'none' : '1px solid #e0e0e0',
          overflowY: 'auto',
          flexShrink: 0,
          display: isMobile && selectedUserId ? 'none' : 'block'
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

          {!loading && conversations.map((convo) => {
            // Determine background color based on status
            let bgColor = 'white';
            let hoverColor = '#f9f9f9';
            let borderColor = 'none';

            if (selectedUserId === convo.userId) {
              bgColor = '#e3f2fd';
            } else if (convo.needsAttention) {
              bgColor = '#fff3cd'; // Yellow for attention needed
              hoverColor = '#ffe69c';
              borderColor = '4px solid #ff9800';
            } else if (convo.hasConfirmedOrder) {
              bgColor = '#e8f5e9'; // Light green for confirmed orders
              hoverColor = '#c8e6c9';
              borderColor = '4px solid #4caf50';
            }

            return (
            <div
              key={convo.userId}
              onClick={() => {
                setSelectedUserId(convo.userId);
                if (isMobile) setShowConversationList(false);
              }}
              style={{
                padding: '15px',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                backgroundColor: bgColor,
                transition: 'background 0.2s',
                borderLeft: borderColor
              }}
              onMouseEnter={(e) => {
                if (selectedUserId !== convo.userId) {
                  e.currentTarget.style.backgroundColor = hoverColor;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedUserId !== convo.userId) {
                  if (convo.needsAttention) {
                    e.currentTarget.style.backgroundColor = '#fff3cd';
                  } else if (convo.hasConfirmedOrder) {
                    e.currentTarget.style.backgroundColor = '#e8f5e9';
                  } else {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
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
              {convo.needsAttention && (
                <div style={{
                  marginTop: '5px',
                  marginLeft: '46px',
                  fontSize: '10px',
                  color: '#d32f2f',
                  fontWeight: '600'
                }}>
                  ⚠️ NEEDS ATTENTION - {convo.escalationReason?.toUpperCase() || 'ISSUE'}
                </div>
              )}
              {convo.manualMode && !convo.needsAttention && (
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
              {convo.escalationDetails && (
                <div style={{
                  marginTop: '5px',
                  marginLeft: '46px',
                  fontSize: '10px',
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  {convo.escalationDetails}
                </div>
              )}
            </div>
          );
          })}
        </div>
        )}

        {/* Main Content Area - Chat */}
        <div style={{
          flex: 1,
          display: isMobile && selectedUserId ? 'flex' : (isMobile ? 'none' : 'flex'),
          flexDirection: 'column',
          minWidth: 0,
          width: isMobile ? '100%' : 'auto'
        }}>
          {!selectedUserId && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f8f9fa',
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
                padding: isMobile ? '12px 15px' : '20px',
                borderBottom: '2px solid #e0e0e0',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
                    {/* Back button for mobile */}
                    {isMobile && (
                      <button
                        onClick={() => {
                          setSelectedUserId(null);
                          setShowConversationList(true);
                        }}
                        style={{
                          background: '#f0f0f0',
                          border: 'none',
                          borderRadius: '50%',
                          width: '36px',
                          height: '36px',
                          cursor: 'pointer',
                          fontSize: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ←
                      </button>
                    )}
                    {/* Profile Picture */}
                    {selectedConversation.profilePic ? (
                      <img
                        src={selectedConversation.profilePic}
                        alt={selectedConversation.userName || 'User'}
                        style={{
                          width: isMobile ? '36px' : '48px',
                          height: isMobile ? '36px' : '48px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: isMobile ? '36px' : '48px',
                        height: isMobile ? '36px' : '48px',
                        borderRadius: '50%',
                        backgroundColor: '#e4e6eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isMobile ? '18px' : '24px'
                      }}>
                        👤
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{
                        margin: '0 0 5px 0',
                        fontSize: isMobile ? '14px' : '18px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {selectedConversation.userName || `User ${selectedUserId.slice(0, 12)}...`}
                      </h2>
                      <div style={{
                        display: 'inline-block',
                        padding: isMobile ? '3px 8px' : '4px 12px',
                        borderRadius: '12px',
                        fontSize: isMobile ? '9px' : '11px',
                        fontWeight: '600',
                        backgroundColor: selectedConversation.manualMode ? '#fff3e0' : '#e8f5e9',
                        color: selectedConversation.manualMode ? '#e65100' : '#2e7d32'
                      }}>
                        {selectedConversation.manualMode ? '🎮 MANUAL' : '🤖 AUTO'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleManualMode(selectedUserId, !selectedConversation.manualMode)}
                    disabled={actionLoading}
                    style={{
                      padding: isMobile ? '8px 12px' : '10px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: isMobile ? '11px' : '14px',
                      fontWeight: '600',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      backgroundColor: selectedConversation.manualMode ? '#4caf50' : '#ff9800',
                      color: 'white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: actionLoading ? 0.6 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isMobile
                      ? (selectedConversation.manualMode ? '🤖' : '🎮')
                      : (selectedConversation.manualMode ? '🤖 Resume Auto' : '🎮 Take Over')
                    }
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
                padding: isMobile ? '10px' : '20px',
                backgroundColor: '#fafafa',
                display: 'flex',
                flexDirection: 'column'
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
                {/* Scroll target - always at the bottom */}
                <div ref={messagesEndRef} />
              </div>

              {/* Control Panel Footer */}
              <div style={{
                backgroundColor: 'white',
                borderTop: '2px solid #e0e0e0',
                padding: isMobile ? '12px' : '20px'
              }}>
                {/* Bot Instruction */}
                <div style={{ marginBottom: isMobile ? '10px' : '15px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '10px' : '12px',
                    fontWeight: '600',
                    color: '#666',
                    marginBottom: isMobile ? '4px' : '8px'
                  }}>
                    📋 INSTRUCT BOT {!isMobile && '(next response only)'}:
                  </label>
                  <div style={{ display: 'flex', gap: isMobile ? '6px' : '10px' }}>
                    <input
                      type="text"
                      value={botInstruction}
                      onChange={(e) => setBotInstruction(e.target.value)}
                      placeholder={isMobile ? "Instruct bot..." : "e.g., Tell them we'll call back tomorrow"}
                      disabled={selectedConversation.manualMode}
                      style={{
                        flex: 1,
                        padding: isMobile ? '8px' : '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: isMobile ? '12px' : '14px',
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
                        padding: isMobile ? '8px 12px' : '10px 20px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: isMobile ? '12px' : '14px',
                        fontWeight: '600',
                        cursor: (actionLoading || !botInstruction.trim() || selectedConversation.manualMode) ? 'not-allowed' : 'pointer',
                        backgroundColor: '#2196f3',
                        color: 'white',
                        opacity: (actionLoading || !botInstruction.trim() || selectedConversation.manualMode) ? 0.5 : 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isMobile ? '📋' : 'Instruct'}
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
                    fontSize: isMobile ? '10px' : '12px',
                    fontWeight: '600',
                    color: '#666',
                    marginBottom: isMobile ? '4px' : '8px'
                  }}>
                    💬 DIRECT MESSAGE {!isMobile && '(you answer)'}:
                  </label>
                  <div style={{ display: 'flex', gap: isMobile ? '6px' : '10px' }}>
                    <input
                      type="text"
                      value={directMessage}
                      onChange={(e) => setDirectMessage(e.target.value)}
                      placeholder="Type your message..."
                      style={{
                        flex: 1,
                        padding: isMobile ? '8px' : '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: isMobile ? '12px' : '14px'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendDirectMessage();
                      }}
                    />
                    <button
                      onClick={sendDirectMessage}
                      disabled={actionLoading || !directMessage.trim()}
                      style={{
                        padding: isMobile ? '8px 12px' : '10px 20px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: isMobile ? '12px' : '14px',
                        fontWeight: '600',
                        cursor: (actionLoading || !directMessage.trim()) ? 'not-allowed' : 'pointer',
                        backgroundColor: '#ff9800',
                        color: 'white',
                        opacity: (actionLoading || !directMessage.trim()) ? 0.5 : 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isMobile ? '💬' : 'Send'}
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

        {/* Backdrop for mobile bot controls modal */}
        {isMobile && showBotControls && (
          <div
            onClick={() => setShowBotControls(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 199
            }}
          />
        )}

        {/* Right Sidebar - Bot Controls (Desktop) or Modal (Mobile) */}
        {(!isMobile || showBotControls) && (
        <div style={{
          width: isMobile ? '100%' : '320px',
          backgroundColor: 'white',
          borderLeft: isMobile ? 'none' : '1px solid #e0e0e0',
          overflowY: 'auto',
          flexShrink: 0,
          padding: isMobile ? '15px' : '20px',
          position: isMobile ? 'fixed' : 'relative',
          top: isMobile ? 0 : 'auto',
          left: isMobile ? 0 : 'auto',
          right: isMobile ? 0 : 'auto',
          bottom: isMobile ? 0 : 'auto',
          zIndex: isMobile ? 200 : 'auto',
          boxShadow: isMobile ? '0 -4px 12px rgba(0,0,0,0.15)' : 'none'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#333' }}>
              Bot Controls
            </h3>
            {isMobile && (
              <button
                onClick={() => setShowBotControls(false)}
                style={{
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Bot Status */}
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
              STATUS
            </div>
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: '16px',
              backgroundColor: botPaused ? '#dc3545' : '#28a745',
              color: 'white',
              fontSize: '13px',
              fontWeight: 'bold',
              marginBottom: '12px'
            }}>
              {botPaused ? '⏸ PAUSED' : '▶ ACTIVE'}
            </div>
            <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px 0', lineHeight: '1.5' }}>
              {botPaused
                ? 'Bot paused globally. No auto responses.'
                : 'Bot is active and responding automatically.'}
            </p>
            {botControlMessage && (
              <div style={{
                padding: '10px',
                borderRadius: '6px',
                backgroundColor: botControlMessage.includes('✅') ? '#d4edda' : '#f8d7da',
                color: botControlMessage.includes('✅') ? '#155724' : '#721c24',
                fontSize: '12px',
                marginBottom: '12px'
              }}>
                {botControlMessage}
              </div>
            )}
            <button
              onClick={toggleBot}
              disabled={botControlLoading}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: 'white',
                backgroundColor: botPaused ? '#28a745' : '#dc3545',
                border: 'none',
                borderRadius: '6px',
                cursor: botControlLoading ? 'not-allowed' : 'pointer',
                opacity: botControlLoading ? 0.6 : 1
              }}
            >
              {botControlLoading ? 'Processing...' : (botPaused ? '▶ Resume Bot' : '⏸ Pause Bot')}
            </button>
          </div>

          {/* Quick Actions */}
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px', fontWeight: '600' }}>
              QUICK ACTIONS
            </div>

            <button
              disabled
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                marginBottom: '10px',
                backgroundColor: '#f8f9fa',
                color: '#6c757d',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'not-allowed',
                opacity: 0.6
              }}
            >
              <div style={{ fontSize: '24px' }}>🚚</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>WOLT Send</div>
                <div style={{ fontSize: '10px', fontStyle: 'italic' }}>Coming Soon</div>
              </div>
            </button>

            <button
              disabled
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                marginBottom: '10px',
                backgroundColor: '#f8f9fa',
                color: '#6c757d',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'not-allowed',
                opacity: 0.6
              }}
            >
              <div style={{ fontSize: '24px' }}>⚙️</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Settings</div>
                <div style={{ fontSize: '10px', fontStyle: 'italic' }}>Coming Soon</div>
              </div>
            </button>

            <button
              disabled
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                color: '#6c757d',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'not-allowed',
                opacity: 0.6
              }}
            >
              <div style={{ fontSize: '24px' }}>📊</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Statistics</div>
                <div style={{ fontSize: '10px', fontStyle: 'italic' }}>Coming Soon</div>
              </div>
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
