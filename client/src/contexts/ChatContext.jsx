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
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
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
    } catch (e) { }
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

  useEffect(() => {
    if (!cryptoReady || !user) return;
    const token = api.getAccessToken();
    if (token) wsManager.connect(token);
    return () => wsManager.disconnect();
  }, [cryptoReady, user]);

  useEffect(() => {
    const unsub = wsManager.on('connection', (data) => {
      setWsStatus(data.status);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!cryptoReady || !user) return;
    const unsub = wsManager.on('message', async (msg) => {
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

        if (parsedPayload.type === 'typing') {
          if (!isSender) handleTypingSignal(msg.from_user_id, parsedPayload.isTyping);
          return;
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

        const partnerId = isSender ? msg.to_user_id : msg.from_user_id;
        setActiveChat(prev => {
          if (prev && prev.userId === partnerId) {
            setMessages(msgs => {
              if (msgs.some(m => m.id === msg.id)) return msgs;
              return [...msgs, decryptedMsg];
            });
          } else if (!isSender) {
            setUnreadCounts(counts => ({
              ...counts,
              [partnerId]: (counts[partnerId] || 0) + 1,
            }));
          }
          return prev;
        });

        loadConversations();
      } catch (err) { }
    });
    return unsub;
  }, [cryptoReady, user, handleTypingSignal, handleWebRTCSignal]);

  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);
    try {
      const convos = await api.getConversations();
      setConversations(convos);
    } catch (err) { } finally {
      setLoadingConvos(false);
    }
  }, []);

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
    setUnreadCounts(counts => { const next = { ...counts }; delete next[userId]; return next; });
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
            continue;
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
            text: '🔒 Unable to decrypt',
            createdAt: msg.created_at,
            delivered: msg.delivered,
            decryptionFailed: true,
          });
        }
      }
      setMessages(decrypted);
      if (rawMsgs.length < 50) hasMoreMessages.current = false;
    } catch (err) { } finally {
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
      const sent = wsManager.send('message.send', { to: activeChat.userId, payload });
      let msgResponse;
      if (!sent) {
        msgResponse = await api.sendMessage(activeChat.userId, payload);
      }
      const newMsg = {
        id: msgResponse?.id || Date.now().toString(),
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
      throw err;
    } finally {
      setSendingMessage(false);
    }
  }, [activeChat, user, getRecipientPublicKey, loadConversations]);

  const sendTypingSignal = useCallback(async (isTyping) => {
    if (!activeChat || wsStatus !== 'connected') return;
    try {
      const recipientPubKey = await getRecipientPublicKey(activeChat.userId);
      const senderPubKey = await keystore.getPublicKey();
      const payloadString = JSON.stringify({ type: 'typing', isTyping });
      const payload = await crypto.encryptMessage(payloadString, recipientPubKey, senderPubKey);
      wsManager.send('message.send', { to: activeChat.userId, payload });
    } catch (err) { }
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
    } catch (err) { }
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
    } catch (err) { }
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
      conversations, activeChat, messages, wsStatus, activeTypers, unreadCounts,
      loadingConvos, loadingMessages, sendingMessage, incomingCall, activeCall,
      openChat, sendEncryptedMessage, loadMoreMessages,
      loadConversations, setActiveChat, sendTypingSignal,
      initiateCall, acceptIncomingCall, rejectIncomingCall, endCall
    }}>
      {children}
    </ChatContext.Provider>
  );
}
