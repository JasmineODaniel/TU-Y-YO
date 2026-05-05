import { useState, useCallback } from 'react';
import { useChat } from '../contexts/ChatContext';
import UserSearch from './UserSearch';

export default function ConversationList() {
  const { conversations, activeChat, openChat, loadingConvos } = useChat();
  const [showSearch, setShowSearch] = useState(false);

  const getInitials = (name) => {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const avatarColors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  ];

  const getAvatarColor = (name) => {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const handleSelectUser = useCallback((user) => {
    openChat(user.id, user.display_name, user.username);
    setShowSearch(false);
  }, [openChat]);

  return (
    <div className="conversation-list" id="conversation-list">
      <div className="convo-list-header">
        <h2>Messages</h2>
        <button
          className="icon-btn"
          onClick={() => setShowSearch(!showSearch)}
          title="New conversation"
          id="new-chat-btn"
        >
          <i className="fa-solid fa-pen-to-square"></i>
        </button>
      </div>

      {showSearch && (
        <UserSearch onSelectUser={handleSelectUser} onClose={() => setShowSearch(false)} />
      )}

      {loadingConvos && conversations.length === 0 && (
        <div className="convo-loading">
          <div className="spinner" />
          <span>Loading conversations...</span>
        </div>
      )}

      {!loadingConvos && conversations.length === 0 && (
        <div className="convo-empty">
          <i className="fa-regular fa-comments fa-3x" style={{ opacity: 0.4 }}></i>
          <p>No conversations yet</p>
          <button className="link-btn" onClick={() => setShowSearch(true)}>Start a new chat</button>
        </div>
      )}

      <div className="convo-items">
        {conversations.map(convo => (
          <button
            key={convo.user_id}
            className={`convo-item ${activeChat?.userId === convo.user_id ? 'convo-active' : ''}`}
            onClick={() => openChat(convo.user_id, convo.display_name, convo.username)}
            id={`convo-${convo.user_id}`}
          >
            <div className="avatar" style={{ background: getAvatarColor(convo.display_name) }}>
              {getInitials(convo.display_name)}
            </div>
            <div className="convo-info">
              <div className="convo-top">
                <span className="convo-name">{convo.display_name}</span>
                <span className="convo-time">{formatTime(convo.last_message_at)}</span>
              </div>
              <div className="convo-bottom">
                <span className="convo-username">@{convo.username}</span>
                <i className="fa-solid fa-lock" style={{ opacity: 0.4, fontSize: '10px' }}></i>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
