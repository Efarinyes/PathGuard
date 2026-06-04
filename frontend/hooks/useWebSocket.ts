import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE_URL, WS_FAST_RECONNECT_ATTEMPTS, WS_RECONNECT_BASE_DELAY_MS, WS_RECONNECT_MAX_DELAY_MS, WS_INFINITE_RETRY_DELAY_MS } from '@/lib/config';

export interface UseWebSocketOptions {
  debounceMs?: number;
}

export interface UseWebSocketReturn<T> {
  lastMessage: T | null;
  isConnected: boolean;
  sendMessage: (msg: Record<string, unknown>) => void;
}

/**
 * A clean, UI-agnostic hook for managing a WebSocket connection.
 * Handles React Strict Mode double-invoke, automatic reconnects with
 * exponential backoff, safe cleanup on unmount, and optional debouncing
 * to reduce re-renders from high-frequency messages.
 */
export function useWebSocket<T = unknown>(
  enabled: boolean = true,
  urlParams: string = '',
  options: UseWebSocketOptions = {}
): UseWebSocketReturn<T> {
  const { debounceMs = 0 } = options;
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<T | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempt = useRef<number>(0);
  const isMounted = useRef<boolean>(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const pendingMessage = useRef<T | null>(null);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  const processMessage = useCallback((data: T) => {
    if (debounceMs > 0) {
      pendingMessage.current = data;
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(() => {
        if (isMounted.current && pendingMessage.current) {
          setLastMessage(pendingMessage.current);
          pendingMessage.current = null;
        }
      }, debounceMs);
    } else {
      setLastMessage(data);
    }
  }, [debounceMs]);

  useEffect(() => {
    isMounted.current = true;
    if (!enabled) return;

    function connect() {
      if (!isMounted.current) return;

      const state = ws.current?.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

      try {
        const socket = new WebSocket(`${WS_BASE_URL}${urlParams}`);
        ws.current = socket;

        socket.onopen = () => {
          if (!isMounted.current) return;
          setIsConnected(true);
          reconnectAttempt.current = 0;
        };

        socket.onmessage = (event) => {
          if (!isMounted.current) return;
          try {
            const data: T = JSON.parse(event.data);
            processMessage(data);
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
          socket.close();
        };
      } catch {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (!isMounted.current) return;

      let delay: number;
      if (reconnectAttempt.current < WS_FAST_RECONNECT_ATTEMPTS) {
        delay = Math.min(
          WS_RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempt.current),
          WS_RECONNECT_MAX_DELAY_MS,
        );
      } else {
        delay = WS_INFINITE_RETRY_DELAY_MS;
      }

      reconnectAttempt.current += 1;
      reconnectTimeout.current = setTimeout(connect, delay);
    }

    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        reconnectAttempt.current = 0;
        connect();
      }
    };

    const handleOnline = () => {
      if (enabled) {
        reconnectAttempt.current = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
        debounceTimeout.current = null;
      }

      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
    };
  }, [enabled, processMessage]);

  return { lastMessage, isConnected, sendMessage };
}
