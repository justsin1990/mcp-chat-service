"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
          {language ?? "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition",
            copied
              ? "bg-emerald-500/20 text-emerald-200"
              : "bg-white/8 text-zinc-200 hover:bg-white/14",
          )}
          aria-label={copied ? "코드 복사 완료" : "코드 복사"}
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>

      <pre className="chat-code-scrollbar overflow-x-auto px-4 py-3 text-[13px] leading-6 text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
