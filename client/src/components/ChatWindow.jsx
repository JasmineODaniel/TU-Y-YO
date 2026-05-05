import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import MessageBubble from './MessageBubble';

export default function ChatWindow() {
  const { user } = useAuth();
  const { activeChat, messages, loadingMessages, sendingMessage, sendEncryptedMessage, setActiveChat } = useChat();
  const [inputText, setInputText] = useState('');
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const prevMessagesLength = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || sendingMessage) return;
    const text = inputText.trim();
    setInputText('');
    setSendError('');
    try {
      await sendEncryptedMessage(text);
    } catch (err) {
      setSendError('Failed to send. ' + err.message);
      setInputText(text); // restore text
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  if (!activeChat) return null;

  return (
    <div className="chat-window" id="chat-window">
      {/* Chat Header */}
      <div className="chat-header">
        <button className="back-btn mobile-only" onClick={() => setActiveChat(null)} title="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="avatar avatar-sm" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}>
          {getInitials(activeChat.displayName)}
        </div>
        <div className="chat-header-info">
          <span className="chat-header-name">{activeChat.displayName}</span>
          <span className="chat-header-username">@{activeChat.username}</span>
        </div>
        <div className="chat-header-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Encrypted</span>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container" ref={messagesContainerRef} id="messages-container">
        {loadingMessages && (
          <div className="messages-loading">
            <div className="spinner" />
            <span>Decrypting messages...</span>
          </div>
        )}

        {!loadingMessages && messages.length === 0 && (
          <div className="messages-empty">
            <div className="messages-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p>Messages are end-to-end encrypted. Send your first secure message to <strong>{activeChat.displayName}</strong>.</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isSent={msg.fromUserId === user.id}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {sendError && (
        <div className="send-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {sendError}
        </div>
      )}
      <form className="message-input-bar" onSubmit={handleSend} id="message-form">
        <div className="message-input-wrapper">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="message-input"
            id="message-input"
            rows={1}
            disabled={sendingMessage}
          />
        </div>
        <button
          type="submit"
          className="send-btn"
          disabled={!inputText.trim() || sendingMessage}
          id="send-btn"
          title="Send encrypted message"
        >
          {sendingMessage ? (
            <div className="spinner spinner-sm" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
