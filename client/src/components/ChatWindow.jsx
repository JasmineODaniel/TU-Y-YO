import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { Video, Phone, MoreVertical, Search, Smile, Paperclip, Mic, Send, ChevronLeft, Lock } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import MessageBubble from './MessageBubble';

export default function ChatWindow() {
  const { user } = useAuth();
  const { activeChat, messages, loadingMessages, sendingMessage, sendEncryptedMessage, setActiveChat, activeTypers, sendTypingSignal, initiateCall } = useChat();
  const [inputText, setInputText] = useState('');
  const [sendError, setSendError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    sendTypingSignal(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingSignal(false);
    }, 2000);
  };

  const onEmojiClick = (emojiData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sendingMessage) return;
    const text = inputText.trim();
    setInputText('');
    setSendError('');
    setShowEmojiPicker(false);
    sendTypingSignal(false);
    try {
      await sendEncryptedMessage(text);
    } catch (err) {
      setSendError('Failed to send. ' + err.message);
      setInputText(text);
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
    <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      <div className="chat-header" style={{ 
        background: 'var(--bg-header)', 
        padding: '10px 16px', 
        display: 'flex', 
        alignItems: 'center', 
        height: '60px',
        color: 'white'
      }}>
        <button className="back-btn mobile-only" onClick={() => setActiveChat(null)} style={{ background: 'none', border: 'none', color: 'white', marginRight: '10px' }}>
          <ChevronLeft size={24} />
        </button>
        <div className="avatar avatar-sm" style={{
          background: activeChat.profile_pic ? `url(${activeChat.profile_pic}) center/cover` : 'var(--accent-gradient)',
          width: '40px',
          height: '40px',
          marginRight: '12px'
        }}>
          {!activeChat.profile_pic && getInitials(activeChat.displayName)}
        </div>
        <div className="chat-header-info" style={{ flex: 1 }}>
          <div style={{ fontWeight: '500', fontSize: '16px' }}>{activeChat.displayName}</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            {activeTypers && activeTypers.has(activeChat.userId) ? 'typing...' : `@${activeChat.username}`}
          </div>
        </div>
        <div className="chat-header-actions" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button className="icon-btn" onClick={() => initiateCall(activeChat.userId)} title="Video Call" style={{ color: 'white' }}>
            <Video size={20} />
          </button>
          <button className="icon-btn" title="Voice Call" style={{ color: 'white' }}>
            <Phone size={20} />
          </button>
          <button className="icon-btn" title="More" style={{ color: 'white' }}>
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      <div className="messages-container" ref={messagesContainerRef} style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '20px', 
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {loadingMessages && (
          <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>
            <div className="spinner" style={{ margin: '0 auto 10px' }} />
            <span>Decrypting messages...</span>
          </div>
        )}

        {!loadingMessages && messages.length === 0 && (
          <div style={{ textAlign: 'center', margin: '40px auto', maxWidth: '300px', background: 'var(--bg-secondary)', padding: '15px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>
              <Lock size={24} style={{ margin: '0 auto' }} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Messages are end-to-end encrypted.</p>
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

      <div className="chat-footer" style={{ background: 'var(--bg-header)', padding: '10px 16px', position: 'relative' }}>
        {showEmojiPicker && (
          <div ref={emojiPickerRef} style={{ position: 'absolute', bottom: '100%', left: '16px', zIndex: 1000 }}>
            <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" width={300} height={400} />
          </div>
        )}
        
        {sendError && (
          <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>
            {sendError}
          </div>
        )}

        <form className="message-input-bar" onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile size={24} />
            </button>
            <button type="button" className="icon-btn">
              <Paperclip size={24} />
            </button>
          </div>

          <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: '20px', padding: '5px 15px', display: 'flex', alignItems: 'center' }}>
            <textarea
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                flex: 1,
                fontSize: '15px',
                outline: 'none',
                resize: 'none',
                maxHeight: '100px',
                padding: '8px 0'
              }}
              rows={1}
              disabled={sendingMessage}
            />
          </div>

          <button
            type="button"
            className={`icon-btn ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            <Mic size={24} />
          </button>

          {inputText.trim() && (
            <button
              type="submit"
              className="icon-btn"
              disabled={sendingMessage}
              style={{ background: 'white', borderRadius: '50%', padding: '8px' }}
            >
              {sendingMessage ? <div className="spinner spinner-sm" /> : <Send size={20} />}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
