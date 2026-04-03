import { supabase } from "@/lib/supabase";
import type { McpServer, McpTransport } from "@/lib/types/mcp";

/* ------------------------------------------------------------------ */
/*  DB row <-> domain type 매핑                                        */
/* ------------------------------------------------------------------ */

interface McpServerRow {
  id: string;
  name: string;
  transport: McpTransport;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

function toMcpServer(row: McpServerRow): McpServer {
  return {
    id: row.id,
    name: row.name,
    transport: row.transport,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ------------------------------------------------------------------ */
/*  CRUD                                                               */
/* ------------------------------------------------------------------ */

export async function fetchMcpServers(): Promise<McpServer[]> {
  const { data, error } = await supabase
    .from("mcp_servers")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as McpServerRow[]).map(toMcpServer);
}

export async function insertMcpServer(server: McpServer): Promise<void> {
  const { error } = await supabase.from("mcp_servers").insert({
    id: server.id,
    name: server.name,
    transport: server.transport,
    enabled: server.enabled,
    created_at: server.createdAt,
    updated_at: server.updatedAt,
  });
  if (error) throw error;
}

export async function updateMcpServer(
  id: string,
  data: Partial<Omit<McpServer, "id" | "createdAt">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.transport !== undefined) row.transport = data.transport;
  if (data.enabled !== undefined) row.enabled = data.enabled;
  if (data.updatedAt !== undefined) row.updated_at = data.updatedAt;

  const { error } = await supabase.from("mcp_servers").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteMcpServer(id: string): Promise<void> {
  const { error } = await supabase.from("mcp_servers").delete().eq("id", id);
  if (error) throw error;
}
