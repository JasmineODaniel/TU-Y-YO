import { useState, useCallback } from 'react';
import { useChat } from '../contexts/ChatContext';
import UserSearch from './UserSearch';

export default function ConversationList() {
  const { conversations, activeChat, openChat, loadingConvos, unreadCounts } = useChat();
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
    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleSelectUser = useCallback((user) => {
    openChat(user.id, user.display_name, user.username);
    setShowSearch(false);
  }, [openChat]);

  return (
    <div className="conversation-list" style={{ flex: 1, overflowY: 'auto' }}>
      {/* New Chat Button */}
      <div style={{
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'flex-end',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <button
          onClick={() => setShowSearch(!showSearch)}
          title="New conversation"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseOut={e => e.currentTarget.style.background = 'none'}
        >
          <i className="fa-solid fa-pen-to-square" style={{ fontSize: '18px', color: '#ffffff' }} />
        </button>
      </div>

      {showSearch && (
        <UserSearch onSelectUser={handleSelectUser} onClose={() => setShowSearch(false)} />
      )}

      {loadingConvos && conversations.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>
          <div className="spinner" style={{ margin: '0 auto 10px' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading chats...</span>
        </div>
      )}

      {!loadingConvos && conversations.length === 0 && !showSearch && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <i className="fa-solid fa-comments" style={{ fontSize: '36px', marginBottom: '12px', display: 'block', opacity: 0.4 }} />
          <p style={{ fontSize: '14px', marginBottom: '10px' }}>No chats yet</p>
          <button
            onClick={() => setShowSearch(true)}
            style={{ color: 'var(--accent-hover)', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            Start a new chat
          </button>
        </div>
      )}

      <div>
        {conversations.map(convo => {
          const unread = unreadCounts?.[convo.user_id] || 0;
          return (
            <button
              key={convo.user_id}
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
                transition: 'background 0.2s',
              }}
              onMouseOver={e => { if (activeChat?.userId !== convo.user_id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseOut={e => { if (activeChat?.userId !== convo.user_id) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                background: convo.profile_pic ? `url(${convo.profile_pic}) center/cover` : 'var(--accent-gradient)',
                width: '49px',
                height: '49px',
                borderRadius: '50%',
                marginRight: '15px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff',
              }}>
                {!convo.profile_pic && getInitials(convo.display_name)}
              </div>

              <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <span style={{
                    color: '#ffffff',
                    fontWeight: unread > 0 ? '600' : '500',
                    fontSize: '16px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {convo.display_name}
                  </span>
                  <span style={{ color: unread > 0 ? '#a855f7' : 'var(--text-tertiary)', fontSize: '12px', flexShrink: 0, marginLeft: '8px' }}>
                    {formatTime(convo.last_message_at)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    color: unread > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    @{convo.username}
                  </span>

                  {unread > 0 ? (
                    <span style={{
                      background: '#7c3aed',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '700',
                      minWidth: '20px',
                      height: '20px',
                      borderRadius: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 5px',
                      flexShrink: 0,
                      marginLeft: '6px',
                    }}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  ) : (
                    <i className="fa-solid fa-lock" style={{ fontSize: '11px', color: 'var(--text-tertiary)', opacity: 0.4 }} />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
