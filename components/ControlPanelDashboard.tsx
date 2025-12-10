'use client';

import { useEffect, useState, useRef } from 'react';
import { toGeorgiaTime } from '@/lib/timeUtils';

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
  const [killSwitchActive, setKillSwitchActive] = useState<boolean | null>(null);
  const [botControlLoading, setBotControlLoading] = useState(false);
  const [botControlMessage, setBotControlMessage] = useState('');

  // Ref for auto-scrolling to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Manual order creation states
  const [showManualOrder, setShowManualOrder] = useState(false);
  const [conversationText, setConversationText] = useState('');
  const [analyzedData, setAnalyzedData] = useState<any>(null);
  const [manualOrderLoading, setManualOrderLoading] = useState(false);
  const [manualOrderMessage, setManualOrderMessage] = useState('');
  const [createdOrders, setCreatedOrders] = useState<any[]>([]);

  // Delivery options
  const [deliveryType, setDeliveryType] = useState<'express' | 'standard'>('standard');
  const [deliveryCompany, setDeliveryCompany] = useState<string>('trackings.ge');
  const [isRegion, setIsRegion] = useState<boolean>(false);
  const [city, setCity] = useState<string>('თბილისი'); // Default city

  // Full list of Georgian cities for city dropdown (must match trackings.ge city names)
  const GEORGIAN_CITIES = [
    'თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'ფოთი', 'სამტრედია',
    'ხაშური', 'სენაკი', 'ზესტაფონი', 'მარნეული', 'თელავი', 'ახალციხე', 'ქობულეთი',
    'ოზურგეთი', 'კასპი', 'ჭიათურა', 'წყალტუბო', 'საგარეჯო', 'გარდაბანი', 'ბორჯომი',
    'ხონი', 'ბოლნისი', 'ტყიბული', 'ახალქალაქი', 'მცხეთა', 'ყვარელი', 'გურჯაანი',
    'ქარელი', 'ლანჩხუთი', 'ახმეტა', 'დუშეთი', 'ხელვაჩაური', 'საჩხერე',
    'დედოფლისწყარო', 'ლაგოდეხი', 'ნინოწმინდა', 'თერჯოლა', 'ხობი', 'მარტვილი',
    'ვანი', 'ბაღდათი', 'წალენჯიხა', 'ჩხოროწყუ', 'წალკა', 'თეთრიწყარო', 'ასპინძა',
    'დმანისი', 'ონი', 'თიანეთი', 'ამბროლაური', 'მესტია', 'ხარაგაული', 'ჩოხატაური',
    'აბაშა', 'ქედა', 'სიღნაღი', 'სტეფანწმინდა', 'წაგერი', 'ლენტეხი', 'ხულო',
    'შუახევი', 'ადიგენი'
  ];

  // Region cities for auto-detection (partial names for matching)
  const REGION_CITIES = [
    'ბათუმ', 'ქუთაის', 'რუსთავ', 'გორ', 'ზუგდიდ', 'ფოთ', 'ხაშურ', 'სამტრედ',
    'სენაკ', 'ზესტაფონ', 'მარნეულ', 'თელავ', 'ახალციხ', 'ქობულეთ', 'ოზურგეთ',
    'კასპ', 'ჭიათურ', 'წყალტუბ', 'საგარეჯ', 'გარდაბან', 'ბორჯომ', 'მცხეთ',
    'ყვარელ', 'გურჯაან', 'ლაგოდეხ', 'სიღნაღ', 'ახმეტ', 'დუშეთ', 'სტეფანწმინდ', 'ყაზბეგ'
  ];

  // Check if address is in a region (not Tbilisi) and detect city
  const detectRegion = (address: string): boolean => {
    if (!address) return false;
    const addressLower = address.toLowerCase();
    // If Tbilisi is mentioned, it's not region
    if (addressLower.includes('თბილის')) return false;
    // Check for region cities
    return REGION_CITIES.some(c => addressLower.includes(c.toLowerCase()));
  };

  // Detect city from address and return the full city name
  const detectCityFromAddress = (address: string): string => {
    if (!address) return 'თბილისი';
    const addressLower = address.toLowerCase();

    // Check each Georgian city in order of specificity
    for (const cityName of GEORGIAN_CITIES) {
      const cityLower = cityName.toLowerCase();
      // Check for partial match (city name appears in address)
      if (addressLower.includes(cityLower.slice(0, -1))) { // Remove last char for flexible matching
        return cityName;
      }
    }

    // Default to Tbilisi
    return 'თბილისი';
  };

  // Admin AI Chat states
  const [showAdminChat, setShowAdminChat] = useState(false);
  const [adminChatInput, setAdminChatInput] = useState('');
  const [adminChatHistory, setAdminChatHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [adminChatLoading, setAdminChatLoading] = useState(false);
  const adminChatEndRef = useRef<HTMLDivElement>(null);


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
      setKillSwitchActive(data.killSwitch || false);
    } catch (error) {
      console.error('Error checking bot status:', error);
    }
  };

  // Toggle kill switch
  const toggleKillSwitch = async () => {
    setBotControlLoading(true);
    setBotControlMessage('');

    try {
      const response = await fetch('/api/bot-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ killSwitch: !killSwitchActive })
      });

      if (response.ok) {
        const data = await response.json();
        setKillSwitchActive(data.killSwitch);
        setBotPaused(data.paused);
        setBotControlMessage(data.killSwitch ? 'KILL SWITCH ACTIVATED' : 'Kill switch deactivated');
        setTimeout(() => setBotControlMessage(''), 3000);
      } else {
        setBotControlMessage('Failed to toggle kill switch');
      }
    } catch (error) {
      setBotControlMessage('Error: ' + error);
    } finally {
      setBotControlLoading(false);
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

  // Analyze conversation with AI
  const analyzeConversation = async () => {
    if (!conversationText.trim()) {
      setManualOrderMessage('Please paste a conversation first');
      return;
    }

    setManualOrderLoading(true);
    setManualOrderMessage('');
    setAnalyzedData(null);

    try {
      const response = await fetch('/api/analyze-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: conversationText })
      });

      if (response.ok) {
        const result = await response.json();
        setAnalyzedData(result.data);

        // Detect city from address or use AI-detected city
        const detectedCity = result.data.city || detectCityFromAddress(result.data.address || '');
        setCity(detectedCity);

        // Detect if address is in a region (not Tbilisi)
        const addressIsRegion = detectedCity !== 'თბილისი';
        setIsRegion(addressIsRegion);

        // Set delivery type/company from AI analysis or auto-detect from address
        if (result.data.deliveryType === 'express') {
          setDeliveryType('express');
          setDeliveryCompany(result.data.deliveryCompany || 'wolt');
        } else {
          setDeliveryType('standard');
          setDeliveryCompany(result.data.deliveryCompany || 'trackings.ge');
        }

        // Show region notification if detected
        if (addressIsRegion) {
          setManualOrderMessage(`✅ Analyzed! 📍 Region detected: ${detectedCity} - shipping will be set to region delivery`);
        } else {
          setManualOrderMessage('Conversation analyzed successfully!');
        }
        setTimeout(() => setManualOrderMessage(''), 4000);
      } else {
        const error = await response.json();
        setManualOrderMessage('Failed to analyze: ' + (error.error || 'Unknown error'));
      }
    } catch (error: any) {
      setManualOrderMessage('Error: ' + error.message);
    } finally {
      setManualOrderLoading(false);
    }
  };

  // Create manual order from analyzed data
  const createManualOrder = async () => {
    if (!analyzedData) {
      setManualOrderMessage('Please analyze a conversation first');
      return;
    }

    setManualOrderLoading(true);
    setManualOrderMessage('');
    setCreatedOrders([]);

    try {
      const response = await fetch('/api/create-manual-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...analyzedData,
          city,
          deliveryType,
          deliveryCompany,
          isRegion
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Handle new single order response format
        if (result.orderNumber) {
          setCreatedOrders([{
            orderNumber: result.orderNumber,
            product: result.products.join(' + '),
            quantity: result.totalQuantity,
            total: result.totalAmount,
            status: 'success'
          }]);

          // Show success message with stock warnings if any
          let message = `✅ Order ${result.orderNumber} created! Total: ${result.totalAmount}`;
          if (result.stockWarnings && result.stockWarnings.length > 0) {
            message += `\n⚠️ Stock warnings:\n${result.stockWarnings.join('\n')}`;
          }
          setManualOrderMessage(message);
        } else {
          // Legacy format fallback (if needed)
          setCreatedOrders(result.orders || []);
          setManualOrderMessage(`Successfully created order!`);
        }

        // Clear form after successful creation
        setTimeout(() => {
          setConversationText('');
          setAnalyzedData(null);
          setCreatedOrders([]);
          setManualOrderMessage('');
          setDeliveryType('standard');
          setDeliveryCompany('trackings.ge');
          setIsRegion(false);
          setCity('თბილისი');
        }, 5000);
      } else {
        const error = await response.json();
        setManualOrderMessage('Failed to create order: ' + (error.error || 'Unknown error'));
      }
    } catch (error: any) {
      setManualOrderMessage('Error: ' + error.message);
    } finally {
      setManualOrderLoading(false);
    }
  };

  // Send admin AI chat message
  const sendAdminChatMessage = async () => {
    if (!adminChatInput.trim() || adminChatLoading) return;

    const userMessage = adminChatInput.trim();
    setAdminChatInput('');
    setAdminChatLoading(true);

    // Add user message to history
    const newHistory = [...adminChatHistory, { role: 'user' as const, content: userMessage }];
    setAdminChatHistory(newHistory);

    try {
      const response = await fetch('/api/admin-ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          chatHistory: adminChatHistory
        })
      });

      if (response.ok) {
        const result = await response.json();
        setAdminChatHistory([...newHistory, { role: 'assistant', content: result.response }]);
      } else {
        const error = await response.json();
        setAdminChatHistory([...newHistory, { role: 'assistant', content: `Error: ${error.error || 'Failed to get response'}` }]);
      }
    } catch (error: any) {
      setAdminChatHistory([...newHistory, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setAdminChatLoading(false);
    }
  };

  // Auto-scroll admin chat
  useEffect(() => {
    if (adminChatEndRef.current) {
      adminChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [adminChatHistory]);

  // Fetch messages (now includes profiles and status in bulk - no N+1 queries!)
  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/meta-messages');
      const data = await response.json();
      const convos = data.conversations || [];

      // Check for confirmed orders (enriched data already included from API)
      for (const convo of convos) {
        convo.hasConfirmedOrder = convo.messages?.some(msg =>
          msg.senderType === 'bot' && msg.text?.includes('ORDER_NOTIFICATION')
        );
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
                        {toGeorgiaTime(message.timestamp)}
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
            backgroundColor: killSwitchActive ? '#fff0f0' : '#f8f9fa',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            border: killSwitchActive ? '2px solid #dc3545' : 'none'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
              STATUS
            </div>
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: '16px',
              backgroundColor: killSwitchActive ? '#000' : (botPaused ? '#dc3545' : '#28a745'),
              color: 'white',
              fontSize: '13px',
              fontWeight: 'bold',
              marginBottom: '12px'
            }}>
              {killSwitchActive ? '🛑 KILLED' : (botPaused ? '⏸ PAUSED' : '▶ ACTIVE')}
            </div>
            <p style={{ fontSize: '12px', color: killSwitchActive ? '#dc3545' : '#666', margin: '0 0 12px 0', lineHeight: '1.5', fontWeight: killSwitchActive ? 'bold' : 'normal' }}>
              {killSwitchActive
                ? 'EMERGENCY STOP - All processing halted!'
                : (botPaused
                  ? 'Bot paused globally. No auto responses.'
                  : 'Bot is active and responding automatically.')}
            </p>
            {botControlMessage && (
              <div style={{
                padding: '10px',
                borderRadius: '6px',
                backgroundColor: botControlMessage.includes('KILL') ? '#000' : (botControlMessage.includes('deactivated') || botControlMessage.includes('resumed') ? '#d4edda' : '#f8d7da'),
                color: botControlMessage.includes('KILL') ? '#fff' : (botControlMessage.includes('deactivated') || botControlMessage.includes('resumed') ? '#155724' : '#721c24'),
                fontSize: '12px',
                marginBottom: '12px',
                fontWeight: botControlMessage.includes('KILL') ? 'bold' : 'normal'
              }}>
                {botControlMessage}
              </div>
            )}

            {/* Kill Switch Button */}
            <button
              onClick={toggleKillSwitch}
              disabled={botControlLoading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: 'white',
                backgroundColor: killSwitchActive ? '#28a745' : '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: botControlLoading ? 'not-allowed' : 'pointer',
                opacity: botControlLoading ? 0.6 : 1,
                marginBottom: '10px'
              }}
            >
              {botControlLoading ? 'Processing...' : (killSwitchActive ? '✅ Reactivate Bot' : '🛑 KILL SWITCH')}
            </button>

            {/* Pause/Resume Button (disabled when kill switch active) */}
            <button
              onClick={toggleBot}
              disabled={botControlLoading || killSwitchActive}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: 'white',
                backgroundColor: botPaused ? '#28a745' : '#dc3545',
                border: 'none',
                borderRadius: '6px',
                cursor: (botControlLoading || killSwitchActive) ? 'not-allowed' : 'pointer',
                opacity: (botControlLoading || killSwitchActive) ? 0.4 : 1
              }}
            >
              {botControlLoading ? 'Processing...' : (botPaused ? '▶ Resume Bot' : '⏸ Pause Bot')}
            </button>
            {killSwitchActive && (
              <p style={{ fontSize: '10px', color: '#999', margin: '8px 0 0 0', textAlign: 'center' }}>
                Use Reactivate to restore normal operation
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px', fontWeight: '600' }}>
              QUICK ACTIONS
            </div>

            <button
              onClick={() => setShowManualOrder(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                marginBottom: '10px',
                backgroundColor: '#fff',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f7ff';
                e.currentTarget.style.borderColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
                e.currentTarget.style.borderColor = '#ddd';
              }}
            >
              <div style={{ fontSize: '24px' }}>📝</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Create Manual Order</div>
                <div style={{ fontSize: '10px', color: '#666' }}>AI-powered order tool</div>
              </div>
            </button>

            <button
              onClick={() => setShowAdminChat(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                marginBottom: '10px',
                backgroundColor: '#fff',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f0ff';
                e.currentTarget.style.borderColor = '#7c3aed';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
                e.currentTarget.style.borderColor = '#ddd';
              }}
            >
              <div style={{ fontSize: '24px' }}>🤖</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Admin AI Chat</div>
                <div style={{ fontSize: '10px', color: '#666' }}>Ask about orders, stock, stats</div>
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

        {/* Manual Order Creation Modal */}
        {showManualOrder && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Create Manual Order</h3>
                <button
                  onClick={() => {
                    setShowManualOrder(false);
                    setConversationText('');
                    setAnalyzedData(null);
                    setCreatedOrders([]);
                    setManualOrderMessage('');
                    setDeliveryType('standard');
                    setDeliveryCompany('trackings.ge');
                    setIsRegion(false);
                    setCity('თბილისი');
                  }}
                  style={{
                    background: '#f0f0f0',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '18px'
                  }}
                >
                  ✕
                </button>
              </div>

              {manualOrderMessage && (
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: manualOrderMessage.includes('Error') || manualOrderMessage.includes('Failed')
                    ? '#fee'
                    : manualOrderMessage.includes('⚠️')
                      ? '#fffbeb'
                      : '#efe',
                  color: manualOrderMessage.includes('Error') || manualOrderMessage.includes('Failed')
                    ? '#c00'
                    : manualOrderMessage.includes('⚠️')
                      ? '#92400e'
                      : '#080',
                  marginBottom: '16px',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {manualOrderMessage}
                </div>
              )}

              {!analyzedData ? (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                      Paste Customer Conversation
                    </label>
                    <textarea
                      value={conversationText}
                      onChange={(e) => setConversationText(e.target.value)}
                      placeholder="Paste the conversation with customer here..."
                      style={{
                        width: '100%',
                        minHeight: '200px',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <button
                    onClick={analyzeConversation}
                    disabled={manualOrderLoading || !conversationText.trim()}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: 'white',
                      backgroundColor: '#2563eb',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: manualOrderLoading || !conversationText.trim() ? 'not-allowed' : 'pointer',
                      opacity: manualOrderLoading || !conversationText.trim() ? 0.6 : 1
                    }}
                  >
                    {manualOrderLoading ? '🔄 Analyzing...' : '🤖 Analyze with AI'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#333' }}>Extracted Order Details</h4>

                    {/* Products */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#666' }}>
                        Products
                      </label>
                      {analyzedData.products && analyzedData.products.length > 0 ? (
                        analyzedData.products.map((product: any, index: number) => (
                          <div key={index} style={{
                            padding: '10px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <input
                                type="text"
                                value={product.name}
                                onChange={(e) => {
                                  const newData = { ...analyzedData };
                                  newData.products[index].name = e.target.value;
                                  setAnalyzedData(newData);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              <input
                                type="number"
                                value={product.quantity}
                                onChange={(e) => {
                                  const newData = { ...analyzedData };
                                  newData.products[index].quantity = parseInt(e.target.value) || 1;
                                  setAnalyzedData(newData);
                                }}
                                style={{
                                  width: '60px',
                                  padding: '8px 12px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  textAlign: 'center'
                                }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: '#999', fontSize: '13px' }}>No products found</p>
                      )}
                    </div>

                    {/* Customer Name */}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#666' }}>
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={analyzedData.customerName || ''}
                        onChange={(e) => setAnalyzedData({ ...analyzedData, customerName: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    {/* Telephone */}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#666' }}>
                        Telephone
                      </label>
                      <input
                        type="text"
                        value={analyzedData.telephone || ''}
                        onChange={(e) => setAnalyzedData({ ...analyzedData, telephone: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    {/* Address */}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#666' }}>
                        Address
                        {isRegion && (
                          <span style={{
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>
                            📍 Region
                          </span>
                        )}
                      </label>
                      <textarea
                        value={analyzedData.address || ''}
                        onChange={(e) => {
                          const newAddress = e.target.value;
                          setAnalyzedData({ ...analyzedData, address: newAddress });
                          // Re-detect city and region when address changes
                          const detectedCity = detectCityFromAddress(newAddress);
                          setCity(detectedCity);
                          setIsRegion(detectedCity !== 'თბილისი');
                        }}
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          padding: '8px 12px',
                          border: isRegion ? '2px solid #f59e0b' : '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          resize: 'vertical',
                          backgroundColor: isRegion ? '#fffbeb' : '#fff'
                        }}
                      />
                    </div>

                    {/* City */}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#666' }}>
                        City / ქალაქი
                        {isRegion && (
                          <span style={{
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>
                            📍 Region
                          </span>
                        )}
                      </label>
                      <select
                        value={city}
                        onChange={(e) => {
                          const newCity = e.target.value;
                          setCity(newCity);
                          setIsRegion(newCity !== 'თბილისი');
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: isRegion ? '2px solid #f59e0b' : '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          backgroundColor: isRegion ? '#fffbeb' : '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        {GEORGIAN_CITIES.map((cityName) => (
                          <option key={cityName} value={cityName}>
                            {cityName}
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        {isRegion ? 'Region delivery charges apply' : 'Tbilisi - standard delivery'}
                      </div>
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#666' }}>
                        Notes (Optional)
                      </label>
                      <textarea
                        value={analyzedData.notes || ''}
                        onChange={(e) => setAnalyzedData({ ...analyzedData, notes: e.target.value })}
                        placeholder="Any special instructions..."
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          padding: '8px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    {/* Delivery Type */}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#666' }}>
                        Delivery Type
                      </label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 16px',
                          borderRadius: '6px',
                          border: deliveryType === 'standard' ? '2px solid #2563eb' : '1px solid #ddd',
                          backgroundColor: deliveryType === 'standard' ? '#eff6ff' : '#fff',
                          cursor: 'pointer',
                          flex: 1
                        }}>
                          <input
                            type="radio"
                            name="deliveryType"
                            value="standard"
                            checked={deliveryType === 'standard'}
                            onChange={() => {
                              setDeliveryType('standard');
                              setDeliveryCompany('trackings.ge');
                            }}
                            style={{ margin: 0 }}
                          />
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '13px' }}>Standard</div>
                            <div style={{ fontSize: '11px', color: '#666' }}>1-3 days</div>
                          </div>
                        </label>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 16px',
                          borderRadius: '6px',
                          border: deliveryType === 'express' ? '2px solid #dc2626' : '1px solid #ddd',
                          backgroundColor: deliveryType === 'express' ? '#fef2f2' : '#fff',
                          cursor: 'pointer',
                          flex: 1
                        }}>
                          <input
                            type="radio"
                            name="deliveryType"
                            value="express"
                            checked={deliveryType === 'express'}
                            onChange={() => {
                              setDeliveryType('express');
                              setDeliveryCompany('wolt');
                            }}
                            style={{ margin: 0 }}
                          />
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '13px' }}>Express</div>
                            <div style={{ fontSize: '11px', color: '#666' }}>Same day</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Delivery Company */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#666' }}>
                        Delivery Company
                      </label>
                      <select
                        value={deliveryCompany}
                        onChange={(e) => setDeliveryCompany(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          backgroundColor: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        {deliveryType === 'standard' ? (
                          <>
                            <option value="trackings.ge">Trackings.ge</option>
                          </>
                        ) : (
                          <>
                            <option value="wolt">Wolt</option>
                          </>
                        )}
                      </select>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        {deliveryType === 'standard' ? 'Default for standard delivery' : 'Default for express delivery'}
                      </div>
                    </div>
                  </div>

                  {/* Created Orders Display */}
                  {createdOrders.length > 0 && (
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      border: '1px solid #bae6fd'
                    }}>
                      <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#0369a1' }}>
                        Created Orders
                      </h5>
                      {createdOrders.map((order: any, index: number) => (
                        <div key={index} style={{
                          padding: '8px',
                          backgroundColor: order.status === 'success' ? '#dcfce7' : '#fee2e2',
                          borderRadius: '4px',
                          marginBottom: '6px',
                          fontSize: '13px'
                        }}>
                          {order.status === 'success' ? (
                            <div>
                              ✅ <strong>{order.orderNumber}</strong> - {order.product} x {order.quantity}
                            </div>
                          ) : (
                            <div>
                              ❌ {order.product} x {order.quantity} - {order.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => {
                        setAnalyzedData(null);
                        setCreatedOrders([]);
                        setManualOrderMessage('');
                      }}
                      style={{
                        flex: 1,
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#666',
                        backgroundColor: '#f0f0f0',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={createManualOrder}
                      disabled={manualOrderLoading || createdOrders.length > 0}
                      style={{
                        flex: 2,
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: '#16a34a',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: manualOrderLoading || createdOrders.length > 0 ? 'not-allowed' : 'pointer',
                        opacity: manualOrderLoading || createdOrders.length > 0 ? 0.6 : 1
                      }}
                    >
                      {manualOrderLoading ? '🔄 Creating...' : '✅ Create Order'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Admin AI Chat Modal */}
        {showAdminChat && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '600px',
              height: isMobile ? '90vh' : '70vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#7c3aed',
                color: 'white'
              }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Admin AI Assistant</h3>
                  <p style={{ fontSize: '12px', margin: '4px 0 0 0', opacity: 0.9 }}>Ask about orders, stock, statistics</p>
                </div>
                <button
                  onClick={() => {
                    setShowAdminChat(false);
                    setAdminChatHistory([]);
                    setAdminChatInput('');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                backgroundColor: '#f8f9fa'
              }}>
                {adminChatHistory.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#666', marginTop: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                    <p style={{ fontSize: '14px', margin: '0 0 20px 0' }}>
                      Ask me anything about your business!
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                      {[
                        'How many orders today?',
                        'Show recent orders',
                        'What products are in stock?',
                        'Total revenue this week?'
                      ].map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setAdminChatInput(suggestion);
                          }}
                          style={{
                            padding: '8px 12px',
                            fontSize: '12px',
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f0f0f0';
                            e.currentTarget.style.borderColor = '#7c3aed';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#ddd';
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {adminChatHistory.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{
                      maxWidth: '80%',
                      padding: '10px 14px',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      backgroundColor: msg.role === 'user' ? '#7c3aed' : 'white',
                      color: msg.role === 'user' ? 'white' : '#333',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      fontSize: '14px',
                      lineHeight: '1.5'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {adminChatLoading && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '18px 18px 18px 4px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      <span style={{ animation: 'pulse 1s infinite' }}>Thinking...</span>
                    </div>
                  </div>
                )}

                <div ref={adminChatEndRef} />
              </div>

              {/* Input Area */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid #e0e0e0',
                backgroundColor: 'white'
              }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={adminChatInput}
                    onChange={(e) => setAdminChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendAdminChatMessage();
                      }
                    }}
                    placeholder="Ask about orders, stock, stats..."
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '24px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    disabled={adminChatLoading}
                  />
                  <button
                    onClick={sendAdminChatMessage}
                    disabled={adminChatLoading || !adminChatInput.trim()}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '24px',
                      border: 'none',
                      backgroundColor: '#7c3aed',
                      color: 'white',
                      fontWeight: '600',
                      cursor: adminChatLoading || !adminChatInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: adminChatLoading || !adminChatInput.trim() ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {adminChatLoading ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
