"use client";

import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ToolCallPart } from "@/lib/types/chat";

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

interface ToolCallMessageProps {
  toolCalls: ToolCallPart[];
}

export function ToolCallMessage({ toolCalls }: ToolCallMessageProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 my-2">
      {toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallPart }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = getStatusIcon(toolCall.status);
  const statusColor = getStatusColor(toolCall.status);
  const statusLabel = getStatusLabel(toolCall.status);
  const images = extractImages(toolCall.result);
  const hasImages = images.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-colors",
        statusColor,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
        aria-expanded={expanded}
        aria-label={`${toolCall.name} 도구 호출 상세`}
      >
        {statusIcon}
        <Wrench className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="font-medium truncate">{toolCall.name}</span>
        <span className="ml-auto shrink-0 text-[10px] text-zinc-500">
          {toolCall.serverName}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            toolCall.status === "done" && "bg-emerald-500/20 text-emerald-300",
            toolCall.status === "running" && "bg-blue-500/20 text-blue-300",
            toolCall.status === "error" && "bg-red-500/20 text-red-300",
            toolCall.status === "pending" && "bg-zinc-500/20 text-zinc-400",
          )}
        >
          {statusLabel}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        )}
      </button>

      {hasImages && (
        <div className="px-3 pb-2 pt-1">
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <a
                key={i}
                href={img.src}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-white/10 transition hover:border-white/30"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="max-h-64 max-w-full rounded-lg object-contain"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-white/5 px-3 py-2.5 text-xs">
          <div className="mb-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              입력 인자
            </p>
            <pre className="chat-code-scrollbar overflow-x-auto rounded-lg bg-black/30 p-2 text-[11px] text-zinc-300">
              {formatJson(toolCall.args)}
            </pre>
          </div>

          {(toolCall.status === "done" || toolCall.status === "error") &&
            toolCall.result !== undefined && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {toolCall.isError ? "오류" : "결과"}
                </p>
                <pre
                  className={cn(
                    "chat-code-scrollbar overflow-x-auto rounded-lg p-2 text-[11px]",
                    toolCall.isError
                      ? "bg-red-500/10 text-red-200"
                      : "bg-black/30 text-zinc-300",
                  )}
                >
                  {formatResult(toolCall.result)}
                </pre>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function getStatusIcon(status: ToolCallPart["status"]) {
  switch (status) {
    case "running":
      return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-400" />;
    case "done":
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
    case "error":
      return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />;
    default:
      return <Loader2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />;
  }
}

function getStatusColor(status: ToolCallPart["status"]): string {
  switch (status) {
    case "running":
      return "border-blue-500/30 bg-blue-500/5";
    case "done":
      return "border-emerald-500/30 bg-emerald-500/5";
    case "error":
      return "border-red-500/30 bg-red-500/5";
    default:
      return "border-white/10 bg-white/5";
  }
}

function getStatusLabel(status: ToolCallPart["status"]): string {
  switch (status) {
    case "pending":
      return "대기";
    case "running":
      return "실행 중";
    case "done":
      return "완료";
    case "error":
      return "오류";
  }
}

interface ExtractedImage {
  src: string;
  alt: string;
}

function extractImages(result: unknown): ExtractedImage[] {
  if (!result || typeof result !== "object") return [];
  const mcpResult = result as McpToolResult;
  if (!Array.isArray(mcpResult.content)) return [];

  const images: ExtractedImage[] = [];
  for (const item of mcpResult.content) {
    if (item.type === "image" && item.data && item.mimeType) {
      images.push({
        src: `data:${item.mimeType};base64,${item.data}`,
        alt: "도구 생성 이미지",
      });
    }
    if (item.type === "text" && item.text) {
      for (const url of extractImageUrls(item.text)) {
        images.push({ src: url, alt: "도구 생성 이미지" });
      }
    }
  }
  return images;
}

const IMAGE_URL_RE =
  /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp|ico)(?:\?\S*)?/gi;

function extractImageUrls(text: string): string[] {
  return [...text.matchAll(IMAGE_URL_RE)].map((m) => m[0]);
}

function formatJson(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    const cleaned = stripBase64ForDisplay(result);
    return JSON.stringify(cleaned, null, 2);
  } catch {
    return String(result);
  }
}

function stripBase64ForDisplay(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(value)) {
      return `[base64 데이터 ${Math.round(value.length / 1024)}KB]`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(stripBase64ForDisplay);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = stripBase64ForDisplay(v);
    }
    return out;
  }
  return value;
}
