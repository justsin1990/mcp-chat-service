"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";

import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { MarkdownMessage } from "@/components/chat/MarkdownMessage";
import { McpToolPanel } from "@/components/chat/McpToolPanel";
import { ToolCallMessage } from "@/components/chat/ToolCallMessage";
import { useChat } from "@/hooks/useChat";
import { useMcpServers } from "@/hooks/useMcpServers";
import { useMcpStatus } from "@/hooks/useMcpStatus";
import { useMcpTools } from "@/hooks/useMcpTools";
import { useModelSelect } from "@/hooks/useModelSelect";
import { cn } from "@/lib/utils";

export default function Home() {
  const {
    sessions,
    visibleSessions,
    deletedSessions,
    activeSessionId,
    activeSession,
    messages,
    error,
    isStreaming,
    sendMessage,
    cancelStream,
    createSession,
    selectSession,
    deleteSession,
    restoreSession,
    moveSession,
  } = useChat();

  const { servers } = useMcpServers();
  const serverIds = servers.map((s) => s.id);
  const { statuses, connect, ready: mcpReady } = useMcpStatus(serverIds);
  const {
    tools: mcpTools,
    enabledTools,
    toggleTool,
    enableAll,
    disableAll,
    isToolEnabled,
    refresh: refreshTools,
  } = useMcpTools();

  const { selectedModel, selectedModelOption, models, setModel } = useModelSelect();

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const autoConnectedRef = useRef(false);

  useEffect(() => {
    if (!mcpReady || autoConnectedRef.current || servers.length === 0) return;
    autoConnectedRef.current = true;

    const enabledIdleServers = servers.filter(
      (s) => s.enabled && (!statuses[s.id] || statuses[s.id].status === "idle"),
    );
    for (const server of enabledIdleServers) {
      connect(server);
    }
  }, [mcpReady, servers, statuses, connect]);

  useEffect(() => {
    const connectedCount = Object.values(statuses).filter(
      (s) => s.status === "connected",
    ).length;
    if (connectedCount > 0) {
      refreshTools();
    }
  }, [statuses, refreshTools]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isStreaming, messages]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const nextValue = input.trim();

      if (!nextValue) {
        return;
      }

      setInput("");
      await sendMessage(nextValue, enabledTools, selectedModel);
    },
    [input, sendMessage, enabledTools, selectedModel],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
    }
  }

  return (
    <main className="flex h-screen bg-zinc-950 text-zinc-50">
      <div className="flex h-full w-full overflow-hidden bg-white/5">
        <ChatSidebar
          sessions={visibleSessions}
          deletedSessions={deletedSessions}
          activeSessionId={activeSessionId}
          isStreaming={isStreaming}
          onCreateSession={createSession}
          onSelectSession={selectSession}
          onDeleteSession={deleteSession}
          onRestoreSession={restoreSession}
          onMoveSession={moveSession}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 sm:px-5">
            <div className="min-w-0">
              <p className="text-xs text-zinc-500">Google Gemini SDK</p>
              <h1 className="truncate text-base font-semibold">
                {activeSession?.title ?? "간단한 AI 채팅 앱"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <McpToolPanel
                tools={mcpTools}
                isToolEnabled={isToolEnabled}
                onToggle={toggleTool}
                onEnableAll={enableAll}
                onDisableAll={disableAll}
              />
              <p className="hidden text-xs text-zinc-500 sm:block">
                세션 {visibleSessions.length}/{sessions.length}
              </p>
              <Link
                href="/settings"
                className="rounded-full border border-white/10 p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                aria-label="MCP 서버 설정"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </header>

          <section className="border-b border-white/10 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100 sm:px-5">
            채팅 내역은 Supabase 데이터베이스에 저장됩니다. 민감한 내용을 입력하지
            마세요.
          </section>

          <section className="min-h-0 flex-1 px-4 py-4 sm:px-5">
            <div className="chat-scrollbar mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto pr-2">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center text-sm text-zinc-400">
                  첫 메시지를 보내면 새 채팅 제목이 자동으로 생성됩니다.
                </div>
              ) : null}

              {messages.map((message, index) => {
                const isAssistant = message.role === "assistant";
                const isStreamingBubble =
                  isAssistant &&
                  isStreaming &&
                  index === messages.length - 1;
                const hasToolCalls =
                  isAssistant && (message.toolCalls ?? []).length > 0;

                return (
                  <article
                    key={message.id}
                    className={cn(
                      "flex w-full",
                      isAssistant ? "justify-start" : "justify-end",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-7 shadow-sm",
                        isAssistant
                          ? "bg-white/10 text-zinc-100"
                          : "bg-blue-500 text-white",
                      )}
                    >
                      <p className="mb-1 text-xs uppercase tracking-[0.2em] text-white/60">
                        {isAssistant ? "assistant" : "user"}
                      </p>

                      {hasToolCalls && (
                        <ToolCallMessage toolCalls={message.toolCalls!} />
                      )}

                      {isAssistant ? (
                        message.content ? (
                          <MarkdownMessage
                            content={message.content}
                            isStreaming={isStreamingBubble}
                          />
                        ) : isStreamingBubble && !hasToolCalls ? (
                          <p className="text-zinc-400">응답을 생성하는 중입니다.</p>
                        ) : null
                      ) : (
                        <p className="whitespace-pre-wrap break-words">
                          {message.content || "응답을 생성하는 중입니다."}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}

              <div ref={bottomRef} />
            </div>
          </section>

          <footer className="border-t border-white/10 px-4 py-2.5 sm:px-5">
            {error ? (
              <div
                role="alert"
                className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
              >
                {error}
              </div>
            ) : null}

            <form
              onSubmit={handleSubmit}
              className="mx-auto flex w-full max-w-3xl flex-col gap-2"
            >
              <label htmlFor="chat-input" className="text-xs text-zinc-400">
                메시지
              </label>
              <textarea
                id="chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onInput={(event) =>
                  setInput((event.target as HTMLTextAreaElement).value)
                }
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요. Enter로 전송, Shift+Enter로 줄바꿈"
                rows={2}
                className="min-h-[64px] w-full rounded-3xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
                aria-label="채팅 메시지 입력"
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <select
                    value={selectedModel}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={isStreaming}
                    className="max-w-[180px] cursor-pointer truncate rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs font-medium text-zinc-300 outline-none transition hover:border-white/20 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="LLM 모델 선택"
                    title={selectedModelOption.description}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {enabledTools.length > 0 && (
                    <span className="text-blue-400">
                      도구 {enabledTools.length}개 활성
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={cancelStream}
                      className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
                    >
                      중지
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={!input.trim() || isStreaming}
                    className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/40"
                  >
                    전송
                  </button>
                </div>
              </div>
            </form>
          </footer>
        </div>
      </div>
    </main>
  );
}
