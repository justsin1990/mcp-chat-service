"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { McpServer, McpTransport } from "@/lib/types/mcp";

const STORAGE_KEY = "mcp-chat-service:mcp-servers";

interface UseMcpServersReturn {
  servers: McpServer[];
  addServer: (data: Omit<McpServer, "id" | "createdAt" | "updatedAt">) => void;
  updateServer: (id: string, data: Partial<Omit<McpServer, "id" | "createdAt" | "updatedAt">>) => void;
  removeServer: (id: string) => void;
  toggleServer: (id: string) => void;
}

function isValidMcpServer(value: unknown): value is McpServer {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.enabled === "boolean" &&
    typeof v.createdAt === "number" &&
    typeof v.updatedAt === "number" &&
    isValidTransport(v.transport)
  );
}

function isValidTransport(value: unknown): value is McpTransport {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type === "streamable-http") return typeof v.url === "string";
  if (v.type === "stdio") return typeof v.command === "string";
  return false;
}

export function useMcpServers(): UseMcpServersReturn {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed) && parsed.every(isValidMcpServer)) {
          setServers(parsed);
        }
      }
    } catch {
      // 파싱 실패 시 빈 배열 유지
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!hasLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
    } catch {
      // 저장 실패 시 메모리 상태 유지
    }
  }, [hasLoaded, servers]);

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
    },
    [],
  );

  const updateServer = useCallback(
    (id: string, data: Partial<Omit<McpServer, "id" | "createdAt" | "updatedAt">>) => {
      setServers((prev) =>
        prev.map((server) =>
          server.id === id
            ? { ...server, ...data, updatedAt: Date.now() }
            : server,
        ),
      );
    },
    [],
  );

  const removeServer = useCallback((id: string) => {
    setServers((prev) => prev.filter((server) => server.id !== id));
  }, []);

  const toggleServer = useCallback((id: string) => {
    setServers((prev) =>
      prev.map((server) =>
        server.id === id
          ? { ...server, enabled: !server.enabled, updatedAt: Date.now() }
          : server,
      ),
    );
  }, []);

  return { servers, addServer, updateServer, removeServer, toggleServer };
}
