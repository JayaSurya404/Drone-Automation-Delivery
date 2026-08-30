"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Telemetry, WsServerMessage, TelemetryFreshness } from "@skynav/contracts";
import { calculateTelemetryFreshness, isValidCoordinate } from "@skynav/contracts";

export type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";

export interface DroneTrailPoint {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  timestamp: string;
}

export interface UseRealtimeTelemetryOptions {
  url?: string;
  token?: string;
  autoConnect?: boolean;
  channel?: "telemetry:organization" | "telemetry:drone" | "telemetry:mission";
  targetId?: string;
  maxTrailPoints?: number;
}

export function useRealtimeTelemetry(options: UseRealtimeTelemetryOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/api/v1/ws/telemetry",
    token,
    autoConnect = true,
    channel = "telemetry:organization",
    targetId,
    maxTrailPoints = 25
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [telemetryMap, setTelemetryMap] = useState<Map<string, Telemetry>>(new Map());
  const [trailsMap, setTrailsMap] = useState<Map<string, DroneTrailPoint[]>>(new Map());
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
          const nowStr = new Date().toISOString();
          setLastMessageAt(nowStr);

          if (msg.type === "TELEMETRY" && isValidCoordinate(msg.telemetry.position)) {
            const droneId = msg.telemetry.droneId;
            const newPoint: DroneTrailPoint = {
              latitude: msg.telemetry.position.latitude,
              longitude: msg.telemetry.position.longitude,
              altitudeMeters: msg.telemetry.position.altitudeMeters,
              timestamp: msg.telemetry.observedAt
            };

            setTelemetryMap((prev) => {
              const next = new Map(prev);
              next.set(droneId, msg.telemetry);
              return next;
            });

            setTrailsMap((prev) => {
              const next = new Map(prev);
              const currentTrail = next.get(droneId) || [];
              const updatedTrail = [...currentTrail, newPoint].slice(-maxTrailPoints);
              next.set(droneId, updatedTrail);
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
  }, [url, token, channel, targetId, maxTrailPoints]);

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

  const getDroneFreshness = useCallback(
    (droneId: string): TelemetryFreshness => {
      const telem = telemetryMap.get(droneId);
      if (!telem) return "OFFLINE";
      return calculateTelemetryFreshness(telem.observedAt);
    },
    [telemetryMap]
  );

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
    trailsMap,
    lastMessageAt,
    getDroneFreshness,
    connect,
    disconnect
  };
}
