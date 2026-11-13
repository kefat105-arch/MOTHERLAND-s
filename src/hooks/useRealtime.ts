import { useCallback, useEffect, useRef, useState } from 'react';

export interface RealtimeEvent {
  type:
    | 'connected'
    | 'ws:ready'
    | 'chat:message'
    | 'chat:read'
    | 'chat:typing'
    | 'chat:message_update'
    | 'chat:message_delete'
    | 'conv:update'
    | 'call:signal'
    | 'friend:update'
    | 'notification:new'
    | 'presence:update';
  [key: string]: any;
}

export function useRealtime(token: string, onEvent: (event: RealtimeEvent) => void): {
  sendEvent: (event: string, payload: Record<string, any>) => boolean;
  isConnected: boolean;
} {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const sendEvent = useCallback((event: string, payload: Record<string, any>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify({ event, payload }));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let heartbeatTimer: number | null = null;
    let backoffMs = 1500;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      try {
        ws = new WebSocket(url);
        wsRef.current = ws;
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        backoffMs = 1500;
        setIsConnected(true);
        if (heartbeatTimer) window.clearInterval(heartbeatTimer);
        heartbeatTimer = window.setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ event: 'ping', payload: { ts: Date.now() } }));
            } catch {
              // ignore
            }
          }
        }, 25000);
      };

      ws.onmessage = (evt) => {
        try {
          const raw = JSON.parse(String(evt.data || '{}')) as Record<string, any>;
          if (!raw) return;
          const eventType = raw.event || raw.type;
          if (!eventType || eventType === 'pong') return;
          const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload : raw;
          const normalized: RealtimeEvent = {
            ...payload,
            type: eventType,
            payloadType: payload !== raw ? payload.type : undefined,
          };
          if (eventType === 'notification:new' && !normalized.notification && payload.id && payload.title) {
            normalized.notification = payload;
          }
          onEventRef.current(normalized);
        } catch {
          // ignore malformed event frames
        }
      };

      ws.onclose = () => {
        if (heartbeatTimer) window.clearInterval(heartbeatTimer);
        if (wsRef.current === ws) wsRef.current = null;
        setIsConnected(false);
        if (!stopped) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => {
        backoffMs = Math.min(15000, Math.round(backoffMs * 1.6));
        connect();
      }, backoffMs);
    };

    connect();

    return () => {
      stopped = true;
      setIsConnected(false);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [token]);

  return { sendEvent, isConnected };
}
