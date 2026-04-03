import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import type {
  McpCapabilities,
  McpConnectionStatus,
  McpPrompt,
  McpResource,
  McpServer,
  McpServerStatus,
  McpTool,
  McpToolWithServer,
} from "@/lib/types/mcp";

const CLIENT_NAME = "mcp-chat-service";
const CLIENT_VERSION = "0.1.0";
const CONNECT_TIMEOUT_MS = 30_000;

interface ClientEntry {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
  status: McpConnectionStatus;
  error?: string;
  capabilities: McpCapabilities;
  serverName: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __mcpRegistry: Map<string, ClientEntry> | undefined;
}

function getRegistry(): Map<string, ClientEntry> {
  if (!global.__mcpRegistry) {
    global.__mcpRegistry = new Map();
  }
  return global.__mcpRegistry;
}

function emptyCapabilities(): McpCapabilities {
  return { tools: [], prompts: [], resources: [] };
}

function toStatus(id: string, entry?: ClientEntry): McpServerStatus {
  if (!entry) {
    return { id, status: "idle" };
  }
  return {
    id,
    status: entry.status,
    ...(entry.error && { error: entry.error }),
    ...(entry.capabilities && { capabilities: entry.capabilities }),
  };
}

function createTransport(
  server: McpServer,
): StdioClientTransport | StreamableHTTPClientTransport {
  const t = server.transport;
  if (t.type === "streamable-http") {
    return new StreamableHTTPClientTransport(new URL(t.url), {
      requestInit: t.headers
        ? { headers: t.headers as Record<string, string> }
        : undefined,
    });
  }
  return new StdioClientTransport({
    command: t.command,
    args: t.args,
    env: t.env
      ? { ...process.env, ...t.env } as Record<string, string>
      : undefined,
  });
}

async function fetchAllTools(client: Client): Promise<McpTool[]> {
  const all: McpTool[] = [];
  let cursor: string | undefined;
  do {
    const res = await client.listTools({ cursor });
    for (const t of res.tools) {
      all.push({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown> | undefined,
      });
    }
    cursor = res.nextCursor;
  } while (cursor);
  return all;
}

async function fetchAllPrompts(client: Client): Promise<McpPrompt[]> {
  const all: McpPrompt[] = [];
  let cursor: string | undefined;
  do {
    const res = await client.listPrompts({ cursor });
    for (const p of res.prompts) {
      all.push({
        name: p.name,
        description: p.description,
        arguments: p.arguments as McpPrompt["arguments"],
      });
    }
    cursor = res.nextCursor;
  } while (cursor);
  return all;
}

async function fetchAllResources(client: Client): Promise<McpResource[]> {
  const all: McpResource[] = [];
  let cursor: string | undefined;
  do {
    const res = await client.listResources({ cursor });
    for (const r of res.resources) {
      all.push({
        name: r.name,
        uri: r.uri,
        description: r.description,
        mimeType: r.mimeType,
      });
    }
    cursor = res.nextCursor;
  } while (cursor);
  return all;
}

async function fetchCapabilities(client: Client): Promise<McpCapabilities> {
  const [tools, prompts, resources] = await Promise.all([
    fetchAllTools(client).catch(() => [] as McpTool[]),
    fetchAllPrompts(client).catch(() => [] as McpPrompt[]),
    fetchAllResources(client).catch(() => [] as McpResource[]),
  ]);
  return { tools, prompts, resources };
}

export async function connectServer(
  server: McpServer,
): Promise<McpServerStatus> {
  const registry = getRegistry();
  const existing = registry.get(server.id);
  if (existing?.status === "connecting") {
    return toStatus(server.id, existing);
  }
  if (existing?.status === "connected") {
    await disconnectServer(server.id);
  }

  const entry: ClientEntry = {
    client: new Client({ name: CLIENT_NAME, version: CLIENT_VERSION }),
    transport: createTransport(server),
    status: "connecting",
    capabilities: emptyCapabilities(),
    serverName: server.name,
  };
  registry.set(server.id, entry);

  try {
    const connectPromise = entry.client.connect(entry.transport);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("연결 시간이 초과되었습니다.")),
        CONNECT_TIMEOUT_MS,
      ),
    );
    await Promise.race([connectPromise, timeoutPromise]);

    entry.capabilities = await fetchCapabilities(entry.client);
    entry.status = "connected";
    entry.error = undefined;
  } catch (err) {
    entry.status = "error";
    entry.error =
      err instanceof Error ? err.message : "알 수 없는 연결 오류";

    try {
      await entry.client.close();
    } catch {
      // 정리 실패 무시
    }
  }

  return toStatus(server.id, entry);
}

