import { useState, useEffect, useRef } from 'react';
import * as api from '../lib/api';

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
    <div className="user-search" id="user-search">
      <div className="search-input-wrapper">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search users..."
          className="search-input"
          id="user-search-input"
        />
        <button className="search-close-btn" onClick={onClose} title="Close search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {searching && (
        <div className="search-status">
          <div className="spinner spinner-sm" />
          Searching...
        </div>
      )}

      {error && <div className="search-error">{error}</div>}

      {!searching && query.trim() && results.length === 0 && !error && (
        <div className="search-empty">No users found</div>
      )}

      <div className="search-results">
        {results.map(user => (
          <button
            key={user.id}
            className="search-result-item"
            onClick={() => onSelectUser(user)}
            id={`search-result-${user.id}`}
          >
            <div className="avatar avatar-sm" style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            }}>
              {getInitials(user.display_name)}
            </div>
            <div className="search-result-info">
              <span className="search-result-name">{user.display_name}</span>
              <span className="search-result-username">@{user.username}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
