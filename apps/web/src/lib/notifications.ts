"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  NotificationResponse,
  NotificationListResponse,
  NotificationListQuery,
  WsServerMessage
} from "@skynav/contracts";

export interface UseRealtimeNotificationsOptions {
  url?: string;
  token?: string;
  autoConnect?: boolean;
  channel?: "notifications:organization" | "notifications:user";
  initialNotifications?: NotificationResponse[];
}

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/api/v1/ws/telemetry",
    token,
    autoConnect = true,
    channel = "notifications:user",
    initialNotifications = []
  } = options;

  const [notifications, setNotifications] = useState<NotificationResponse[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(
    initialNotifications.filter((n) => !n.isRead).length
  );
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const wsUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        socket.send(
          JSON.stringify({
            type: "SUBSCRIBE",
            channel
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const msg: WsServerMessage = JSON.parse(event.data);
          if (msg.type === "NOTIFICATION") {
            const incoming = msg.notification;
            setNotifications((prev) => {
              // Avoid duplicates by id
              if (prev.some((n) => n.id === incoming.id)) {
                return prev.map((n) => (n.id === incoming.id ? incoming : n));
              }
              return [incoming, ...prev];
            });
            if (!incoming.isRead) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      socket.onerror = () => {
        setIsConnected(false);
      };

      socket.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    } catch {
      setIsConnected(false);
    }
  }, [url, token, channel]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  const markReadLocal = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllReadLocal = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    setNotifications,
    unreadCount,
    setUnreadCount,
    isConnected,
    markReadLocal,
    markAllReadLocal,
    connect,
    disconnect
  };
}
