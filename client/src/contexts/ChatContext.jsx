import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as api from '../lib/api';
import * as crypto from '../lib/crypto';
import * as keystore from '../lib/keystore';
import { wsManager } from '../lib/websocket';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

export function ChatProvider({ children }) {
  const { user, cryptoReady } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // { userId, displayName, username }
  const [messages, setMessages] = useState([]); // decrypted messages for active chat
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const publicKeyCache = useRef(new Map());
  const hasMoreMessages = useRef(true);

  // Connect WebSocket when crypto is ready
  useEffect(() => {
    if (!cryptoReady || !user) return;
    const token = api.getAccessToken();
    if (token) wsManager.connect(token);
    return () => wsManager.disconnect();
  }, [cryptoReady, user]);

  // Listen for WS connection status
  useEffect(() => {
    const unsub = wsManager.on('connection', (data) => {
      setWsStatus(data.status);
    });
    return unsub;
  }, []);

  // Listen for incoming messages
  useEffect(() => {
    if (!cryptoReady || !user) return;
    const unsub = wsManager.on('message', async (msg) => {
      // Decrypt and add to active chat if relevant
      try {
        const privateKey = await keystore.getPrivateKey();
        if (!privateKey) return;
        const isSender = msg.from_user_id === user.id;
        const decryptedText = await crypto.decryptMessage(msg.payload, privateKey, isSender);
        const decryptedMsg = {
          id: msg.id,
          fromUserId: msg.from_user_id,
          toUserId: msg.to_user_id,
          text: decryptedText,
          createdAt: msg.created_at,
          delivered: msg.delivered,
        };

        // Add to active chat if it's the current conversation
        const partnerId = isSender ? msg.to_user_id : msg.from_user_id;
        setActiveChat(prev => {
          if (prev && prev.userId === partnerId) {
            setMessages(msgs => {
              if (msgs.some(m => m.id === msg.id)) return msgs;
              return [...msgs, decryptedMsg];
            });
          }
          return prev;
        });

        // Update conversations list
        loadConversations();
      } catch (err) {
        console.error('Failed to decrypt incoming message:', err);
      }
    });
    return unsub;
  }, [cryptoReady, user]);

  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);
    try {
      const convos = await api.getConversations();
      setConversations(convos);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    if (cryptoReady && user) loadConversations();
  }, [cryptoReady, user, loadConversations]);

  const getRecipientPublicKey = useCallback(async (userId) => {
    if (publicKeyCache.current.has(userId)) {
      return publicKeyCache.current.get(userId);
    }
    const { public_key } = await api.getUserPublicKey(userId);
    const imported = await crypto.importPublicKey(public_key);
    publicKeyCache.current.set(userId, imported);
    return imported;
  }, []);

  const openChat = useCallback(async (userId, displayName, username) => {
    setActiveChat({ userId, displayName, username });
    setMessages([]);
    setLoadingMessages(true);
    hasMoreMessages.current = true;
    try {
      const rawMsgs = await api.getMessages(userId);
      const privateKey = await keystore.getPrivateKey();
      if (!privateKey) throw new Error('Private key not found');
      const decrypted = [];
      for (const msg of rawMsgs.reverse()) {
        try {
          const isSender = msg.from_user_id === user.id;
          const text = await crypto.decryptMessage(msg.payload, privateKey, isSender);
          decrypted.push({
            id: msg.id,
            fromUserId: msg.from_user_id,
            toUserId: msg.to_user_id,
            text,
            createdAt: msg.created_at,
            delivered: msg.delivered,
          });
        } catch {
          decrypted.push({
            id: msg.id,
            fromUserId: msg.from_user_id,
            toUserId: msg.to_user_id,
            text: '🔒 Unable to decrypt this message',
            createdAt: msg.created_at,
            delivered: msg.delivered,
            decryptionFailed: true,
          });
        }
      }
      setMessages(decrypted);
      if (rawMsgs.length < 50) hasMoreMessages.current = false;
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, [user]);

  const loadMoreMessages = useCallback(async () => {
    if (!activeChat || !hasMoreMessages.current || loadingMessages) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingMessages(true);
    try {
      const rawMsgs = await api.getMessages(activeChat.userId, 50, oldest.createdAt);
      const privateKey = await keystore.getPrivateKey();
      if (!privateKey) return;
      const decrypted = [];
      for (const msg of rawMsgs.reverse()) {
        try {
          const isSender = msg.from_user_id === user.id;
          const text = await crypto.decryptMessage(msg.payload, privateKey, isSender);
          decrypted.push({
            id: msg.id, fromUserId: msg.from_user_id, toUserId: msg.to_user_id,
            text, createdAt: msg.created_at, delivered: msg.delivered,
          });
        } catch {
          decrypted.push({
            id: msg.id, fromUserId: msg.from_user_id, toUserId: msg.to_user_id,
            text: '🔒 Unable to decrypt', createdAt: msg.created_at,
            delivered: msg.delivered, decryptionFailed: true,
          });
        }
      }
      setMessages(prev => [...decrypted, ...prev]);
      if (rawMsgs.length < 50) hasMoreMessages.current = false;
    } finally {
      setLoadingMessages(false);
    }
  }, [activeChat, messages, loadingMessages, user]);

  const sendEncryptedMessage = useCallback(async (text) => {
    if (!activeChat || !text.trim()) return;
    setSendingMessage(true);
    try {
      const recipientPubKey = await getRecipientPublicKey(activeChat.userId);
      const senderPubKey = await keystore.getPublicKey();
      if (!senderPubKey) throw new Error('Sender public key not found');
      const payload = await crypto.encryptMessage(text, recipientPubKey, senderPubKey);
      // Try WebSocket first, fallback to REST
      const sent = wsManager.send('message.send', { to: activeChat.userId, payload });
      let msgResponse;
      if (!sent) {
        msgResponse = await api.sendMessage(activeChat.userId, payload);
      }
      // Add to local messages immediately
      const newMsg = {
        id: msgResponse?.id || crypto.arrayBufferToBase64(crypto.base64ToArrayBuffer(btoa(Date.now().toString()))),
        fromUserId: user.id,
        toUserId: activeChat.userId,
        text,
        createdAt: new Date().toISOString(),
        delivered: false,
      };
      setMessages(prev => [...prev, newMsg]);
      loadConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    } finally {
      setSendingMessage(false);
    }
  }, [activeChat, user, getRecipientPublicKey, loadConversations]);

  return (
    <ChatContext.Provider value={{
      conversations, activeChat, messages, wsStatus,
      loadingConvos, loadingMessages, sendingMessage,
      openChat, sendEncryptedMessage, loadMoreMessages,
      loadConversations, setActiveChat,
    }}>
      {children}
    </ChatContext.Provider>
  );
}
