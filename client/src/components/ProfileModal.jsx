import { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileModal({ onClose }) {
  const { user, logout, setProfilePic } = useAuth();
  const fileInputRef = useRef(null);

  const getInitials = (name) => {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePic(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="call-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="call-modal" onClick={e => e.stopPropagation()} style={{ width: '340px', padding: '30px' }}>
        
        <div className="profile-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px' }}>Profile Settings</h2>
          <button className="search-close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="profile-pic-container" style={{ position: 'relative', marginTop: '20px' }}>
          <div className="avatar" style={{ 
            width: '120px', height: '120px', fontSize: '32px',
            background: user?.profilePic ? `url(${user.profilePic}) center/cover` : 'var(--accent-gradient)' 
          }}>
            {!user?.profilePic && getInitials(user?.display_name)}
          </div>
          <button 
            className="btn-icon" 
            style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--accent)', color: 'white', borderRadius: '50%', padding: '10px' }}
            onClick={() => fileInputRef.current?.click()}
            title="Upload Profile Picture (Local Only)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
        </div>
        
        <div className="profile-info" style={{ textAlign: 'center', marginTop: '10px' }}>
          <h3 style={{ fontSize: '20px' }}>{user?.display_name}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>@{user?.username}</p>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', marginTop: '10px', width: '100%' }}>
          Note: Profile pictures are stored locally in your browser to maintain strict privacy and save server space.
        </div>

        <button 
          className="btn-primary" 
          onClick={logout} 
          style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--danger)', color: 'white' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}
