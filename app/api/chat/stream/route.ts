import { GoogleGenAI, type Content } from "@google/genai";
import { NextRequest } from "next/server";

import { getConfig } from "@/lib/config";
import { AppError, toApiError } from "@/lib/errors";
import type { Message } from "@/lib/types/chat";

const encoder = new TextEncoder();

export const runtime = "nodejs";

interface ChatRequestBody {
  messages: Message[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const messages = validateMessages(body);
    const { geminiApiKey, llmModel } = getConfig();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });

        try {
          const response = await ai.models.generateContentStream({
            model: llmModel,
            contents: toContents(messages),
            config: {
              abortSignal: request.signal,
              responseMimeType: "text/plain",
            },
          });

          for await (const chunk of response) {
            if (!chunk.text) {
              continue;
            }

            controller.enqueue(
              encodeEvent("message", {
                text: chunk.text,
              }),
            );
          }

          controller.enqueue(encodeEvent("done", { done: true }));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "응답을 생성하는 중 오류가 발생했습니다.";

          controller.enqueue(
            encodeEvent("error", {
              message,
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
