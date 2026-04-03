"use client";

import {
  Wrench,
  ChevronDown,
  Server,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { McpToolWithServer } from "@/lib/types/mcp";

interface McpToolPanelProps {
  tools: McpToolWithServer[];
  isToolEnabled: (serverId: string, toolName: string) => boolean;
  onToggle: (serverId: string, toolName: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

export function McpToolPanel({
  tools,
  isToolEnabled,
  onToggle,
  onEnableAll,
  onDisableAll,
}: McpToolPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const enabledCount = tools.filter((t) =>
    isToolEnabled(t.serverId, t.tool.name),
  ).length;

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (tools.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-500">
        <Wrench className="h-3 w-3" />
        <span>도구 없음</span>
      </div>
    );
  }

  const grouped = groupByServer(tools);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
          enabledCount > 0
            ? "border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
            : "border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-100",
        )}
        aria-label="MCP 도구 패널 열기"
        aria-expanded={open}
      >
        <Wrench className="h-3 w-3" />
        <span>
          도구 {enabledCount}/{tools.length}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="text-xs font-medium text-zinc-300">MCP 도구</p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onEnableAll}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                aria-label="모든 도구 활성화"
              >
                <ToggleRight className="h-3 w-3" />
                전체 켜기
              </button>
              <button
                type="button"
                onClick={onDisableAll}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                aria-label="모든 도구 비활성화"
              >
                <ToggleLeft className="h-3 w-3" />
                전체 끄기
              </button>
            </div>
          </div>

          <div className="chat-scrollbar max-h-64 overflow-y-auto p-1.5">
            {grouped.map(({ serverId, serverName, tools: serverTools }) => (
              <div key={serverId} className="mb-1 last:mb-0">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Server className="h-3 w-3 text-zinc-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {serverName}
                  </span>
                </div>
                {serverTools.map((t) => {
                  const enabled = isToolEnabled(t.serverId, t.tool.name);
                  return (
                    <div
                      key={`${t.serverId}::${t.tool.name}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/5"
                    >
                      <Switch
                        size="sm"
                        checked={enabled}
                        onCheckedChange={() =>
                          onToggle(t.serverId, t.tool.name)
                        }
                        aria-label={`${t.tool.name} 도구 토글`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-xs font-medium",
                            enabled ? "text-zinc-200" : "text-zinc-500",
                          )}
                        >
                          {t.tool.name}
                        </p>
                        {t.tool.description && (
                          <p className="truncate text-[10px] text-zinc-600">
                            {t.tool.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface GroupedTools {
  serverId: string;
  serverName: string;
  tools: McpToolWithServer[];
}

function groupByServer(tools: McpToolWithServer[]): GroupedTools[] {
  const map = new Map<string, GroupedTools>();

  for (const t of tools) {
    const existing = map.get(t.serverId);
    if (existing) {
      existing.tools.push(t);
    } else {
      map.set(t.serverId, {
        serverId: t.serverId,
        serverName: t.serverName,
        tools: [t],
      });
    }
  }

  return Array.from(map.values());
}
