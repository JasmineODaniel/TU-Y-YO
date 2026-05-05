import { useState, useEffect, useRef } from 'react';
import * as api from '../lib/api';
import { Search, X } from 'lucide-react';

export default function UserSearch({ onSelectUser, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const users = await api.searchUsers(query.trim());
        setResults(users);
      } catch (err) {
        setError(err.message);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const getInitials = (name) => {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  return (
    <div className="user-search" style={{ 
      padding: '10px 16px', 
      background: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border-light)'
    }}>
      <div className="search-input-wrapper" style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        height: '40px'
      }}>
        <Search size={18} style={{ color: 'var(--text-tertiary)', marginRight: '10px' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name or username..."
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '14px',
            width: '100%',
            outline: 'none'
          }}
        />
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      {searching && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
          Searching...
        </div>
      )}

      {error && <div style={{ padding: '10px', color: 'var(--danger)', textAlign: 'center', fontSize: '13px' }}>{error}</div>}

      {!searching && query.trim() && results.length === 0 && !error && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>No users found</div>
      )}

      <div className="search-results" style={{ marginTop: '10px', maxHeight: '300px', overflowY: 'auto' }}>
        {results.map(user => (
          <button
            key={user.id}
            onClick={() => onSelectUser(user)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '10px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <div className="avatar avatar-sm" style={{
              background: user.profilePic ? `url(${user.profilePic}) center/cover` : 'var(--accent-gradient)',
              width: '40px',
              height: '40px',
              marginRight: '12px'
            }}>
              {!user.profilePic && getInitials(user.display_name)}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{user.display_name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>@{user.username}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
