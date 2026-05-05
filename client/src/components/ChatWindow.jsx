import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import MessageBubble from './MessageBubble';

export default function ChatWindow() {
  const { user } = useAuth();
  const { activeChat, messages, loadingMessages, sendingMessage, sendEncryptedMessage, setActiveChat, activeTypers, sendTypingSignal, initiateCall } = useChat();
  const [inputText, setInputText] = useState('');
  const [sendError, setSendError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    sendTypingSignal(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingSignal(false);
    }, 2000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || sendingMessage) return;
    const text = inputText.trim();
    setInputText('');
    setSendError('');
    sendTypingSignal(false);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result;
          try {
            await sendEncryptedMessage({ type: 'audio', content: base64data, mimeType: 'audio/webm' });
          } catch (err) {
            setSendError('Failed to send audio. ' + err.message);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setSendError('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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
        <div className="chat-header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn-icon" onClick={() => initiateCall(activeChat.userId)} title="Start E2E Video Call">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <div className="chat-header-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Encrypted</span>
          </div>
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
        {activeTypers && activeTypers.has(activeChat.userId) && (
          <div className="typing-indicator-bubble">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}
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
        <button
          type="button"
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? "Stop & Send Audio" : "Record Voice Message"}
        >
          {isRecording ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
        {isRecording ? (
          <div className="recording-status">Recording audio... Click stop to send.</div>
        ) : (
          <div className="message-input-wrapper">
            <textarea
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="message-input"
              id="message-input"
              rows={1}
              disabled={sendingMessage}
            />
          </div>
        )}
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
