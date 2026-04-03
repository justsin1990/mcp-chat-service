"use client";

import { useState } from "react";

import type { ChatSession } from "@/lib/types/chat";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  sessions: ChatSession[];
  deletedSessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming?: boolean;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRestoreSession: (sessionId: string) => void;
  onMoveSession: (fromId: string, toId: string) => void;
}

export function ChatSidebar({
  sessions,
  deletedSessions,
  activeSessionId,
  isStreaming = false,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onRestoreSession,
  onMoveSession,
}: ChatSidebarProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<{ sessionId: string } | null>(null);

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-white/10 bg-black/20">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          Chats
        </p>
        <button
          type="button"
          onClick={() => {
            setMenuState(null);
            onCreateSession();
          }}
          disabled={isStreaming}
          className="rounded-full border border-white/10 px-2.5 py-1 text-sm text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="새 채팅 시작"
        >
          +
        </button>
      </div>

      <div className="chat-scrollbar flex-1 overflow-y-auto px-2 py-3">
        <div className="flex flex-col gap-2">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isMenuOpen = menuState?.sessionId === session.id;

            return (
              <div key={session.id} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuState(null);
                    onSelectSession(session.id);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenuState((current) =>
                      current?.sessionId === session.id
                        ? null
                        : { sessionId: session.id },
                    );
                  }}
                  onDragStart={() => setDraggingId(session.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={() => {
                    if (draggingId) {
                      onMoveSession(draggingId, session.id);
                    }
                    setDraggingId(null);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  draggable={!isStreaming}
                  disabled={isStreaming}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-left transition",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    draggingId === session.id ? "opacity-60" : "",
                    isActive
                      ? "border-blue-400/40 bg-blue-500/15"
                      : "border-transparent bg-white/5 hover:border-white/10 hover:bg-white/8",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {session.title}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        메시지 {session.messages.length}개
                      </p>
                    </div>

                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setMenuState((current) =>
                          current?.sessionId === session.id
                            ? null
                            : { sessionId: session.id },
                        );
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          setMenuState((current) =>
                            current?.sessionId === session.id
                              ? null
                              : { sessionId: session.id },
                          );
                        }
                      }}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                      aria-label="세션 메뉴 열기"
                    >
                      ⋯
                    </span>
                  </div>
                </button>

                {isMenuOpen ? (
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/90 p-1 shadow-xl backdrop-blur">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteSession(session.id);
                        setMenuState(null);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-200 transition hover:bg-white/8"
                    >
                      삭제
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/10 px-3 py-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          휴지통
        </p>

        <div className="chat-scrollbar max-h-40 overflow-y-auto pr-1">
          <div className="flex flex-col gap-2">
            {deletedSessions.length === 0 ? (
              <p className="rounded-2xl bg-white/5 px-3 py-3 text-xs text-zinc-500">
                삭제된 섹션이 없습니다.
              </p>
            ) : (
              deletedSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                >
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {session.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRestoreSession(session.id)}
                    className="mt-2 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-200 transition hover:bg-white/10"
                  >
                    복구
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </aside>
  );
}
