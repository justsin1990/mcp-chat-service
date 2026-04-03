export type McpTransportType = "streamable-http" | "stdio";

export interface McpStreamableHttpTransport {
  type: "streamable-http";
  url: string;
  headers?: Record<string, string>;
}

export interface McpStdioTransport {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export type McpTransport = McpStreamableHttpTransport | McpStdioTransport;

export interface McpServer {
  id: string;
  name: string;
  transport: McpTransport;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// --- 연결 상태 & capabilities ---

export type McpConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; required?: boolean }>;
}

export interface McpResource {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
}

export interface McpCapabilities {
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
}

export interface McpServerStatus {
  id: string;
  status: McpConnectionStatus;
  error?: string;
  capabilities?: McpCapabilities;
}

export interface McpToolWithServer {
  serverId: string;
  serverName: string;
  tool: McpTool;
}
