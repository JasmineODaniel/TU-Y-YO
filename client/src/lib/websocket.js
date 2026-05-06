const WS_URL = import.meta.env.VITE_WS_URL || 'wss://whisperbox.koyeb.app/ws';

class WebSocketManager {
  constructor() {
    this.token = null;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.isClosing = false;
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  connect(token) {
    this.token = token;
    this.isClosing = false;
    this._doConnect();
  }

  _doConnect() {
    if (!this.token) return;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this._emit('connection', { status: 'connecting' });
    try {
      this.ws = new WebSocket(`${WS_URL}?token=${this.token}`);
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this._emit('connection', { status: 'connected' });
      };
      this.ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          this._emit('message', data.data || data);
        } catch (err) {}
      };
      this.ws.onclose = () => {
        if (!this.isClosing) {
          this._emit('connection', { status: 'disconnected' });
          this._reconnect();
        }
      };
      this.ws.onerror = () => this._emit('connection', { status: 'error' });
    } catch (err) {
      this._reconnect();
    }
  }

  _reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectTimeout = setTimeout(() => this._doConnect(), delay);
    }
  }

  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
      return true;
    }
    return false;
  }

  disconnect() {
    this.isClosing = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) this.ws.close();
    this.ws = null;
  }
}

export const wsManager = new WebSocketManager();
