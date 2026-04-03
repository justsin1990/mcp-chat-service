"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiErrorBody } from "@/lib/errors";
import type { ChatSession, ChatStore, Message, ToolCallPart } from "@/lib/types/chat";
import {
  deleteMessage,
  fetchActiveSessionId,
  fetchAllSessions,
  insertMessage,
  insertSession,
  restoreSessionInDb,
  saveActiveSessionId,
  softDeleteSession,
  updateMessage,
  updateSession,
  updateSessionPositions,
} from "@/lib/db/chat";
import { uploadBase64Image } from "@/lib/db/storage";

const DEFAULT_CHAT_TITLE = "새 채팅";

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
    sessions: [],
    activeSessionId: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeSession =
    store.sessions.find((session) => session.id === store.activeSessionId) ?? null;
  const visibleSessions = store.sessions.filter((session) => session.deletedAt === null);
  const deletedSessions = store.sessions.filter((session) => session.deletedAt !== null);
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [sessions, savedActiveId] = await Promise.all([
          fetchAllSessions(),
          fetchActiveSessionId(),
        ]);

        if (cancelled) return;

        if (sessions.length === 0) {
          const initial = createSessionRecord();
          await insertSession(initial, 0);
          if (cancelled) return;
          setStore({ sessions: [initial], activeSessionId: initial.id });
          await saveActiveSessionId(initial.id);
        } else {
          const resolved = ensureActiveSession({
            sessions,
            activeSessionId: savedActiveId,
          });
          setStore(resolved);
          if (resolved.activeSessionId !== savedActiveId) {
            await saveActiveSessionId(resolved.activeSessionId);
          }
        }
      } catch {
        const initial = createSessionRecord();
        if (!cancelled) {
          setStore({ sessions: [initial], activeSessionId: initial.id });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const createSession = useCallback(() => {
    if (isStreaming) return;

    const nextSession = createSessionRecord();

    setStore((current) => {
      const newSessions = [nextSession, ...current.sessions];
      insertSession(nextSession, 0).then(() =>
        updateSessionPositions(newSessions.map((s) => s.id)),
      );
      saveActiveSessionId(nextSession.id);
      return { sessions: newSessions, activeSessionId: nextSession.id };
    });
    setError(null);
  }, [isStreaming]);

  const selectSession = useCallback(
    (sessionId: string) => {
      if (isStreaming) return;

      setStore((current) => {
        if (
          !current.sessions.some(
            (session) => session.id === sessionId && session.deletedAt === null,
          )
        ) {
          return current;
        }

        saveActiveSessionId(sessionId);
        return { ...current, activeSessionId: sessionId };
      });
      setError(null);
    },
    [isStreaming],
  );

  const deleteSessionHandler = useCallback(
    (sessionId: string) => {
      if (isStreaming) return;

      setStore((current) => {
        const target = current.sessions.find((session) => session.id === sessionId);
        if (!target || target.deletedAt !== null) return current;

        const now = Date.now();
        softDeleteSession(sessionId);

        const nextSessions = current.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, deletedAt: now, updatedAt: now }
            : session,
        );
        const visibleAfterDelete = nextSessions.filter(
          (session) => session.deletedAt === null,
        );

        if (visibleAfterDelete.length === 0) {
          const fallbackSession = createSessionRecord();
          insertSession(fallbackSession, 0).then(() =>
            updateSessionPositions([fallbackSession.id, ...nextSessions.map((s) => s.id)]),
          );
          saveActiveSessionId(fallbackSession.id);
          return {
            sessions: [fallbackSession, ...nextSessions],
            activeSessionId: fallbackSession.id,
          };
        }

        const nextActiveId =
          current.activeSessionId === sessionId
            ? visibleAfterDelete[0].id
            : current.activeSessionId;

        if (current.activeSessionId === sessionId) {
          saveActiveSessionId(nextActiveId);
        }

        return { sessions: nextSessions, activeSessionId: nextActiveId };
      });
    },
    [isStreaming],
  );

  const restoreSessionHandler = useCallback((sessionId: string) => {
    setStore((current) => {
      const target = current.sessions.find((session) => session.id === sessionId);
      if (!target || target.deletedAt === null) return current;

      restoreSessionInDb(sessionId);

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
      if (isStreaming || fromId === toId) return;

      setStore((current) => {
        const fromIndex = current.sessions.findIndex(
          (session) => session.id === fromId && session.deletedAt === null,
        );
        const toIndex = current.sessions.findIndex(
          (session) => session.id === toId && session.deletedAt === null,
        );

        if (fromIndex === -1 || toIndex === -1) return current;

        const nextSessions = [...current.sessions];
        const [moved] = nextSessions.splice(fromIndex, 1);
        nextSessions.splice(toIndex, 0, moved);

        updateSessionPositions(nextSessions.map((s) => s.id));

        return { ...current, sessions: nextSessions };
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

      if (!trimmed || isStreaming || !session) return;

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

      insertMessage(sessionId, userMessage);
      insertMessage(sessionId, assistantMessage);
      if (nextTitle !== session.title) {
        updateSession(sessionId, { title: nextTitle, updatedAt: Date.now() });
      }

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
          headers: { "Content-Type": "application/json" },
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
            const text = typeof payload.text === "string" ? payload.text : "";
            if (!text) return;

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
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setStore((current) => {
          const updatedSessions = current.sessions.map((currentSession) => {
            if (currentSession.id !== sessionId) return currentSession;

            const filtered = currentSession.messages.filter((message) => {
              if (message.id !== assistantMessage.id) return true;
              const hasToolCalls = (message.toolCalls ?? []).length > 0;
              return message.content.length > 0 || hasToolCalls;
            });

            const finalAssistant = filtered.find((m) => m.id === assistantMessage.id);
            if (finalAssistant) {
              persistAssistantMessage(sessionId, finalAssistant);
            } else {
              deleteMessage(assistantMessage.id);
            }

            return { ...currentSession, updatedAt: Date.now(), messages: filtered };
          });

          return { ...current, sessions: updatedSessions };
        });
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
    deleteSession: deleteSessionHandler,
    restoreSession: restoreSessionHandler,
    moveSession,
  };
}

function createSessionTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return DEFAULT_CHAT_TITLE;
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

function buildContextMessages(
  sessions: ChatSession[],
  activeSessionId: string,
  nextActiveMessages: Message[],
): Message[] {
  const sharedMessages: Message[] = [];

  for (const session of sessions) {
    if (session.deletedAt !== null || session.id === activeSessionId) continue;
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
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const segments = buffer.split("\n\n");
      buffer = segments.pop() ?? "";

      for (const segment of segments) {
        const event = parseEventSegment(segment);
        if (!event) continue;
        onEvent(event);
        if (event.event === "done") return;
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

  if (data.length === 0) return null;
  return { event, data: data.join("\n") };
}

function parseStreamPayload(data: string): Record<string, unknown> {
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface McpContentItem {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

interface McpToolResult {
  content?: McpContentItem[];
  [key: string]: unknown;
}

async function uploadToolCallImages(toolCalls: ToolCallPart[]): Promise<ToolCallPart[]> {
  const results: ToolCallPart[] = [];

  for (const tc of toolCalls) {
    if (!tc.result || typeof tc.result !== "object") {
      results.push(tc);
      continue;
    }

    const mcpResult = tc.result as McpToolResult;
    if (!Array.isArray(mcpResult.content)) {
      results.push(tc);
      continue;
    }

    let changed = false;
    const updatedContent: McpContentItem[] = [];

    for (const item of mcpResult.content) {
      if (item.type === "image" && item.data && item.mimeType) {
        const publicUrl = await uploadBase64Image(item.data, item.mimeType);
        if (publicUrl) {
          updatedContent.push({
            type: "image",
            text: publicUrl,
            mimeType: item.mimeType,
          });
          changed = true;
          continue;
        }
      }
      updatedContent.push(item);
    }

    if (changed) {
      results.push({
        ...tc,
        result: { ...mcpResult, content: updatedContent },
      });
    } else {
      results.push(tc);
    }
  }

  return results;
}

async function persistAssistantMessage(sessionId: string, message: Message): Promise<void> {
  try {
    let toolCalls = message.toolCalls;

    if (toolCalls && toolCalls.length > 0) {
      toolCalls = await uploadToolCallImages(toolCalls);
    }

    await updateMessage(message.id, {
      content: message.content,
      toolCalls,
    });
    await updateSession(sessionId, { updatedAt: Date.now() });
  } catch {
    // DB 저장 실패 시 메모리 상태는 유지
  }
}
