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
            <i className="fa-solid fa-xmark fa-lg"></i>
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
            <i className="fa-solid fa-camera"></i>
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
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
          Sign Out
        </button>
      </div>
    </div>
  );
}
