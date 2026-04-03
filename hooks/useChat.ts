"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiErrorBody } from "@/lib/errors";
import type { ChatSession, ChatStore, Message, ToolCallPart } from "@/lib/types/chat";

const STORAGE_KEY = "mcp-chat-service:chat-store";
const LEGACY_STORAGE_KEY = "mcp-chat-service:messages";
const DEFAULT_CHAT_TITLE = "새 채팅";
const INITIAL_SESSION_ID = "initial-session";

interface EnabledTool {
  serverId: string;
  toolName: string;
}

interface UseChatReturn {
  sessions: ChatSession[];
  visibleSessions: ChatSession[];
  deletedSessions: ChatSession[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  messages: Message[];
  error: string | null;
  isStreaming: boolean;
  sendMessage: (content: string, enabledTools?: EnabledTool[], model?: string) => Promise<void>;
  cancelStream: () => void;
  createSession: () => void;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  restoreSession: (sessionId: string) => void;
  moveSession: (fromId: string, toId: string) => void;
}

interface StreamEvent {
  event: string;
  data: string;
}

export function useChat(): UseChatReturn {
  const [store, setStore] = useState<ChatStore>({
    sessions: [createInitialSession()],
    activeSessionId: INITIAL_SESSION_ID,
  });
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeSession =
    store.sessions.find((session) => session.id === store.activeSessionId) ?? null;
  const visibleSessions = store.sessions.filter((session) => session.deletedAt === null);
  const deletedSessions = store.sessions.filter((session) => session.deletedAt !== null);
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ChatStore>;

        if (isValidChatStore(parsed)) {
          setStore(ensureActiveSession(normalizeStore(parsed)));
          setHasLoaded(true);
          return;
        }
      }

      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);

      if (legacy) {
        const parsed = JSON.parse(legacy) as Message[];

        if (Array.isArray(parsed)) {
          const migratedSession = createSessionRecord(parsed);

          setStore({
            sessions: [migratedSession],
            activeSessionId: migratedSession.id,
          });
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          setHasLoaded(true);
          return;
        }
      }

      const initialSession = createSessionRecord();

      setStore({
        sessions: [initialSession],
        activeSessionId: initialSession.id,
      });
    } catch {
      const initialSession = createSessionRecord();

      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      setStore({
        sessions: [initialSession],
        activeSessionId: initialSession.id,
      });
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // 저장 실패 시 메모리 상태는 유지한다.
    }
  }, [hasLoaded, store]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const createSession = useCallback(() => {
    if (isStreaming) {
      return;
    }

    const nextSession = createSessionRecord();

    setStore((current) => ({
      sessions: [nextSession, ...current.sessions],
      activeSessionId: nextSession.id,
    }));
    setError(null);
  }, [isStreaming]);

  const selectSession = useCallback(
    (sessionId: string) => {
      if (isStreaming) {
        return;
      }

      setStore((current) => {
        if (
          !current.sessions.some(
            (session) => session.id === sessionId && session.deletedAt === null,
          )
        ) {
          return current;
        }

        return {
          ...current,
          activeSessionId: sessionId,
        };
      });
      setError(null);
    },
    [isStreaming],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      if (isStreaming) {
        return;
      }

      setStore((current) => {
        const target = current.sessions.find((session) => session.id === sessionId);

        if (!target || target.deletedAt !== null) {
          return current;
        }

        const nextSessions = current.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, deletedAt: Date.now(), updatedAt: Date.now() }
            : session,
        );
        const visibleAfterDelete = nextSessions.filter(
          (session) => session.deletedAt === null,
        );

        if (visibleAfterDelete.length === 0) {
          const fallbackSession = createSessionRecord();

          return {
            sessions: [fallbackSession, ...nextSessions],
            activeSessionId: fallbackSession.id,
          };
        }

        const nextActiveId =
          current.activeSessionId === sessionId
            ? visibleAfterDelete[0].id
            : current.activeSessionId;

        return {
          sessions: nextSessions,
          activeSessionId: nextActiveId,
        };
      });
    },
    [isStreaming],
  );

  const restoreSession = useCallback((sessionId: string) => {
    setStore((current) => {
      const target = current.sessions.find((session) => session.id === sessionId);

      if (!target || target.deletedAt === null) {
        return current;
      }

      return ensureActiveSession({
        sessions: current.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, deletedAt: null, updatedAt: Date.now() }
            : session,
        ),
        activeSessionId: current.activeSessionId,
      });
    });
  }, []);

  const moveSession = useCallback(
    (fromId: string, toId: string) => {
      if (isStreaming || fromId === toId) {
        return;
      }

      setStore((current) => {
        const fromIndex = current.sessions.findIndex(
          (session) => session.id === fromId && session.deletedAt === null,
        );
        const toIndex = current.sessions.findIndex(
          (session) => session.id === toId && session.deletedAt === null,
        );

        if (fromIndex === -1 || toIndex === -1) {
          return current;
        }

        const nextSessions = [...current.sessions];
        const [moved] = nextSessions.splice(fromIndex, 1);
        nextSessions.splice(toIndex, 0, moved);

        return {
          ...current,
          sessions: nextSessions,
        };
      });
    },
    [isStreaming],
  );

  const sendMessage = useCallback(
    async (content: string, enabledTools?: EnabledTool[], model?: string) => {
      const trimmed = content.trim();
      const session = store.sessions.find(
        (currentSession) =>
          currentSession.id === store.activeSessionId &&
          currentSession.deletedAt === null,
      );

      if (!trimmed || isStreaming || !session) {
        return;
      }

      const sessionId = session.id;
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };
      const requestMessages = [...session.messages, userMessage];
      const contextMessages = buildContextMessages(
        store.sessions,
        sessionId,
        requestMessages,
      );
      const nextTitle =
        session.title === DEFAULT_CHAT_TITLE
          ? createSessionTitle(trimmed)
          : session.title;

      setError(null);
      setIsStreaming(true);
      setStore((current) => ({
        ...current,
        sessions: current.sessions.map((currentSession) =>
          currentSession.id === sessionId
            ? {
                ...currentSession,
                title: nextTitle,
                updatedAt: Date.now(),
                messages: [...requestMessages, assistantMessage],
              }
            : currentSession,
        ),
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: contextMessages,
            enabledTools: enabledTools ?? [],
            model,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = (await response.json()) as Partial<ApiErrorBody>;
          throw new Error(payload.message ?? "메시지 전송에 실패했습니다.");
        }

        if (!response.body) {
          throw new Error("스트리밍 응답을 읽을 수 없습니다.");
        }

        await consumeStream(response.body, (event) => {
          if (event.event === "message") {
            const payload = parseStreamPayload(event.data);
            const text =
              typeof payload.text === "string" ? payload.text : "";

            if (!text) {
              return;
            }

            setStore((current) => ({
              ...current,
              sessions: current.sessions.map((currentSession) =>
                currentSession.id === sessionId
                  ? {
                      ...currentSession,
                      updatedAt: Date.now(),
                      messages: currentSession.messages.map((message) =>
                        message.id === assistantMessage.id
                          ? { ...message, content: message.content + text }
                          : message,
                      ),
                    }
                  : currentSession,
              ),
            }));
            return;
          }

          if (event.event === "tool_call") {
            const payload = parseStreamPayload(event.data);
            const toolCall: ToolCallPart = {
              id: typeof payload.id === "string" ? payload.id : crypto.randomUUID(),
              serverId: typeof payload.serverId === "string" ? payload.serverId : "",
              serverName: typeof payload.serverName === "string" ? payload.serverName : "unknown",
              name: typeof payload.name === "string" ? payload.name : "",
              args: (typeof payload.args === "object" && payload.args !== null
                ? payload.args
                : {}) as Record<string, unknown>,
              status: "running",
            };

            setStore((current) => ({
              ...current,
              sessions: current.sessions.map((currentSession) =>
                currentSession.id === sessionId
                  ? {
                      ...currentSession,
                      updatedAt: Date.now(),
                      messages: currentSession.messages.map((message) =>
                        message.id === assistantMessage.id
                          ? {
                              ...message,
                              toolCalls: [...(message.toolCalls ?? []), toolCall],
                            }
                          : message,
                      ),
                    }
                  : currentSession,
              ),
            }));
            return;
          }

          if (event.event === "tool_result") {
            const payload = parseStreamPayload(event.data);
            const toolCallId = typeof payload.id === "string" ? payload.id : "";
            const result = payload.result;
            const isError = payload.isError === true;

            setStore((current) => ({
              ...current,
              sessions: current.sessions.map((currentSession) =>
                currentSession.id === sessionId
                  ? {
                      ...currentSession,
                      updatedAt: Date.now(),
                      messages: currentSession.messages.map((message) =>
                        message.id === assistantMessage.id
                          ? {
                              ...message,
                              toolCalls: (message.toolCalls ?? []).map((tc) =>
                                tc.id === toolCallId
                                  ? { ...tc, result, isError, status: isError ? "error" as const : "done" as const }
                                  : tc,
                              ),
                            }
                          : message,
                      ),
                    }
                  : currentSession,
              ),
            }));
            return;
          }

          if (event.event === "error") {
            const payload = parseStreamPayload(event.data);
            const message =
              typeof payload.message === "string"
                ? payload.message
                : "응답 생성 중 오류가 발생했습니다.";

            throw new Error(message);
          }
        });
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          setError(error.message);
        }
      } finally {
        setStore((current) => ({
          ...current,
          sessions: current.sessions.map((currentSession) =>
            currentSession.id === sessionId
              ? {
                  ...currentSession,
                  updatedAt: Date.now(),
                  messages: currentSession.messages.filter((message) => {
                    if (message.id !== assistantMessage.id) return true;
                    const hasToolCalls = (message.toolCalls ?? []).length > 0;
                    return message.content.length > 0 || hasToolCalls;
                  }),
                }
              : currentSession,
          ),
        }));
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, store],
  );

  return {
    sessions: store.sessions,
    visibleSessions,
    deletedSessions,
    activeSessionId: store.activeSessionId,
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
  };
}

function createSessionTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return DEFAULT_CHAT_TITLE;
  }

  return normalized.length > 22 ? `${normalized.slice(0, 22)}...` : normalized;
}

function createSessionRecord(messages: Message[] = []): ChatSession {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    title:
      messages.length > 0 && messages[0]?.role === "user"
        ? createSessionTitle(messages[0].content)
        : DEFAULT_CHAT_TITLE,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    messages,
  };
}

function createInitialSession(): ChatSession {
  const now = Date.now();

  return {
    id: INITIAL_SESSION_ID,
    title: DEFAULT_CHAT_TITLE,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    messages: [],
  };
}

function ensureActiveSession(store: ChatStore): ChatStore {
  const visibleSessions = store.sessions.filter((session) => session.deletedAt === null);

  if (visibleSessions.length === 0) {
    const initialSession = createSessionRecord();

    return {
      sessions: [initialSession, ...store.sessions],
      activeSessionId: initialSession.id,
    };
  }

  const hasActiveSession = visibleSessions.some(
    (session) => session.id === store.activeSessionId,
  );

  return {
    sessions: store.sessions,
    activeSessionId: hasActiveSession ? store.activeSessionId : visibleSessions[0].id,
  };
}

function isValidChatStore(value: Partial<ChatStore>): value is ChatStore {
  return (
    Array.isArray(value.sessions) &&
    (typeof value.activeSessionId === "string" || value.activeSessionId === null)
  );
}

