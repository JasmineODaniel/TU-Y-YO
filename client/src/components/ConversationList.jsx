import { useState, useCallback } from 'react';
import { useChat } from '../contexts/ChatContext';
import { MessageSquarePlus, Lock } from 'lucide-react';
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

  const handleSelectUser = useCallback((user) => {
    openChat(user.id, user.display_name, user.username);
    setShowSearch(false);
  }, [openChat]);

  return (
    <div className="conversation-list" style={{ flex: 1, overflowY: 'auto' }}>
      <div className="convo-list-actions" style={{ 
        padding: '10px 16px', 
        display: 'flex', 
        justifyContent: 'flex-end',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <button
          className="icon-btn"
          onClick={() => setShowSearch(!showSearch)}
          title="New conversation"
        >
          <MessageSquarePlus size={20} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {showSearch && (
        <UserSearch onSelectUser={handleSelectUser} onClose={() => setShowSearch(false)} />
      )}

      {loadingConvos && conversations.length === 0 && (
        <div className="convo-loading" style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>
          <div className="spinner" style={{ margin: '0 auto 10px' }} />
          <span style={{ fontSize: '14px' }}>Loading chats...</span>
        </div>
      )}

      {!loadingConvos && conversations.length === 0 && (
        <div className="convo-empty" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <p style={{ fontSize: '14px', marginBottom: '10px' }}>No chats yet</p>
          <button className="link-btn" onClick={() => setShowSearch(true)} style={{ color: 'var(--accent)', fontWeight: '600' }}>Start a new chat</button>
        </div>
      )}

      <div className="convo-items">
        {conversations.map(convo => (
          <button
            key={convo.user_id}
            className={`convo-item ${activeChat?.userId === convo.user_id ? 'convo-active' : ''}`}
            onClick={() => openChat(convo.user_id, convo.display_name, convo.username)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              border: 'none',
              background: activeChat?.userId === convo.user_id ? 'var(--bg-active)' : 'transparent',
              cursor: 'pointer',
              borderBottom: '1px solid var(--border-light)',
              transition: 'background 0.2s'
            }}
          >
            <div className="avatar" style={{ 
              background: convo.profile_pic ? `url(${convo.profile_pic}) center/cover` : 'var(--accent-gradient)',
              width: '49px',
              height: '49px',
              marginRight: '15px',
              flexShrink: 0
            }}>
              {!convo.profile_pic && getInitials(convo.display_name)}
            </div>
            <div className="convo-info" style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
              <div className="convo-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <span className="convo-name" style={{ 
                  color: 'var(--text-primary)', 
                  fontWeight: '500', 
                  fontSize: '16px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>{convo.display_name}</span>
                <span className="convo-time" style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{formatTime(convo.last_message_at)}</span>
              </div>
              <div className="convo-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="convo-preview" style={{ 
                  color: 'var(--text-secondary)', 
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>@{convo.username}</span>
                <Lock size={12} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
