"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { McpToolWithServer } from "@/lib/types/mcp";

const STORAGE_KEY = "mcp-chat-service:mcp-tool-prefs";
const POLL_INTERVAL_MS = 5_000;

interface ToolPrefs {
  [key: string]: boolean;
}

interface UseMcpToolsReturn {
  tools: McpToolWithServer[];
  enabledTools: Array<{ serverId: string; toolName: string }>;
  toggleTool: (serverId: string, toolName: string) => void;
  enableAll: () => void;
  disableAll: () => void;
  isToolEnabled: (serverId: string, toolName: string) => boolean;
  refresh: () => Promise<void>;
}

function toolKey(serverId: string, toolName: string): string {
  return `${serverId}::${toolName}`;
}

function loadPrefs(): ToolPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as ToolPrefs;
      }
    }
  } catch {
    // 파싱 실패 시 빈 객체
  }
  return {};
}

function savePrefs(prefs: ToolPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // 저장 실패 무시
  }
}

export function useMcpTools(): UseMcpToolsReturn {
  const [tools, setTools] = useState<McpToolWithServer[]>([]);
  const [prefs, setPrefs] = useState<ToolPrefs>({});
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp/tools");
      if (!res.ok) return;
      const data = (await res.json()) as McpToolWithServer[];
      setTools(data);
    } catch {
      // 네트워크 오류 시 기존 상태 유지
    }
  }, []);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  useEffect(() => {
    fetchTools();
    const interval = setInterval(fetchTools, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTools]);

  const isToolEnabled = useCallback(
    (serverId: string, toolName: string) => {
      const key = toolKey(serverId, toolName);
      return prefs[key] !== false;
    },
    [prefs],
  );

  const toggleTool = useCallback(
    (serverId: string, toolName: string) => {
      setPrefs((prev) => {
        const key = toolKey(serverId, toolName);
        const next = { ...prev, [key]: prev[key] === false };
        savePrefs(next);
        return next;
      });
    },
    [],
  );

  const enableAll = useCallback(() => {
    setPrefs(() => {
      const next: ToolPrefs = {};
      savePrefs(next);
      return next;
    });
  }, []);

  const disableAll = useCallback(() => {
    setPrefs(() => {
      const next: ToolPrefs = {};
      for (const t of tools) {
        next[toolKey(t.serverId, t.tool.name)] = false;
      }
      savePrefs(next);
      return next;
    });
  }, [tools]);

  const enabledTools = tools
    .filter((t) => isToolEnabled(t.serverId, t.tool.name))
    .map((t) => ({ serverId: t.serverId, toolName: t.tool.name }));

  return {
    tools,
    enabledTools,
    toggleTool,
    enableAll,
    disableAll,
    isToolEnabled,
    refresh: fetchTools,
  };
}