export async function disconnectServer(id: string): Promise<void> {
  const registry = getRegistry();
  const entry = registry.get(id);
  if (!entry) return;

  try {
    if (entry.transport instanceof StreamableHTTPClientTransport) {
      await (entry.transport as StreamableHTTPClientTransport).terminateSession?.();
    }
    await entry.client.close();
  } catch {
    // 정리 실패 무시
  } finally {
    registry.delete(id);
  }
}

export function getServerStatus(id: string): McpServerStatus {
  return toStatus(id, getRegistry().get(id));
}

export function getAllStatuses(ids?: string[]): McpServerStatus[] {
  const registry = getRegistry();
  if (ids && ids.length > 0) {
    return ids.map((id) => toStatus(id, registry.get(id)));
  }
  return Array.from(registry.entries()).map(([id, entry]) =>
    toStatus(id, entry),
  );
}

function getConnectedClient(serverId: string): Client {
  const entry = getRegistry().get(serverId);
  if (!entry || entry.status !== "connected") {
    throw new Error("서버가 연결되어 있지 않습니다.");
  }
  return entry.client;
}

export async function callTool(
  serverId: string,
  name: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const client = getConnectedClient(serverId);
  const result = await client.callTool(
    { name, arguments: args },
    undefined,
    { timeout: CONNECT_TIMEOUT_MS },
  );
  return result;
}

export async function getPrompt(
  serverId: string,
  name: string,
  args?: Record<string, string>,
): Promise<unknown> {
  const client = getConnectedClient(serverId);
  const result = await client.getPrompt(
    { name, arguments: args },
    { timeout: CONNECT_TIMEOUT_MS },
  );
  return result;
}

export async function readResource(
  serverId: string,
  uri: string,
): Promise<unknown> {
  const client = getConnectedClient(serverId);
  const result = await client.readResource(
    { uri },
    { timeout: CONNECT_TIMEOUT_MS },
  );
  return result;
}

export function getConnectedToolsWithServer(): McpToolWithServer[] {
  const registry = getRegistry();
  const result: McpToolWithServer[] = [];

  for (const [serverId, entry] of registry.entries()) {
    if (entry.status !== "connected") continue;
    for (const tool of entry.capabilities.tools) {
      result.push({ serverId, serverName: entry.serverName, tool });
    }
  }

  return result;
}

export interface ToolFunctionDeclaration {
  name: string;
  description: string;
  parametersJsonSchema?: Record<string, unknown>;
}

export interface ToolServerMapping {
  serverId: string;
  serverName: string;
}

export function getToolsForGemini(
  filter?: Array<{ serverId: string; toolName: string }>,
): {
  declarations: ToolFunctionDeclaration[];
  mapping: Map<string, ToolServerMapping>;
} {
  const allTools = getConnectedToolsWithServer();
  const filtered = filter
    ? allTools.filter((t) =>
        filter.some(
          (f) => f.serverId === t.serverId && f.toolName === t.tool.name,
        ),
      )
    : allTools;

  const declarations: ToolFunctionDeclaration[] = [];
  const mapping = new Map<string, ToolServerMapping>();

  for (const { serverId, serverName, tool } of filtered) {
    const key = `${serverId}::${tool.name}`;
    const uniqueName = mapping.has(tool.name)
      ? `${tool.name}__${serverId.slice(0, 8)}`
      : tool.name;

    declarations.push({
      name: uniqueName,
      description: tool.description ?? `Tool: ${tool.name}`,
      parametersJsonSchema: sanitizeSchema(tool.inputSchema),
    });

    mapping.set(uniqueName, { serverId, serverName });
  }

  return { declarations, mapping };
}

function sanitizeSchema(
  schema?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!schema) return undefined;

  const cleaned = { ...schema };
  delete cleaned.$schema;
  delete cleaned.additionalProperties;

  if (cleaned.type === "object" && !cleaned.properties) {
    cleaned.properties = {};
  }

  return cleaned;
}
