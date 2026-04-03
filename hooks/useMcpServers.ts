"use client";

import { useCallback, useEffect, useState } from "react";

import type { McpServer } from "@/lib/types/mcp";
import {
  deleteMcpServer,
  fetchMcpServers,
  insertMcpServer,
  updateMcpServer,
} from "@/lib/db/mcp-servers";

interface UseMcpServersReturn {
  servers: McpServer[];
  addServer: (data: Omit<McpServer, "id" | "createdAt" | "updatedAt">) => void;
  updateServer: (id: string, data: Partial<Omit<McpServer, "id" | "createdAt" | "updatedAt">>) => void;
  removeServer: (id: string) => void;
  toggleServer: (id: string) => void;
}

export function useMcpServers(): UseMcpServersReturn {
  const [servers, setServers] = useState<McpServer[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetchMcpServers()
      .then((data) => {
        if (!cancelled) setServers(data);
      })
      .catch(() => {
        // 로드 실패 시 빈 배열 유지
      });

    return () => { cancelled = true; };
  }, []);

  const addServer = useCallback(
    (data: Omit<McpServer, "id" | "createdAt" | "updatedAt">) => {
      const now = Date.now();
      const newServer: McpServer = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      setServers((prev) => [...prev, newServer]);
      insertMcpServer(newServer);
    },
    [],
  );

  const updateServerHandler = useCallback(
    (id: string, data: Partial<Omit<McpServer, "id" | "createdAt" | "updatedAt">>) => {
      const now = Date.now();
      setServers((prev) =>
        prev.map((server) =>
          server.id === id
            ? { ...server, ...data, updatedAt: now }
            : server,
        ),
      );
      updateMcpServer(id, { ...data, updatedAt: now });
    },
    [],
  );

  const removeServer = useCallback((id: string) => {
    setServers((prev) => prev.filter((server) => server.id !== id));
    deleteMcpServer(id);
  }, []);

  const toggleServer = useCallback((id: string) => {
    setServers((prev) => {
      const target = prev.find((s) => s.id === id);
      if (!target) return prev;

      const now = Date.now();
      updateMcpServer(id, { enabled: !target.enabled, updatedAt: now });

      return prev.map((server) =>
        server.id === id
          ? { ...server, enabled: !server.enabled, updatedAt: now }
          : server,
      );
    });
  }, []);

  return { servers, addServer, updateServer: updateServerHandler, removeServer, toggleServer };
}
