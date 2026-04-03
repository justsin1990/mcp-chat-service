"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { MarkdownMessage } from "@/components/chat/MarkdownMessage";
import { useChat } from "@/hooks/useChat";
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
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isStreaming, messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextValue = input.trim();

    if (!nextValue) {
      return;
    }

    setInput("");
    await sendMessage(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-6 text-zinc-50 sm:px-6">
      <div className="flex h-[min(88vh,860px)] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
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
            <p className="text-xs text-zinc-500">
              활성 섹션 {visibleSessions.length}개 / 전체 {sessions.length}개
            </p>
          </header>

          <section className="border-b border-white/10 bg-amber-500/10 px-4 py-2 text-xs text-amber-100 sm:px-5">
            채팅 내역은 현재 브라우저의 localStorage에 저장됩니다. 공용 PC에서는
            민감한 내용을 입력하지 마세요.
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
                      {isAssistant ? (
                        <MarkdownMessage
                          content={message.content}
                          isStreaming={isStreamingBubble}
                        />
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
                <p className="text-xs text-zinc-500">
                  모델: <span className="font-medium text-zinc-300">gemini-2.5-flash-lite</span>
                </p>
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
