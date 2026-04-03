"use client";

import { Loader2, Pencil, Plug, PlugZap, Search, Server, Trash2 } from "lucide-react";
import Link from "next/link";

import { McpCapabilitiesView } from "@/components/mcp/McpCapabilitiesView";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { McpConnectionStatus, McpServer, McpServerStatus } from "@/lib/types/mcp";
import { cn } from "@/lib/utils";

interface McpServerListProps {
  servers: McpServer[];
  statuses: Record<string, McpServerStatus>;
  onEdit: (server: McpServer) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onConnect: (server: McpServer) => void;
  onDisconnect: (id: string) => void;
}

const STATUS_DOT: Record<McpConnectionStatus, string> = {
  idle: "bg-zinc-400",
  connecting: "bg-yellow-400 animate-pulse",
  connected: "bg-green-400",
  error: "bg-red-400",
};

const STATUS_LABEL: Record<McpConnectionStatus, string> = {
  idle: "미연결",
  connecting: "연결 중...",
  connected: "연결됨",
  error: "오류",
};

export function McpServerList({
  servers,
  statuses,
  onEdit,
  onRemove,
  onToggle,
  onConnect,
  onDisconnect,
}: McpServerListProps) {
  if (servers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
        <Server className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          등록된 MCP 서버가 없습니다.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          위의 &quot;서버 추가&quot; 버튼으로 MCP 서버를 등록하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {servers.map((server, index) => {
        const serverStatus = statuses[server.id];
        const connStatus: McpConnectionStatus = serverStatus?.status ?? "idle";
        const isConnected = connStatus === "connected";
        const isConnecting = connStatus === "connecting";

        return (
          <div key={server.id}>
            <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 shrink-0 rounded-full",
                        STATUS_DOT[connStatus],
                      )}
                      aria-label={STATUS_LABEL[connStatus]}
                    />
                    <p className="truncate text-sm font-semibold">{server.name}</p>
                    <Badge
                      variant={server.transport.type === "streamable-http" ? "default" : "secondary"}
                      className="shrink-0 text-[11px]"
                    >
                      {server.transport.type === "streamable-http" ? "HTTP" : "stdio"}
                    </Badge>
                  </div>

                  <div className="ml-4 mt-1 flex items-center gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {server.transport.type === "streamable-http"
                        ? server.transport.url
                        : server.transport.command +
                          (server.transport.args?.length
                            ? ` ${server.transport.args.join(" ")}`
                            : "")}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      · {STATUS_LABEL[connStatus]}
                    </span>
                  </div>

                  {connStatus === "error" && serverStatus?.error && (
                    <p className="ml-4 mt-1 text-xs text-destructive">
                      {serverStatus.error}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {isConnected || isConnecting ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDisconnect(server.id)}
                      disabled={isConnecting}
                      aria-label={`${server.name} 연결 해제`}
                      className="gap-1 text-xs"
                    >
                      {isConnecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PlugZap className="h-3.5 w-3.5" />
                      )}
                      해제
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onConnect(server)}
                      disabled={!server.enabled}
                      aria-label={`${server.name} 연결`}
                      className="gap-1 text-xs"
                    >
                      <Plug className="h-3.5 w-3.5" />
                      연결
                    </Button>
                  )}
                  <Switch
                    checked={server.enabled}
                    onCheckedChange={() => onToggle(server.id)}
                    aria-label={`${server.name} 서버 ${server.enabled ? "비활성화" : "활성화"}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(server)}
                    aria-label={`${server.name} 수정`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(server.id)}
                    aria-label={`${server.name} 삭제`}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {server.transport.type === "streamable-http" &&
                server.transport.headers &&
                Object.keys(server.transport.headers).length > 0 && (
                  <p className="ml-4 mt-2 text-xs text-muted-foreground">
                    헤더 {Object.keys(server.transport.headers).length}개 설정됨
                  </p>
                )}

              {server.transport.type === "stdio" &&
                server.transport.env &&
                Object.keys(server.transport.env).length > 0 && (
                  <p className="ml-4 mt-2 text-xs text-muted-foreground">
                    환경 변수 {Object.keys(server.transport.env).length}개 설정됨
                  </p>
                )}

              {isConnected && serverStatus?.capabilities && (
                <>
                  <McpCapabilitiesView capabilities={serverStatus.capabilities} />
                  <div className="mt-2 flex justify-end">
                    <Link
                      href={`/settings/inspect/${server.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "gap-1 text-xs",
                      )}
                    >
                      <Search className="h-3.5 w-3.5" />
                      Inspector
                    </Link>
                  </div>
                </>
              )}
            </div>

            {index < servers.length - 1 && <Separator className="my-1 opacity-0" />}
          </div>
        );
      })}
    </div>
  );
}
