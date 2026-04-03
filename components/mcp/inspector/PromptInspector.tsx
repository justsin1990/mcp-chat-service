"use client";

import { Loader2, Play } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { McpPrompt } from "@/lib/types/mcp";
import { cn } from "@/lib/utils";

interface PromptInspectorProps {
  serverId: string;
  prompts: McpPrompt[];
}

interface PromptMessage {
  role: string;
  content: unknown;
}

interface PromptResult {
  messages?: PromptMessage[];
  error?: unknown;
  isError: boolean;
}

export function PromptInspector({ serverId, prompts }: PromptInspectorProps) {
  const [selectedPrompt, setSelectedPrompt] = useState<McpPrompt | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PromptResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelect = useCallback((prompt: McpPrompt) => {
    setSelectedPrompt(prompt);
    const initial: Record<string, string> = {};
    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        initial[arg.name] = "";
      }
    }
    setArgValues(initial);
    setResult(null);
  }, []);

  const handleArgChange = useCallback((name: string, value: string) => {
    setArgValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleExecute = useCallback(async () => {
    if (!selectedPrompt) return;

    setLoading(true);
    setResult(null);

    const args: Record<string, string> = {};
    for (const [k, v] of Object.entries(argValues)) {
      if (v.trim()) args[k] = v;
    }

    try {
      const res = await fetch("/api/mcp/get-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          name: selectedPrompt.name,
          arguments: Object.keys(args).length > 0 ? args : undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setResult({ isError: true, error: json });
      } else {
        setResult({
          messages: json.messages as PromptMessage[],
          isError: false,
        });
      }
    } catch (err) {
      setResult({
        isError: true,
        error: err instanceof Error ? err.message : "네트워크 오류",
      });
    } finally {
      setLoading(false);
    }
  }, [serverId, selectedPrompt, argValues]);

  if (prompts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        이 서버에 등록된 Prompt가 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {/* Prompt 목록 */}
      <div className="flex shrink-0 flex-col gap-1 sm:w-52">
        <Label className="mb-1 text-xs text-muted-foreground">Prompt 목록</Label>
        <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {prompts.map((prompt) => (
            <button
              key={prompt.name}
              type="button"
              onClick={() => handleSelect(prompt)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                selectedPrompt?.name === prompt.name
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="block truncate font-mono text-xs">{prompt.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 실행 영역 */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {selectedPrompt ? (
          <>
            <div>
              <h3 className="font-mono text-sm font-semibold">{selectedPrompt.name}</h3>
              {selectedPrompt.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{selectedPrompt.description}</p>
              )}
            </div>

            {selectedPrompt.arguments && selectedPrompt.arguments.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">Arguments</Label>
                {selectedPrompt.arguments.map((arg) => (
                  <div key={arg.name} className="flex flex-col gap-1">
                    <label className="text-xs font-medium">
                      {arg.name}
                      {arg.required && <span className="ml-0.5 text-destructive">*</span>}
                    </label>
                    <Input
                      value={argValues[arg.name] ?? ""}
                      onChange={(e) => handleArgChange(arg.name, e.target.value)}
                      placeholder={arg.name}
                      className="text-xs"
                    />
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleExecute}
              disabled={loading}
              className="w-fit gap-1.5"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              실행
            </Button>

            {result && (
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">결과</Label>
                {result.isError ? (
                  <pre className="max-h-72 overflow-auto rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive">
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                ) : (
                  <div className="flex flex-col gap-2">
                    {result.messages?.map((msg, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground">
                          {msg.role}
                        </span>
                        <pre className="overflow-auto text-xs whitespace-pre-wrap">
                          {typeof msg.content === "string"
                            ? msg.content
                            : JSON.stringify(msg.content, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            좌측에서 Prompt를 선택하세요.
          </p>
        )}
      </div>
    </div>
  );
}
