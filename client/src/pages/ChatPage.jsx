import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { activeChat, wsStatus, setActiveChat } = useChat();

  const getInitials = (name) => {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  return (
    <div className="chat-page">
      {/* Sidebar */}
      <aside className={`sidebar ${activeChat ? 'sidebar-hidden-mobile' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-user-info">
            <div className="avatar avatar-sm" style={{ background: 'var(--accent-gradient)' }}>
              {getInitials(user?.display_name)}
            </div>
            <div className="sidebar-user-text">
              <span className="sidebar-display-name">{user?.display_name}</span>
              <span className="sidebar-connection-status">
                <span className={`status-dot ${wsStatus === 'connected' ? 'status-online' : wsStatus === 'reconnecting' ? 'status-reconnecting' : 'status-offline'}`} />
                {wsStatus === 'connected' ? 'Connected' : wsStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
              </span>
            </div>
          </div>
          <button className="icon-btn" onClick={logout} title="Sign out" id="logout-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
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
              <h2>TU-Y-YO</h2>
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
    </div>
  );
}
