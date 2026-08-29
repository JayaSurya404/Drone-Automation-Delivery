"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Telemetry, WsServerMessage } from "@skynav/contracts";

export type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";

export interface UseRealtimeTelemetryOptions {
  url?: string;
  token?: string;
  autoConnect?: boolean;
  channel?: "telemetry:organization" | "telemetry:drone" | "telemetry:mission";
  targetId?: string;
}

export function useRealtimeTelemetry(options: UseRealtimeTelemetryOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/api/v1/ws/telemetry",
    token,
    autoConnect = true,
    channel = "telemetry:organization",
    targetId
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [telemetryMap, setTelemetryMap] = useState<Map<string, Telemetry>>(new Map());
  const [lastMessageAt, setLastMessageAt] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus("CONNECTING");

    try {
      const wsUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus("CONNECTED");
        // Subscribe to desired channel
        socket.send(
          JSON.stringify({
            type: "SUBSCRIBE",
            channel,
            id: targetId
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const msg: WsServerMessage = JSON.parse(event.data);
          setLastMessageAt(new Date().toISOString());

          if (msg.type === "TELEMETRY") {
            setTelemetryMap((prev) => {
              const next = new Map(prev);
              next.set(msg.telemetry.droneId, msg.telemetry);
              return next;
            });
          }
        } catch {
          // Ignore invalid parse
        }
      };

      socket.onerror = () => {
        setStatus("ERROR");
      };

      socket.onclose = () => {
        setStatus("DISCONNECTED");
        socketRef.current = null;
        // Schedule reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    } catch {
      setStatus("ERROR");
    }
  }, [url, token, channel, targetId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus("DISCONNECTED");
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    status,
    telemetryMap,
    lastMessageAt,
    connect,
    disconnect
  };
}
