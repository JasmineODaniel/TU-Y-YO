import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import CallOverlay from '../components/CallOverlay';
import ProfileModal from '../components/ProfileModal';

export default function ChatPage() {
  const { user } = useAuth();
  const { activeChat, wsStatus } = useChat();
  const [showProfile, setShowProfile] = useState(false);

  const getInitials = (name) => {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  return (
    <div className="chat-page">
      {/* Sidebar */}
      <aside className={`sidebar ${activeChat ? 'sidebar-hidden-mobile' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-user-info" style={{ cursor: 'pointer', flex: 1 }} onClick={() => setShowProfile(true)} title="View Profile">
            <div className="avatar avatar-sm" style={{ 
              background: user?.profilePic ? `url(${user.profilePic}) center/cover` : 'var(--accent-gradient)' 
            }}>
              {!user?.profilePic && getInitials(user?.display_name)}
            </div>
            <div className="sidebar-user-text">
              <span className="sidebar-display-name">{user?.display_name}</span>
              <span className="sidebar-connection-status">
                <span className={`status-dot ${wsStatus === 'connected' ? 'status-online' : wsStatus === 'reconnecting' ? 'status-reconnecting' : 'status-offline'}`} />
                {wsStatus === 'connected' ? 'Connected' : wsStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
              </span>
            </div>
          </div>
          <button className="icon-btn" onClick={() => setShowProfile(true)} title="Settings" id="settings-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
        <ConversationList />
      </aside>

      {/* Chat Area */}
      <main className={`chat-main ${!activeChat ? 'chat-main-hidden-mobile' : ''}`}>
        {activeChat ? (
          <ChatWindow />
        ) : (
          <div className="empty-chat">
            <div className="empty-chat-content">
              <div className="empty-chat-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontStyle: "italic", textTransform: "uppercase", letterSpacing: "2px", fontWeight: 900 }}>TU-Y-YO</h2>
              <p>Select a conversation or search for a user to start messaging.</p>
              <div className="empty-chat-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                All messages are end-to-end encrypted
              </div>
            </div>
          </div>
        )}
      </main>
      <CallOverlay />
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
