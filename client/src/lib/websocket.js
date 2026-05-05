/**
 * WhisperBox WebSocket Manager
 * 
 * Manages real-time WebSocket connection with auto-reconnect.
 * Handles message.receive events for real-time message delivery.
 */

const WS_URL = 'ws://localhost:5000/ws';

export class WebSocketManager {
  constructor() {
    this.ws = null;
    this.token = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimer = null;
    this.isIntentionallyClosed = false;
  }

  connect(token) {
    this.token = token;
    this.isIntentionallyClosed = false;
    this._doConnect();
  }

  _doConnect() {
    if (!this.token) return;
    try {
      this.ws = new WebSocket(`${WS_URL}?token=${this.token}`);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._emit('connection', { status: 'connected' });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message.receive') {
          this._emit('message', data.data || data);
        } else if (data.type === 'messages.pending') {
          // Flush of offline messages
          const messages = data.data || data.messages || [];
          if (Array.isArray(messages)) {
            messages.forEach(msg => this._emit('message', msg));
          }
        } else {
          this._emit(data.type, data);
        }
      } catch {
        // non-JSON message, ignore
      }
    };

    this.ws.onclose = () => {
      this._emit('connection', { status: 'disconnected' });
      if (!this.isIntentionallyClosed) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._emit('connection', { status: 'failed' });
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this._emit('connection', { status: 'reconnecting', attempt: this.reconnectAttempts });
    this.reconnectTimer = setTimeout(() => this._doConnect(), delay);
  }

  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
      return true;
    }
    return false;
  }

  updateToken(newToken) {
    this.token = newToken;
    // Reconnect with new token
    if (this.ws) {
      this.isIntentionallyClosed = true;
      this.ws.close();
      this.isIntentionallyClosed = false;
      this._doConnect();
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  _emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) cbs.forEach(cb => cb(data));
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
