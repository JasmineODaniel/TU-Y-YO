import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, register, loading, error, clearError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [keyGenStatus, setKeyGenStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!username.trim() || !password.trim()) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (isRegister) {
      if (username.length < 3) {
        setLocalError('Username must be at least 3 characters');
        return;
      }
      const usernameRegex = /^[a-zA-Z0-9_-]+$/;
      if (!usernameRegex.test(username.trim())) {
        setLocalError('Username may only contain letters, digits, _ and - (no spaces or @ allowed)');
        return;
      }
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
      if (!displayName.trim()) {
        setLocalError('Display name is required');
        return;
      }
      try {
        setKeyGenStatus('Generating encryption keys...');
        await register(username.trim(), displayName.trim(), password);
      } catch {
        setKeyGenStatus('');
      }
    } else {
      try {
        setKeyGenStatus('Decrypting your keys...');
        await login(username.trim(), password);
      } catch {
        setKeyGenStatus('');
      }
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setLocalError('');
    clearError();
    setKeyGenStatus('');
  };

  const displayError = localError || error;

  return (
    <div className="login-page">
      <div className="login-particles">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${3 + Math.random() * 4}s`,
          }} />
        ))}
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="60" height="40" viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 20 H 26" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
              <path d="M20 14 C 28 14 28 26 20 26" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
              <path d="M55 20 H 34" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
              <path d="M40 14 C 32 14 32 26 40 26" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
              <circle cx="30" cy="20" r="2" fill="var(--accent-hover)" />
            </svg>
          </div>
          <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontStyle: "italic", textTransform: "uppercase", letterSpacing: "2px", fontWeight: 900 }}>TU-Y-YO</h1>
          <p className="login-subtitle">End-to-end encrypted messaging</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" id="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <i className="fa-regular fa-user input-icon"></i>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                maxLength={32}
                disabled={loading}
              />
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <div className="input-wrapper">
                <i className="fa-regular fa-id-badge input-icon"></i>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  maxLength={128}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-lock input-icon"></i>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isRegister ? 'Min 8 characters' : 'Enter your password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                maxLength={128}
                disabled={loading}
              />
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-shield-halved input-icon"></i>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  maxLength={128}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {displayError && (
            <div className="form-error" role="alert">
              <i className="fa-solid fa-circle-exclamation"></i>
              {displayError}
            </div>
          )}

          {keyGenStatus && !displayError && (
            <div className="form-status">
              <div className="key-spinner" />
              {keyGenStatus}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            id="auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <div className="btn-loading">
                <div className="btn-spinner" />
                {isRegister ? 'Creating Account...' : 'Signing In...'}
              </div>
            ) : (
              isRegister ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              className="link-btn"
              onClick={toggleMode}
              disabled={loading}
              id="toggle-auth-mode"
            >
              {isRegister ? 'Sign In' : 'Create Account'}
            </button>
          </p>
        </div>

        <div className="encryption-badge">
          <i className="fa-solid fa-lock"></i>
          End-to-end encrypted
        </div>
      </div>
    </div>
  );
}
