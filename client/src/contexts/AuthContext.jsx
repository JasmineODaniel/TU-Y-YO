import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as api from '../lib/api';
import * as crypto from '../lib/crypto';
import * as keystore from '../lib/keystore';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cryptoReady, setCryptoReady] = useState(false);
  const refreshTimerRef = useRef(null);

  // Set up token refresh failure handler
  useEffect(() => {
    api.setOnTokenRefreshFailed(() => {
      handleLogout();
    });
  }, []);

  // Schedule auto token refresh
  const scheduleRefresh = useCallback((expiresIn) => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    // Refresh every (expiresIn - 60) seconds
    const interval = Math.max((expiresIn - 60) * 1000, 60000);
    refreshTimerRef.current = setInterval(async () => {
      try { await api.refreshToken(); } catch { handleLogout(); }
    }, interval);
  }, []);

  const handleRegister = useCallback(async (username, displayName, password) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Generate RSA-OAEP keypair
      const keyPair = await crypto.generateKeyPair();
      // 2. Generate PBKDF2 salt
      const salt = crypto.generatePBKDF2Salt();
      // 3. Derive wrapping key from password
      const wrappingKey = await crypto.deriveWrappingKey(password, salt);
      // 4. Wrap private key
      const wrappedPrivateKey = await crypto.wrapPrivateKey(keyPair.privateKey, wrappingKey);
      // 5. Export public key
      const publicKey = await crypto.exportPublicKey(keyPair.publicKey);
      // 6. Register with API
      const result = await api.register({
        username,
        display_name: displayName,
        password,
        public_key: publicKey,
        wrapped_private_key: wrappedPrivateKey,
        pbkdf2_salt: salt,
      });
      // 7. Store keys in IndexedDB
      // For the private key after registration, we need to create a non-extractable version
      const unwrapped = await crypto.unwrapPrivateKey(wrappedPrivateKey, wrappingKey);
      await keystore.storePrivateKey(unwrapped);
      await keystore.storePublicKey(keyPair.publicKey);
      setUser(result.user);
      setCryptoReady(true);
      scheduleRefresh(result.expires_in);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [scheduleRefresh]);

  const handleLogin = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Login to get tokens + user profile with key material
      const result = await api.login(username, password);
      const { wrapped_private_key, pbkdf2_salt, public_key } = result.user;
      // 2. Derive wrapping key from password + stored salt
      const wrappingKey = await crypto.deriveWrappingKey(password, pbkdf2_salt);
      // 3. Unwrap private key
      const privateKey = await crypto.unwrapPrivateKey(wrapped_private_key, wrappingKey);
      // 4. Import public key
      const pubKey = await crypto.importPublicKey(public_key);
      // 5. Store keys in IndexedDB
      await keystore.storePrivateKey(privateKey);
      await keystore.storePublicKey(pubKey);
      setUser(result.user);
      setCryptoReady(true);
      scheduleRefresh(result.expires_in);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [scheduleRefresh]);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch { /* ignore */ }
    await keystore.clearKeys();
    setUser(null);
    setCryptoReady(false);
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      user: user ? { ...user, profilePic: localStorage.getItem(`profile_pic_${user.id}`) } : null,
      loading,
      error,
      cryptoReady,
      login: handleLogin,
      register: handleRegister,
      logout: handleLogout,
      clearError,
      setProfilePic: (base64) => {
        if (user) {
          localStorage.setItem(`profile_pic_${user.id}`, base64);
          setUser({ ...user }); // trigger re-render
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
}
