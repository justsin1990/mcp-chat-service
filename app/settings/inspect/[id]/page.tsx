"use client";

import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PromptInspector } from "@/components/mcp/inspector/PromptInspector";
import { ResourceInspector } from "@/components/mcp/inspector/ResourceInspector";
import { ToolInspector } from "@/components/mcp/inspector/ToolInspector";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMcpServers } from "@/hooks/useMcpServers";
import { useMcpStatus } from "@/hooks/useMcpStatus";
import { cn } from "@/lib/utils";

interface InspectPageProps {
  params: Promise<{ id: string }>;
}

export default function InspectPage({ params }: InspectPageProps) {
  const { id } = use(params);
  const { servers } = useMcpServers();
  const { statuses } = useMcpStatus([id]);

  const server = servers.find((s) => s.id === id);
  const serverStatus = statuses[id];
  const isConnected = serverStatus?.status === "connected";
  const capabilities = serverStatus?.capabilities;

  if (!server) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              서버를 찾을 수 없습니다.
            </p>
            <Link
              href="/settings"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              설정으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center gap-3">
            <Link
              href="/settings"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
              aria-label="설정으로 돌아가기"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{server.name}</h1>
              <p className="text-sm text-muted-foreground">Inspector</p>
            </div>
          </div>
          <Separator className="mb-6" />
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              서버가 연결되지 않았습니다. 설정 페이지에서 먼저 연결하세요.
            </p>
            <Link
              href="/settings"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              설정으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tools = capabilities?.tools ?? [];
  const prompts = capabilities?.prompts ?? [];
  const resources = capabilities?.resources ?? [];

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            aria-label="설정으로 돌아가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{server.name}</h1>
            <p className="text-sm text-muted-foreground">
              Inspector — Tools {tools.length} · Prompts {prompts.length} · Resources {resources.length}
            </p>
          </div>
        </div>

        <Separator className="mb-6" />

        <Tabs defaultValue="tools">
          <TabsList>
            <TabsTrigger value="tools">Tools ({tools.length})</TabsTrigger>
            <TabsTrigger value="prompts">Prompts ({prompts.length})</TabsTrigger>
            <TabsTrigger value="resources">Resources ({resources.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="mt-4">
            <ToolInspector serverId={id} tools={tools} />
          </TabsContent>

          <TabsContent value="prompts" className="mt-4">
            <PromptInspector serverId={id} prompts={prompts} />
          </TabsContent>

          <TabsContent value="resources" className="mt-4">
            <ResourceInspector serverId={id} resources={resources} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
