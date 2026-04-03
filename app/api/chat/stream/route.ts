import {
  GoogleGenAI,
  type Content,
  type FunctionDeclaration,
  type Part,
  type Tool,
} from "@google/genai";
import { NextRequest } from "next/server";

import { getConfig } from "@/lib/config";
import { AppError, toApiError } from "@/lib/errors";
import {
  callTool,
  getToolsForGemini,
  type ToolServerMapping,
} from "@/lib/mcp/manager.server";
import { isValidModel } from "@/lib/models";
import type { Message } from "@/lib/types/chat";

const encoder = new TextEncoder();
const MAX_TOOL_ROUNDS = 10;

export const runtime = "nodejs";

interface EnabledTool {
  serverId: string;
  toolName: string;
}

interface ChatRequestBody {
  messages: Message[];
  enabledTools?: EnabledTool[];
  model?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const messages = validateMessages(body);
    const enabledTools = body.enabledTools ?? [];
    const { geminiApiKey, llmModel: defaultModel } = getConfig();
    const llmModel =
      body.model && isValidModel(body.model) ? body.model : defaultModel;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });
          const contents = toContents(messages);

          const toolConfig =
            enabledTools.length > 0
              ? getToolsForGemini(enabledTools)
              : null;

          const geminiTools: Tool[] | undefined = toolConfig
            ? [{
                functionDeclarations:
                  toolConfig.declarations as unknown as FunctionDeclaration[],
              }]
            : undefined;

          await streamWithToolLoop(
            ai,
            llmModel,
            contents,
            geminiTools,
            toolConfig?.mapping ?? new Map(),
            request.signal,
            controller,
          );

          controller.enqueue(encodeEvent("done", { done: true }));
        } catch (error) {
          controller.enqueue(
            encodeEvent("error", {
              message: toUserFriendlyError(error),
            }),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    });
  } catch (error) {
    return toApiError(error);
  }
}

interface CollectedFunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

async function streamWithToolLoop(
  ai: GoogleGenAI,
  model: string,
  contents: Content[],
  tools: Tool[] | undefined,
  mapping: Map<string, ToolServerMapping>,
  signal: AbortSignal,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { text, functionCalls } = await streamOneRound(
      ai,
      model,
      contents,
      tools,
      signal,
      controller,
    );

    if (functionCalls.length === 0) {
      return;
    }

    const modelParts: Part[] = [];
    if (text) {
      modelParts.push({ text });
    }
    for (const fc of functionCalls) {
      modelParts.push({
        functionCall: { name: fc.name, args: fc.args },
      });
    }
    contents.push({ role: "model", parts: modelParts });

    const responseParts: Part[] = [];
    for (const fc of functionCalls) {
      const server = mapping.get(fc.name);
      const serverId = server?.serverId ?? "";
      const serverName = server?.serverName ?? "unknown";
      const toolCallId = crypto.randomUUID();

      controller.enqueue(
        encodeEvent("tool_call", {
          id: toolCallId,
          serverId,
          serverName,
          name: fc.name,
          args: fc.args,
        }),
      );

      let result: unknown;
      let isError = false;

      try {
        result = await callTool(serverId, fc.name, fc.args);
      } catch (err) {
        isError = true;
        result = {
          error: err instanceof Error ? err.message : "도구 실행에 실패했습니다.",
        };
      }

      controller.enqueue(
        encodeEvent("tool_result", {
          id: toolCallId,
          result,
          isError,
        }),
      );

      const responseValue = toGeminiResponse(result);

      responseParts.push({
        functionResponse: { name: fc.name, response: responseValue },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }
}

async function streamOneRound(
  ai: GoogleGenAI,
  model: string,
  contents: Content[],
  tools: Tool[] | undefined,
  signal: AbortSignal,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<{ text: string; functionCalls: CollectedFunctionCall[] }> {
  let accumulatedText = "";
  const functionCalls: CollectedFunctionCall[] = [];

  const response = await ai.models.generateContentStream({
    model,
    contents,
    config: {
      abortSignal: signal,
      tools,
    },
  });

  for await (const chunk of response) {
    if (chunk.text) {
      const trimmed = chunk.text.trim();
      if (looksLikeApiError(trimmed)) {
        throw new Error(chunk.text);
      }

      accumulatedText += chunk.text;
      controller.enqueue(encodeEvent("message", { text: chunk.text }));
    }

    if (chunk.functionCalls) {
      for (const fc of chunk.functionCalls) {
        if (fc.name) {
          functionCalls.push({
            id: fc.id ?? crypto.randomUUID(),
            name: fc.name,
            args: (fc.args as Record<string, unknown>) ?? {},
          });
        }
      }
    }
  }

  return { text: accumulatedText, functionCalls };
}

function validateMessages(body: ChatRequestBody): Message[] {
  if (!body || !Array.isArray(body.messages)) {
    throw new AppError("INVALID_REQUEST", 400, "messages 배열이 필요합니다.");
  }

  const messages = body.messages.filter((message) => {
    return (
      typeof message?.id === "string" &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
    );
  });

  if (messages.length === 0) {
    throw new AppError("INVALID_REQUEST", 400, "전송할 메시지가 없습니다.");
  }

  return messages;
}

function toContents(messages: Message[]): Content[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

function encodeEvent(event: string, payload: unknown): Uint8Array {
  return encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

function looksLikeApiError(text: string): boolean {
  return (
    text.startsWith('{"error"') ||
    text.startsWith('{"code"') ||
    text.startsWith('{"status"')
  );
}

function toUserFriendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("Too Many Requests")) {
    return "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (raw.includes("401") || raw.includes("UNAUTHENTICATED") || raw.includes("API key")) {
    return "API 키가 유효하지 않습니다. 환경 변수를 확인해 주세요.";
  }
  if (raw.includes("403") || raw.includes("PERMISSION_DENIED")) {
    return "API 접근 권한이 없습니다. API 키 설정을 확인해 주세요.";
  }
  if (raw.includes("500") || raw.includes("INTERNAL")) {
    return "Gemini API 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (raw.includes("AbortError") || raw.includes("aborted")) {
    return "요청이 취소되었습니다.";
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const innerError = parsed.error as Record<string, unknown> | undefined;
    if (typeof innerError?.message === "string") {
      return toUserFriendlyError(new Error(innerError.message));
    }
  } catch {
    // not JSON
  }

  if (raw.length > 200) {
    return "응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  return raw;
}

interface McpContentItem {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

function toGeminiResponse(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") {
    return { result: String(result) };
  }
  const obj = result as Record<string, unknown>;
  if (!Array.isArray(obj.content)) {
    return obj;
  }

  const textParts: string[] = [];
  let imageCount = 0;
  for (const item of obj.content as McpContentItem[]) {
    if (item.type === "text" && item.text) {
      textParts.push(item.text);
    } else if (item.type === "image") {
      imageCount++;
    }
  }

  if (imageCount === 0) return obj;

  return {
    text: textParts.join("\n") || undefined,
    imageCount,
    note: `${imageCount}개의 이미지가 생성되어 사용자에게 표시되었습니다.`,
  };
}
