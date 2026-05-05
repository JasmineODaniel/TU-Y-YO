import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { CircleUser, MessageSquarePlus, Settings, LogOut, MoreVertical, Search } from 'lucide-react';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import CallOverlay from '../components/CallOverlay';
import ProfileModal from '../components/ProfileModal';

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { activeChat, wsStatus } = useChat();
  const [showProfile, setShowProfile] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const getInitials = (name) => {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  return (
    <div className="chat-page" style={{ background: 'var(--bg-primary)', display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside className={`sidebar ${activeChat ? 'sidebar-hidden-mobile' : ''}`} style={{ 
        width: '400px', 
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)'
      }}>
        {/* WhatsApp Style Sidebar Header */}
        <div className="sidebar-header" style={{ 
          background: 'var(--bg-header)', 
          padding: '10px 16px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          height: '60px'
        }}>
          <div className="avatar avatar-sm" 
            onClick={() => setShowProfile(true)}
            style={{ 
              cursor: 'pointer',
              background: user?.profilePic ? `url(${user.profilePic}) center/cover` : 'var(--accent-gradient)',
              width: '40px',
              height: '40px'
            }}
          >
            {!user?.profilePic && getInitials(user?.display_name)}
          </div>

          <div style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)' }}>
            <button className="icon-btn" onClick={() => setShowProfile(true)} title="Settings">
              <Settings size={20} />
            </button>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setShowMenu(!showMenu)} title="Menu">
                <MoreVertical size={20} />
              </button>
              {showMenu && (
                <div className="dropdown-menu" style={{
                  position: 'absolute',
                  top: '100%',
                  right: '0',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 100,
                  width: '150px',
                  marginTop: '5px'
                }}>
                  <button className="menu-item" onClick={() => { logout(); setShowMenu(false); }} style={{
                    width: '100%',
                    padding: '10px 15px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar - WhatsApp Style */}
        <div style={{ padding: '8px 16px', background: 'var(--bg-primary)' }}>
          <div style={{ 
            background: 'var(--bg-secondary)', 
            borderRadius: 'var(--radius-md)', 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0 12px',
            height: '35px'
          }}>
            <Search size={16} style={{ color: 'var(--text-tertiary)', marginRight: '10px' }} />
            <input 
              type="text" 
              placeholder="Search or start new chat" 
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '14px',
                width: '100%',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <ConversationList />
      </aside>

      {/* Chat Area */}
      <main className={`chat-main ${!activeChat ? 'chat-main-hidden-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeChat ? (
          <ChatWindow />
        ) : (
          <div className="empty-chat" style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
            borderBottom: '6px solid var(--accent)'
          }}>
            <div className="empty-chat-content" style={{ textAlign: 'center', maxWidth: '400px' }}>
              <div className="logo-placeholder" style={{ marginBottom: '20px', opacity: 0.5 }}>
                <svg width="80" height="50" viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 20 H 26" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  <path d="M20 14 C 28 14 28 26 20 26" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  <path d="M55 20 H 34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  <path d="M40 14 C 32 14 32 26 40 26" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="30" cy="20" r="2" fill="currentColor" />
                </svg>
              </div>
              <h2 style={{ fontFamily: "'Michroma', sans-serif", fontSize: '1.5rem', marginBottom: '10px' }}>TU-Y-YO</h2>
              <p style={{ fontSize: '14px' }}>Send and receive end-to-end encrypted messages.</p>
              <div className="encryption-badge" style={{ marginTop: '30px', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                <i className="fa-solid fa-lock" style={{ fontSize: '12px' }}></i>
                <span>End-to-end encrypted</span>
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
