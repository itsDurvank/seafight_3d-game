// public/js/net.js
// WebSocket client connection, heartbeat, simulated latency, and message dispatch.

export class NetworkClient {
  constructor() {
    this.ws = null;
    this.handlers = new Map(); // eventType -> Set of callbacks
    this.rtt = 0;
    this.pingTimer = null;
    this.onPing = null; // (rttMs) => void
    this.onStatusChange = null; // (status, info) => void
    this.isConnected = false;

    // Parse URL params for ?lag=... and ?server=...
    const params = new URLSearchParams(window.location.search);
    this.simulatedLag = Math.max(0, parseInt(params.get('lag') || '0', 10));
    this.serverOverride = params.get('server') || null;
  }

  getServerUrl() {
    if (this.serverOverride) return this.serverOverride;

    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Local development: connect to local dev server
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${window.location.host}`;
    }

    // Running directly on Render: connect to itself
    if (hostname.endsWith('onrender.com')) {
      return `${protocol}//${window.location.host}`;
    }

    // Vercel / External hosts: connect to the live Render multiplayer game server
    return 'wss://seafight-3d-game.onrender.com';
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = this.getServerUrl();
    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      if (this.onStatusChange) this.onStatusChange('error', err.message);
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      if (this.onStatusChange) this.onStatusChange('connected');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const handleData = (raw) => {
        try {
          const msg = JSON.parse(raw);
          if (msg.type === 'pong') {
            this.rtt = Math.max(1, Math.round(performance.now() - msg.t));
            if (this.onPing) this.onPing(this.rtt);
            return;
          }
          this.dispatch(msg.type, msg);
        } catch (e) {
          console.warn('[Net] Failed to parse message', e);
        }
      };

      if (this.simulatedLag > 0) {
        setTimeout(() => handleData(event.data), this.simulatedLag / 2);
      } else {
        handleData(event.data);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.stopHeartbeat();
      if (this.onStatusChange) this.onStatusChange('disconnected');
    };

    this.ws.onerror = (err) => {
      if (this.onStatusChange) this.onStatusChange('error', err);
    };
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', t: performance.now() });
      }
    }, 2000);
  }

  stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  send(msg) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const raw = JSON.stringify(msg);

    if (this.simulatedLag > 0) {
      setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(raw);
        }
      }, this.simulatedLag / 2);
    } else {
      this.ws.send(raw);
    }
  }

  on(type, callback) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type).add(callback);
    return () => this.off(type, callback);
  }

  off(type, callback) {
    const set = this.handlers.get(type);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this.handlers.delete(type);
    }
  }

  dispatch(type, msg) {
    const set = this.handlers.get(type);
    if (set) {
      for (const fn of set) {
        try {
          fn(msg);
        } catch (e) {
          console.error(`[Net] Error in handler for '${type}':`, e);
        }
      }
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
