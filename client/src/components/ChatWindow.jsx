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
          <i className="fa-solid fa-chevron-left"></i>
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
            <i className="fa-solid fa-video"></i>
          </button>
          <div className="chat-header-badge">
            <i className="fa-solid fa-lock"></i>
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
              <i className="fa-solid fa-lock fa-3x" style={{ opacity: 0.3 }}></i>
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
          <i className="fa-solid fa-circle-exclamation"></i>
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
            <i className="fa-solid fa-square" style={{ color: 'var(--danger)' }}></i>
          ) : (
            <i className="fa-solid fa-microphone"></i>
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
            <i className="fa-regular fa-paper-plane"></i>
          )}
        </button>
      </form>
    </div>
  );
}