function normalizeStore(store: ChatStore): ChatStore {
  return {
    sessions: store.sessions.map((session) => normalizeSession(session)),
    activeSessionId: store.activeSessionId,
  };
}

function normalizeSession(session: ChatSession): ChatSession {
  return {
    ...session,
    deletedAt: session.deletedAt ?? null,
  };
}

function buildContextMessages(
  sessions: ChatSession[],
  activeSessionId: string,
  nextActiveMessages: Message[],
): Message[] {
  const sharedMessages: Message[] = [];

  for (const session of sessions) {
    if (session.deletedAt !== null || session.id === activeSessionId) {
      continue;
    }

    sharedMessages.push(...session.messages);
  }

  return [...sharedMessages, ...nextActiveMessages];
}

async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const segments = buffer.split("\n\n");
      buffer = segments.pop() ?? "";

      for (const segment of segments) {
        const event = parseEventSegment(segment);

        if (!event) {
          continue;
        }

        onEvent(event);

        if (event.event === "done") {
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEventSegment(segment: string): StreamEvent | null {
  const lines = segment.split("\n");
  let event = "message";
  const data: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      data.push(line.slice(5).trim());
    }
  }

  if (data.length === 0) {
    return null;
  }

  return {
    event,
    data: data.join("\n"),
  };
}

function parseStreamPayload(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    return parsed;
  } catch {
    return {};
  }
}
