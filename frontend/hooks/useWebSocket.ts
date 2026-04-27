import { useState, useEffect, useRef } from 'react';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1/ws/";

export interface UseWebSocketReturn<T> {
  lastMessage: T | null;
  isConnected: boolean;
}

/**
 * A clean, UI-agnostic hook for managing a WebSocket connection.
 * Handles React Strict Mode double-invoke, automatic reconnects with
 * exponential backoff, and safe cleanup on unmount.
 */
export function useWebSocket<T = any>(enabled: boolean = true, urlParams: string = ''): UseWebSocketReturn<T> {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<T | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempt = useRef<number>(0);
  const isMounted = useRef<boolean>(false);

  useEffect(() => {
    isMounted.current = true;
    if (!enabled) return;

    function connect() {
      if (!isMounted.current) return;

      // Do not attempt if a connection is already alive or connecting
      const state = ws.current?.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

      try {
        const socket = new WebSocket(`${WS_BASE_URL}${urlParams}`);
        ws.current = socket;

        socket.onopen = () => {
          if (!isMounted.current) return;
          setIsConnected(true);
          reconnectAttempt.current = 0;
          console.debug('[WS] Connected to location stream.');
        };

        socket.onmessage = (event) => {
          if (!isMounted.current) return;
          try {
            console.log(`[WS] Received: ${event.data}`);
            const data: T = JSON.parse(event.data);
            setLastMessage(data);
          } catch {
            // Silently discard malformed messages
          }
        };

        socket.onclose = () => {
          if (!isMounted.current) return;
          setIsConnected(false);
          ws.current = null;
          scheduleReconnect();
        };

        socket.onerror = () => {
          // onerror always precedes onclose — close will trigger reconnect
          socket.close();
        };
      } catch {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (!isMounted.current) return;
      if (reconnectAttempt.current >= 5) {
        console.warn('[WS] Maximum reconnect attempts reached (5). Stopping.');
        return;
      }
      
      // Exponential backoff capped at 10s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 10_000);
      reconnectAttempt.current += 1;
      console.debug(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempt.current})`);
      reconnectTimeout.current = setTimeout(connect, delay);
    }

    connect();

    return () => {
      isMounted.current = false;

      // Cancel any pending reconnect timer
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      // Null out all handlers BEFORE closing to prevent onclose
      // triggering a reconnect loop during unmount / Strict Mode cleanup
      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
    };
  }, [enabled]); // Run only once on mount

  return { lastMessage, isConnected };
}
