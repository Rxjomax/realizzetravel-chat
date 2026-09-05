type EventCallback = (payload: any) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectTimer: any = null;
  private fallbackPollTimer: any = null;
  private token: string | null = null;
  private isExplicitlyClosed = false;
  private reconnectAttempts = 0;

  public connect(token: string): void {
    this.token = token;
    this.isExplicitlyClosed = false;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore close error
      }
      this.ws = null;
    }

    // Start fallback sync pulse in case WebSockets are restricted by iframe/proxy
    this.startFallbackPolling();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type) {
            this.emitLocal(data.type, data.payload);
          }
        } catch {
          // Ignore malformed WS frames
        }
      };

      this.ws.onclose = () => {
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (e: Event) => {
        try {
          if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
          }
          if (e && typeof (e as any).stopPropagation === 'function') {
            (e as any).stopPropagation();
          }
        } catch {}
      };
    } catch {
      // Handled silently, fallback polling ensures real-time updates continue
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isExplicitlyClosed) return;
    this.reconnectAttempts++;
    // Exponential backoff up to 30s
    const delay = Math.min(30000, 3000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 6)));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token && !this.isExplicitlyClosed) {
        this.connect(this.token);
      }
    }, delay);
  }

  private startFallbackPolling(): void {
    if (this.fallbackPollTimer) return;
    // Broadcast periodic local sync pulse so views stay updated even without WS
    this.fallbackPollTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.emitLocal('poll:sync', { timestamp: Date.now() });
      }
    }, 4000);
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.fallbackPollTimer) {
      clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  public on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unbind function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emitLocal(event: string, payload: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch {
          // Prevent listener errors from breaking other subscribers
        }
      });
    }
  }
}

export const socketClient = new SocketClient();
