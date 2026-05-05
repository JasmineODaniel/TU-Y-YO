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
        <div className="sidebar-header" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '20px' }}>
          {/* Logo and Name Top Left */}
          <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
            <svg width="40" height="26" viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 20 H 26" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
              <path d="M20 14 C 28 14 28 26 20 26" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
              <path d="M55 20 H 34" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
              <path d="M40 14 C 32 14 32 26 40 26" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
              <circle cx="30" cy="20" r="2" fill="var(--accent-hover)" />
            </svg>
            <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontStyle: "italic", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 900, fontSize: '18px', margin: 0 }}>TU-Y-YO</h1>
          </div>

          <div style={{ display: 'flex', width: '100%', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--accent)' }}>
            <div className="sidebar-user-info" style={{ cursor: 'pointer', flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }} onClick={() => setShowProfile(true)} title="View Profile">
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
              <i className="fa-solid fa-gear"></i>
            </button>
          </div>
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
              <div className="network-basket">
                <div className="basket-ring"></div>
                <div className="basket-ring"></div>
                <div className="basket-ring"></div>
                <div className="basket-core"></div>
              </div>
              <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontStyle: "italic", textTransform: "uppercase", letterSpacing: "2px", fontWeight: 900, marginTop: '20px' }}>TU-Y-YO</h2>
              <p>Select a conversation or search for a user to start messaging.</p>
              <div className="empty-chat-badge">
                <i className="fa-solid fa-lock"></i>
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
