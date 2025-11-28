// Test user profiles
const testUsers = [
    {
        id: 'test_user_1',
        name: 'Test User 1',
        avatar: 'T1',
        color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
        id: 'test_user_2',
        name: 'Test User 2',
        avatar: 'T2',
        color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
        id: 'test_user_3',
        name: 'ნინო (Georgian)',
        avatar: 'ნ',
        color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    {
        id: 'test_user_4',
        name: 'გიორგი (Georgian)',
        avatar: 'გ',
        color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    }
];

let currentUser = null;
let messages = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeTestUsers();
    setupEventListeners();
    // Select first user by default
    if (testUsers.length > 0) {
        selectUser(testUsers[0]);
    }
});

function initializeTestUsers() {
    const container = document.getElementById('testUsers');
    container.innerHTML = '';

    testUsers.forEach((user, index) => {
        const userElement = document.createElement('div');
        userElement.className = 'test-user';
        if (index === 0) userElement.classList.add('active');
        userElement.onclick = function() { selectUser(user, this); };

        userElement.innerHTML = `
            <div class="user-avatar" style="background: ${user.color}">
                ${user.avatar}
            </div>
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-id">${user.id}</div>
            </div>
        `;

        container.appendChild(userElement);

        // Initialize empty message array for this user
        if (!messages[user.id]) {
            messages[user.id] = [];
        }
    });
}

function selectUser(user, clickedElement) {
    currentUser = user;

    // Update active state in sidebar
    document.querySelectorAll('.test-user').forEach(el => el.classList.remove('active'));
    if (clickedElement) {
        clickedElement.classList.add('active');
    } else {
        // Auto-select first user's element
        const firstUserEl = document.querySelector('.test-user');
        if (firstUserEl) firstUserEl.classList.add('active');
    }

    // Update chat header
    const chatHeader = document.getElementById('chatHeader');
    chatHeader.innerHTML = `
        <div class="user-avatar" style="background: ${user.color}">
            ${user.avatar}
        </div>
        <div class="chat-info">
            <h3>${user.name}</h3>
            <div class="chat-status">
                <span class="status-indicator online"></span>
                Active now • Test Mode
            </div>
        </div>
    `;

    // Enable input
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendButton').disabled = false;
    document.getElementById('messageInput').focus();

    // Load messages for this user
    renderMessages();
}

function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    // Send on button click
    sendButton.onclick = sendMessage;

    // Send on Enter (Shift+Enter for new line)
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    // Quick action buttons
    document.querySelectorAll('.quick-action-btn[data-message]').forEach(btn => {
        btn.onclick = () => {
            if (currentUser) {
                messageInput.value = btn.dataset.message;
                sendMessage();
            }
        };
    });
}

function sendMessage() {
    if (!currentUser) return;

    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();

    if (!text) return;

    // Add user message
    addMessage('user', text);

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Show typing indicator
    showTyping();

    // Simulate bot response
    setTimeout(() => {
        getBotResponse(text);
    }, 1000 + Math.random() * 1000);
}

function addMessage(sender, text, imageUrl = null) {
    if (!currentUser) return;

    const message = {
        sender,
        text,
        imageUrl,
        timestamp: new Date()
    };

    messages[currentUser.id].push(message);
    renderMessages();
}

function renderMessages() {
    if (!currentUser) return;

    const container = document.getElementById('messagesContainer');
    const userMessages = messages[currentUser.id] || [];
    const showTimestamps = document.getElementById('showTimestamps').checked;

    container.innerHTML = '';

    if (userMessages.length === 0) {
        container.innerHTML = `
            <div class="system-message">
                🧪 Test Mode Active<br>
                Messages sent here will be processed by test bot instructions<br>
                Start a conversation to test!
            </div>
        `;
        return;
    }

    userMessages.forEach((msg, index) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.sender}`;

        let content = `<div class="message-bubble">${escapeHtml(msg.text)}</div>`;

        if (msg.imageUrl) {
            content += `<img src="${msg.imageUrl}" class="message-image" />`;
        }

        messageDiv.innerHTML = content;

        if (showTimestamps) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.textContent = formatTime(msg.timestamp);
            messageDiv.appendChild(timeDiv);
        }

        container.appendChild(messageDiv);
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const indicator = document.getElementById('typingIndicator');
    indicator.classList.add('active');
}

function hideTyping() {
    const indicator = document.getElementById('typingIndicator');
    indicator.classList.remove('active');
}

async function getBotResponse(userMessage) {
    try {
        const useTestInstructions = document.getElementById('useTestInstructions').checked;
        const debugMode = document.getElementById('debugMode').checked;

        // Call your local test webhook
        const response = await fetch('/api/test-simulator', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                userName: currentUser.name,
                message: userMessage,
                useTestInstructions,
                debugMode
            })
        });

        const data = await response.json();

        hideTyping();

        if (data.success) {
            // Add bot response
            addMessage('bot', data.response, data.imageUrl);

            // If debug mode, log to console
            if (debugMode) {
                console.log('Bot Response:', data);
            }
        } else {
            addMessage('bot', '❌ Error: ' + (data.error || 'Failed to get response'));
        }

    } catch (error) {
        hideTyping();
        console.error('Error getting bot response:', error);

        // Fallback to mock response
        addMessage('bot', getMockResponse(userMessage));
    }
}

// Mock responses for when API is not available
function getMockResponse(userMessage) {
    const msg = userMessage.toLowerCase();

    if (msg.includes('გამარჯობა') || msg.includes('hello')) {
        return 'გამარჯობა ბებია! 💛 რით დაგეხმარო?';
    }

    if (msg.includes('ქუდი')) {
        return 'შავი ბამბის მოკლე ქუდი - სტანდარტი (M) - 49 ლარი 💛\n\nაირჩიე მიტანის მეთოდი:\n1 - თბილისი სტანდარტი (1-3 დღე) 6₾\n2 - თბილისი Wolt იმავე დღეს\n3 - რეგიონი (3-5 დღე) 10₾\n\n[MOCK: SEND_IMAGE: 9016]';
    }

    if (msg.includes('შეკვეთა') || msg.includes('სად არის')) {
        return 'მომეცი შეკვეთის ნომერი ან ტელეფონი რომ შევამოწმო 📞';
    }

    return 'მოიცა ბებია, სათვალე გავიკეთო... 👓\n\n[MOCK RESPONSE - Connect to test webhook for real responses]';
}

function clearMessages() {
    if (!currentUser) return;
    if (confirm('Clear all messages for this user?')) {
        messages[currentUser.id] = [];
        renderMessages();
    }
}

function exportChat() {
    if (!currentUser) return;

    const userMessages = messages[currentUser.id] || [];
    const chatLog = userMessages.map(msg => {
        const time = formatTime(msg.timestamp);
        const sender = msg.sender === 'user' ? currentUser.name : 'BEBIAS Bot';
        return `[${time}] ${sender}: ${msg.text}`;
    }).join('\n');

    const blob = new Blob([chatLog], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${currentUser.id}-${Date.now()}.txt`;
    a.click();
}

function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}