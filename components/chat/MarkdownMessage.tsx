import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

import { CodeBlock } from "./CodeBlock";

interface MarkdownMessageProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

const markdownComponents: Components = {
  a({ children, href, ...props }) {
    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-blue-300 underline underline-offset-4"
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    if (!src) return null;
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="my-2 block overflow-hidden rounded-xl border border-white/10 transition hover:border-white/30"
      >
        <img
          src={src}
          alt={alt ?? "이미지"}
          className="max-h-96 max-w-full rounded-xl object-contain"
          loading="lazy"
        />
      </a>
    );
  },
  code({ children, className, ...props }) {
    const value = String(children).replace(/\n$/, "");
    const language = /language-([\w-]+)/.exec(className ?? "")?.[1];
    const isBlockCode = Boolean(language) || value.includes("\n");

    if (!isBlockCode) {
      return (
        <code
          {...props}
          className="rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[0.95em] text-amber-100"
        >
          {children}
        </code>
      );
    }

    return <CodeBlock code={value} language={language} />;
  },
};

export function MarkdownMessage({
  content,
  isStreaming = false,
  className,
}: MarkdownMessageProps) {
  return (
    <div className={cn("markdown-body text-sm leading-7 break-words", className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content || "응답을 생성하는 중입니다."}
      </Markdown>
      {isStreaming ? (
        <span
          aria-hidden="true"
          className="mt-1 inline-block h-4 w-2 animate-pulse rounded bg-current align-middle opacity-80"
        />
      ) : null}
    </div>
  );
}
