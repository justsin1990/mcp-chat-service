export type Role = "user" | "assistant";

export type ToolCallStatus = "pending" | "running" | "done" | "error";

export interface ToolCallPart {
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  status: ToolCallStatus;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  toolCalls?: ToolCallPart[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  messages: Message[];
}

export interface ChatStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
}
