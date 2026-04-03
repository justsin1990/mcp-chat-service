import { supabase } from "@/lib/supabase";
import type { ChatSession, Message, ToolCallPart } from "@/lib/types/chat";

/* ------------------------------------------------------------------ */
/*  DB row <-> domain type 매핑                                        */
/* ------------------------------------------------------------------ */

interface SessionRow {
  id: string;
  title: string;
  position: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
  tool_calls: ToolCallPart[] | null;
}

function toSession(row: SessionRow, messages: Message[]): ChatSession {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    messages,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    toolCalls: row.tool_calls ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  세션 CRUD                                                          */
/* ------------------------------------------------------------------ */

export async function fetchAllSessions(): Promise<ChatSession[]> {
  const { data: sessionRows, error: sErr } = await supabase
    .from("chat_sessions")
    .select("*")
    .order("position", { ascending: true });

  if (sErr) throw sErr;
  if (!sessionRows || sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((r: SessionRow) => r.id);

  const { data: messageRows, error: mErr } = await supabase
    .from("messages")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });

  if (mErr) throw mErr;

  const messagesBySession = new Map<string, Message[]>();
  for (const row of (messageRows ?? []) as MessageRow[]) {
    const list = messagesBySession.get(row.session_id) ?? [];
    list.push(toMessage(row));
    messagesBySession.set(row.session_id, list);
  }

  return (sessionRows as SessionRow[]).map((row) =>
    toSession(row, messagesBySession.get(row.id) ?? []),
  );
}

export async function insertSession(session: ChatSession, position: number): Promise<void> {
  const { error } = await supabase.from("chat_sessions").insert({
    id: session.id,
    title: session.title,
    position,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    deleted_at: session.deletedAt,
  });
  if (error) throw error;
}

export async function updateSession(
  id: string,
  data: Partial<Pick<ChatSession, "title" | "updatedAt" | "deletedAt">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (data.title !== undefined) row.title = data.title;
  if (data.updatedAt !== undefined) row.updated_at = data.updatedAt;
  if (data.deletedAt !== undefined) row.deleted_at = data.deletedAt;

  const { error } = await supabase.from("chat_sessions").update(row).eq("id", id);
  if (error) throw error;
}

export async function softDeleteSession(id: string): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("chat_sessions")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id);
  if (error) throw error;
}

export async function restoreSessionInDb(id: string): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("chat_sessions")
    .update({ deleted_at: null, updated_at: now })
    .eq("id", id);
  if (error) throw error;
}

export async function updateSessionPositions(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    supabase.from("chat_sessions").update({ position: index }).eq("id", id),
  );
  await Promise.all(updates);
}

/* ------------------------------------------------------------------ */
/*  메시지 CRUD                                                        */
/* ------------------------------------------------------------------ */

export async function insertMessage(sessionId: string, message: Message): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    id: message.id,
    session_id: sessionId,
    role: message.role,
    content: message.content,
    created_at: message.createdAt,
    tool_calls: message.toolCalls ?? null,
  });
  if (error) throw error;
}

export async function updateMessage(
  id: string,
  data: Partial<Pick<Message, "content" | "toolCalls">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (data.content !== undefined) row.content = data.content;
  if (data.toolCalls !== undefined) row.tool_calls = data.toolCalls;

  const { error } = await supabase.from("messages").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  activeSessionId (user_settings 경유)                               */
/* ------------------------------------------------------------------ */

const ACTIVE_SESSION_KEY = "active-session-id";

export async function fetchActiveSessionId(): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("value")
    .eq("key", ACTIVE_SESSION_KEY)
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? null;
}

export async function saveActiveSessionId(id: string | null): Promise<void> {
  if (id === null) {
    await supabase.from("user_settings").delete().eq("key", ACTIVE_SESSION_KEY);
    return;
  }

  const { error } = await supabase.from("user_settings").upsert(
    { key: ACTIVE_SESSION_KEY, value: id },
    { onConflict: "key" },
  );
  if (error) throw error;
}
