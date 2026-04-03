export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
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
