"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { McpResource } from "@/lib/types/mcp";
import { cn } from "@/lib/utils";

interface ResourceInspectorProps {
  serverId: string;
  resources: McpResource[];
}

interface ResourceContent {
  uri: string;
  text?: string;
  blob?: string;
  mimeType?: string;
}

interface ResourceResult {
  contents?: ResourceContent[];
  error?: unknown;
  isError: boolean;
}

export function ResourceInspector({ serverId, resources }: ResourceInspectorProps) {
  const [loadingUri, setLoadingUri] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ResourceResult>>({});

  const handleRead = useCallback(
    async (uri: string) => {
      setLoadingUri(uri);

      try {
        const res = await fetch("/api/mcp/read-resource", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serverId, uri }),
        });

        const json = await res.json();

        if (!res.ok) {
          setResults((prev) => ({
            ...prev,
            [uri]: { isError: true, error: json },
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            [uri]: {
              contents: json.contents as ResourceContent[],
              isError: false,
            },
          }));
        }
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [uri]: {
            isError: true,
            error: err instanceof Error ? err.message : "네트워크 오류",
          },
        }));
      } finally {
        setLoadingUri(null);
      }
    },
    [serverId],
  );

  if (resources.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        이 서버에 등록된 Resource가 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {resources.map((resource) => {
        const result = results[resource.uri];
        const isLoading = loadingUri === resource.uri;

        return (
          <div
            key={resource.uri}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono text-sm font-medium">
                    {resource.name}
                  </span>
                  {resource.mimeType && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {resource.mimeType}
                    </Badge>
                  )}
                </div>
                <p className="ml-5.5 mt-0.5 truncate text-xs text-muted-foreground">
                  {resource.uri}
                </p>
                {resource.description && (
                  <p className="ml-5.5 mt-0.5 text-xs text-muted-foreground">
                    {resource.description}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRead(resource.uri)}
                disabled={isLoading}
                className="shrink-0 gap-1 text-xs"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5" />
                )}
                읽기
              </Button>
            </div>

            {result && (
              <div className="mt-3 border-t border-border pt-3">
                <Label className="mb-1 text-xs text-muted-foreground">내용</Label>
                {result.isError ? (
                  <pre className="max-h-60 overflow-auto rounded-lg border border-destructive/50 bg-destructive/5 p-2 text-xs text-destructive">
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                ) : (
                  <div className="flex flex-col gap-2">
                    {result.contents?.map((content, i) => (
                      <div key={i}>
                        {content.text ? (
                          <pre
                            className={cn(
                              "max-h-60 overflow-auto rounded-lg border border-border bg-muted/30 p-2 text-xs whitespace-pre-wrap",
                            )}
                          >
                            {content.text}
                          </pre>
                        ) : content.blob ? (
                          <div className="rounded-lg border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                            바이너리 데이터 ({content.mimeType ?? "unknown"}, {content.blob.length} chars base64)
                          </div>
                        ) : (
                          <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-muted/30 p-2 text-xs">
                            {JSON.stringify(content, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
