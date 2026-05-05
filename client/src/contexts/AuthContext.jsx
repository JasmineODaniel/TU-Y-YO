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

  useEffect(() => {
    api.setOnTokenRefreshFailed(() => {
      handleLogout();
    });
  }, []);

  const scheduleRefresh = useCallback((expiresIn) => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    const interval = Math.max((expiresIn - 60) * 1000, 60000);
    refreshTimerRef.current = setInterval(async () => {
      try { await api.refreshToken(); } catch { handleLogout(); }
    }, interval);
  }, []);

  const handleRegister = useCallback(async (username, displayName, password) => {
    setLoading(true);
    setError(null);
    try {
      const keyPair = await crypto.generateKeyPair();
      const salt = crypto.generatePBKDF2Salt();
      const wrappingKey = await crypto.deriveWrappingKey(password, salt);
      const wrappedPrivateKey = await crypto.wrapPrivateKey(keyPair.privateKey, wrappingKey);
      const publicKey = await crypto.exportPublicKey(keyPair.publicKey);
      const result = await api.register({
        username,
        display_name: displayName,
        password,
        public_key: publicKey,
        wrapped_private_key: wrappedPrivateKey,
        pbkdf2_salt: salt,
      });
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
      const result = await api.login(username, password);
      const { wrapped_private_key, pbkdf2_salt, public_key } = result.user;
      const wrappingKey = await crypto.deriveWrappingKey(password, pbkdf2_salt);
      const privateKey = await crypto.unwrapPrivateKey(wrapped_private_key, wrappingKey);
      const pubKey = await crypto.importPublicKey(public_key);
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
    } catch { }
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
      setProfilePic: async (base64) => {
        if (user) {
          try {
            await api.updateProfilePic(base64);
            setUser(prev => ({ ...prev, profilePic: base64 }));
            localStorage.setItem(`profile_pic_${user.id}`, base64);
          } catch (err) {
            console.error('Profile pic upload error', err);
          }
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
}
