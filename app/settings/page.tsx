"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { McpServerForm } from "@/components/mcp/McpServerForm";
import { McpServerList } from "@/components/mcp/McpServerList";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMcpServers } from "@/hooks/useMcpServers";
import { useMcpStatus } from "@/hooks/useMcpStatus";
import { cn } from "@/lib/utils";
import type { McpServer } from "@/lib/types/mcp";

export default function SettingsPage() {
  const { servers, addServer, updateServer, removeServer, toggleServer } =
    useMcpServers();

  const serverIds = servers.map((s) => s.id);
  const { statuses, connect, disconnect, ready } = useMcpStatus(serverIds);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<McpServer | null>(null);
  const autoConnectedRef = useRef(false);

  useEffect(() => {
    if (!ready || autoConnectedRef.current || servers.length === 0) return;
    autoConnectedRef.current = true;

    const enabledIdleServers = servers.filter(
      (s) => s.enabled && (!statuses[s.id] || statuses[s.id].status === "idle"),
    );
    for (const server of enabledIdleServers) {
      connect(server);
    }
  }, [ready, servers, statuses, connect]);

  function handleAdd() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function handleEdit(server: McpServer) {
    setEditTarget(server);
    setFormOpen(true);
  }

  function handleClose() {
    setFormOpen(false);
    setEditTarget(null);
  }

  function handleSubmit(
    data: Omit<McpServer, "id" | "createdAt" | "updatedAt">,
  ) {
    if (editTarget) {
      updateServer(editTarget.id, data);
    } else {
      addServer(data);
    }
  }

  const handleConnect = useCallback(
    (server: McpServer) => {
      connect(server);
    },
    [connect],
  );

  const handleDisconnect = useCallback(
    (id: string) => {
      disconnect(id);
    },
    [disconnect],
  );

  const connectedCount = Object.values(statuses).filter(
    (s) => s.status === "connected",
  ).length;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            aria-label="채팅으로 돌아가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">설정</h1>
            <p className="text-sm text-muted-foreground">
              MCP 서버를 등록하고 관리합니다.
            </p>
          </div>
        </div>

        <Separator className="mb-6" />

        <section aria-labelledby="mcp-section-title">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 id="mcp-section-title" className="text-base font-semibold">
                MCP 서버
              </h2>
              <p className="text-xs text-muted-foreground">
                {servers.length > 0
                  ? `${servers.length}개 등록됨 · 활성 ${servers.filter((s) => s.enabled).length}개 · 연결됨 ${connectedCount}개`
                  : "등록된 서버가 없습니다."}
              </p>
            </div>
            <Button type="button" size="sm" onClick={handleAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              서버 추가
            </Button>
          </div>

          <McpServerList
            servers={servers}
            statuses={statuses}
            onEdit={handleEdit}
            onRemove={removeServer}
            onToggle={toggleServer}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </section>

        <McpServerForm
          open={formOpen}
          editTarget={editTarget}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
