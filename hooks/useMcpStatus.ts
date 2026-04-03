"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { McpServer, McpServerStatus } from "@/lib/types/mcp";

const POLL_FAST_MS = 2_000;
const POLL_SLOW_MS = 10_000;

interface UseMcpStatusReturn {
  statuses: Record<string, McpServerStatus>;
  connect: (server: McpServer) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  isLoading: boolean;
  ready: boolean;
}

export function useMcpStatus(serverIds: string[]): UseMcpStatusReturn {
  const [statuses, setStatuses] = useState<Record<string, McpServerStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const idsRef = useRef(serverIds);
  idsRef.current = serverIds;

  const fetchStatuses = useCallback(async () => {
    const ids = idsRef.current;
    if (ids.length === 0) {
      setStatuses({});
      setReady(true);
      return;
    }

    try {
      const res = await fetch(`/api/mcp/status?ids=${ids.join(",")}`);
      if (!res.ok) return;

      const data = (await res.json()) as McpServerStatus[];
      const map: Record<string, McpServerStatus> = {};
      for (const s of data) {
        map[s.id] = s;
      }
      for (const id of ids) {
        if (!map[id]) {
          map[id] = { id, status: "idle" };
        }
      }
      setStatuses(map);
    } catch {
      // 네트워크 오류 시 기존 상태 유지
    } finally {
      setReady(true);
    }
  }, []);

  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  const idsKey = serverIds.join(",");

  useEffect(() => {
    if (!idsKey) return;

    fetchStatuses();

    const interval = setInterval(() => {
      const hasConnecting = Object.values(statusesRef.current).some(
        (s) => s.status === "connecting",
      );
      if (!hasConnecting) return;
      fetchStatuses();
    }, POLL_FAST_MS);

    const slowInterval = setInterval(() => {
      const hasConnecting = Object.values(statusesRef.current).some(
        (s) => s.status === "connecting",
      );
      if (hasConnecting) return;
      fetchStatuses();
    }, POLL_SLOW_MS);

    return () => {
      clearInterval(interval);
      clearInterval(slowInterval);
    };
  }, [idsKey, fetchStatuses]);

  const connect = useCallback(
    async (server: McpServer) => {
      setStatuses((prev) => ({
        ...prev,
        [server.id]: { id: server.id, status: "connecting" },
      }));
      setIsLoading(true);

      try {
        const res = await fetch("/api/mcp/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ server }),
        });

        if (res.ok) {
          const status = (await res.json()) as McpServerStatus;
          setStatuses((prev) => ({ ...prev, [server.id]: status }));
        } else {
          setStatuses((prev) => ({
            ...prev,
            [server.id]: {
              id: server.id,
              status: "error",
              error: "연결 요청 실패",
            },
          }));
        }
      } catch {
        setStatuses((prev) => ({
          ...prev,
          [server.id]: {
            id: server.id,
            status: "error",
            error: "네트워크 오류",
          },
        }));
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const disconnect = useCallback(
    async (id: string) => {
      setIsLoading(true);

      try {
        await fetch("/api/mcp/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        setStatuses((prev) => ({
          ...prev,
          [id]: { id, status: "idle" },
        }));
      } catch {
        // 실패해도 UI에서는 idle로 전환
        setStatuses((prev) => ({
          ...prev,
          [id]: { id, status: "idle" },
        }));
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { statuses, connect, disconnect, isLoading, ready };
}
