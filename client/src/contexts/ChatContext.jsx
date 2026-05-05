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
  const [activeTypers, setActiveTypers] = useState(new Set());
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const publicKeyCache = useRef(new Map());
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const hasMoreMessages = useRef(true);
  const typingTimeouts = useRef(new Map());

  const handleTypingSignal = useCallback((userId, isTyping) => {
    setActiveTypers(prev => {
      const next = new Set(prev);
      if (isTyping) next.add(userId);
      else next.delete(userId);
      return next;
    });

    if (isTyping) {
      if (typingTimeouts.current.has(userId)) clearTimeout(typingTimeouts.current.get(userId));
      typingTimeouts.current.set(userId, setTimeout(() => {
        setActiveTypers(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }, 5000));
    }
  }, []);

  const sendWebRTCSignal = async (toUserId, subtype, data) => {
    try {
      const recipientPubKey = await getRecipientPublicKey(toUserId);
      const senderPubKey = await keystore.getPublicKey();
      const payloadString = JSON.stringify({ type: 'webrtc', subtype, ...data });
      const payload = await crypto.encryptMessage(payloadString, recipientPubKey, senderPubKey);
      wsManager.send('message.send', { to: toUserId, payload });
    } catch (e) { console.error('Signaling error', e); }
  };

  const handleWebRTCSignal = useCallback(async (senderId, payload) => {
    if (payload.subtype === 'offer') {
      setIncomingCall({ callerId: senderId, callerName: 'Incoming Call', offer: payload.sdp });
    } else if (payload.subtype === 'answer' && peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(payload.sdp);
    } else if (payload.subtype === 'candidate' && peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(payload.candidate);
    }
  }, []);

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
        let parsedPayload;
        try {
          parsedPayload = JSON.parse(decryptedText);
        } catch {
          parsedPayload = { type: 'text', content: decryptedText };
        }

        // Intercept transient messages
        if (parsedPayload.type === 'typing') {
          if (!isSender) handleTypingSignal(msg.from_user_id, parsedPayload.isTyping);
          return; // Do not add to chat history
        }
        if (parsedPayload.type === 'webrtc') {
          handleWebRTCSignal(msg.from_user_id, parsedPayload);
          return;
        }

        const decryptedMsg = {
          id: msg.id,
          fromUserId: msg.from_user_id,
          toUserId: msg.to_user_id,
          type: parsedPayload.type,
          content: parsedPayload.content,
          mimeType: parsedPayload.mimeType,
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
          let parsedPayload;
          try {
            parsedPayload = JSON.parse(text);
          } catch {
            parsedPayload = { type: 'text', content: text };
          }

          if (parsedPayload.type === 'typing' || parsedPayload.type === 'webrtc') {
            continue; // Skip transient messages in history
          }

          decrypted.push({
            id: msg.id,
            fromUserId: msg.from_user_id,
            toUserId: msg.to_user_id,
            type: parsedPayload.type,
            content: parsedPayload.content,
            mimeType: parsedPayload.mimeType,
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
          let parsedPayload;
          try {
            parsedPayload = JSON.parse(text);
          } catch {
            parsedPayload = { type: 'text', content: text };
          }

          if (parsedPayload.type === 'typing' || parsedPayload.type === 'webrtc') continue;

          decrypted.push({
            id: msg.id, fromUserId: msg.from_user_id, toUserId: msg.to_user_id,
            type: parsedPayload.type, content: parsedPayload.content, mimeType: parsedPayload.mimeType,
            createdAt: msg.created_at, delivered: msg.delivered,
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

  const sendEncryptedMessage = useCallback(async (payloadContent) => {
    if (!activeChat || !payloadContent) return;
    setSendingMessage(true);
    try {
      const recipientPubKey = await getRecipientPublicKey(activeChat.userId);
      const senderPubKey = await keystore.getPublicKey();
      if (!senderPubKey) throw new Error('Sender public key not found');
      
      const payloadString = typeof payloadContent === 'string'
        ? JSON.stringify({ type: 'text', content: payloadContent })
        : JSON.stringify(payloadContent);

      const payload = await crypto.encryptMessage(payloadString, recipientPubKey, senderPubKey);
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
        type: typeof payloadContent === 'string' ? 'text' : payloadContent.type,
        content: typeof payloadContent === 'string' ? payloadContent : payloadContent.content,
        mimeType: payloadContent.mimeType,
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

  const sendTypingSignal = useCallback(async (isTyping) => {
    if (!activeChat || wsStatus !== 'connected') return; // Only send if WS is connected
    try {
      const recipientPubKey = await getRecipientPublicKey(activeChat.userId);
      const senderPubKey = await keystore.getPublicKey();
      const payloadString = JSON.stringify({ type: 'typing', isTyping });
      const payload = await crypto.encryptMessage(payloadString, recipientPubKey, senderPubKey);
      wsManager.send('message.send', { to: activeChat.userId, payload });
    } catch (err) {
      // ignore silently
    }
  }, [activeChat, getRecipientPublicKey, wsStatus]);

  const setupPeerConnection = (partnerId) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerConnectionRef.current = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate) sendWebRTCSignal(partnerId, 'candidate', { candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      setActiveCall(prev => prev ? { ...prev, remoteStream: e.streams[0] } : null);
    };
    return pc;
  };

  const initiateCall = async (partnerId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      const pc = setupPeerConnection(partnerId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendWebRTCSignal(partnerId, 'offer', { sdp: offer });
      setActiveCall({ status: 'connecting', localStream: stream, remoteStream: null });
    } catch (err) {
      console.error('Failed to initiate call:', err);
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      const pc = setupPeerConnection(incomingCall.callerId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await pc.setRemoteDescription(incomingCall.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWebRTCSignal(incomingCall.callerId, 'answer', { sdp: answer });
      setActiveCall({ status: 'connected', localStream: stream, remoteStream: null });
      setIncomingCall(null);
    } catch (err) {
      console.error('Failed to accept call:', err);
    }
  };

  const rejectIncomingCall = () => setIncomingCall(null);

  const endCall = () => {
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    setActiveCall(null);
    setIncomingCall(null);
  };

  return (
    <ChatContext.Provider value={{
      conversations, activeChat, messages, wsStatus, activeTypers,
      loadingConvos, loadingMessages, sendingMessage, incomingCall, activeCall,
      openChat, sendEncryptedMessage, loadMoreMessages,
      loadConversations, setActiveChat, sendTypingSignal,
      initiateCall, acceptIncomingCall, rejectIncomingCall, endCall
    }}>
      {children}
    </ChatContext.Provider>
  );
}
