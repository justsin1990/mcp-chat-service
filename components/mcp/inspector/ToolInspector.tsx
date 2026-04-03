"use client";

import { Code, FormInput, Loader2, Play } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { McpTool } from "@/lib/types/mcp";
import { cn } from "@/lib/utils";

interface ToolInspectorProps {
  serverId: string;
  tools: McpTool[];
}

interface ToolResult {
  data: unknown;
  isError: boolean;
}

interface SchemaProperty {
  name: string;
  type?: string;
  description?: string;
  default?: unknown;
  required: boolean;
}

function extractProperties(schema: Record<string, unknown>): SchemaProperty[] {
  const properties = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!properties) return [];

  const requiredList = (schema.required as string[]) ?? [];

  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: prop.type as string | undefined,
    description: prop.description as string | undefined,
    default: prop.default,
    required: requiredList.includes(name),
  }));
}

export function ToolInspector({ serverId, tools }: ToolInspectorProps) {
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJson, setRawJson] = useState("{}");
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);

  const schemaProps = useMemo(() => {
    if (!selectedTool?.inputSchema) return [];
    return extractProperties(selectedTool.inputSchema);
  }, [selectedTool]);

  const hasSchema = schemaProps.length > 0;

  const handleSelect = useCallback(
    (tool: McpTool) => {
      setSelectedTool(tool);
      setResult(null);
      setRawJsonMode(false);

      const props = tool.inputSchema ? extractProperties(tool.inputSchema) : [];
      const initial: Record<string, string> = {};
      for (const prop of props) {
        initial[prop.name] =
          prop.default !== undefined ? String(prop.default) : "";
      }
      setFieldValues(initial);
      setFieldErrors({});
      setRawJson("{}");
    },
    [],
  );

  const handleFieldChange = useCallback((name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const buildArgs = useCallback((): Record<string, unknown> | null => {
    if (rawJsonMode) {
      try {
        return JSON.parse(rawJson) as Record<string, unknown>;
      } catch {
        setResult({
          data: { error: "JSON 파싱 오류: 올바른 JSON이 아닙니다." },
          isError: true,
        });
        return null;
      }
    }

    const errors: Record<string, string> = {};
    for (const prop of schemaProps) {
      const value = fieldValues[prop.name] ?? "";
      if (prop.required && !value) {
        errors[prop.name] = "필수 항목입니다.";
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return null;
    }

    const args: Record<string, unknown> = {};
    for (const prop of schemaProps) {
      const value = fieldValues[prop.name] ?? "";
      if (!value) continue;

      if (prop.type === "number" || prop.type === "integer") {
        const num = Number(value);
        args[prop.name] = !Number.isNaN(num) ? num : value;
      } else if (prop.type === "boolean") {
        args[prop.name] = value === "true";
      } else if (prop.type === "object" || prop.type === "array") {
        try {
          args[prop.name] = JSON.parse(value);
        } catch {
          args[prop.name] = value;
        }
      } else {
        args[prop.name] = value;
      }
    }
    return args;
  }, [rawJsonMode, rawJson, schemaProps, fieldValues]);

  const handleExecute = useCallback(async () => {
    if (!selectedTool) return;

    const parsedArgs = buildArgs();
    if (parsedArgs === null) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/mcp/call-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          name: selectedTool.name,
          arguments: parsedArgs,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setResult({ data: json, isError: true });
      } else {
        const callResult = json.result as {
          isError?: boolean;
          content?: unknown;
        };
        setResult({
          data: callResult,
          isError: !!callResult.isError,
        });
      }
    } catch (err) {
      setResult({
        data: {
          error: err instanceof Error ? err.message : "네트워크 오류",
        },
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  }, [serverId, selectedTool, buildArgs]);

  if (tools.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        이 서버에 등록된 Tool이 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {/* Tool 목록 */}
      <div className="flex shrink-0 flex-col gap-1 sm:w-52">
        <Label className="mb-1 text-xs text-muted-foreground">Tool 목록</Label>
        <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {tools.map((tool) => (
            <button
              key={tool.name}
              type="button"
              onClick={() => handleSelect(tool)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                selectedTool?.name === tool.name
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="block truncate font-mono text-xs">
                {tool.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 실행 영역 */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {selectedTool ? (
          <>
            <div>
              <h3 className="font-mono text-sm font-semibold">
                {selectedTool.name}
              </h3>
              {selectedTool.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedTool.description}
                </p>
              )}
            </div>

            {/* 모드 전환 */}
            {hasSchema && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={rawJsonMode ? "ghost" : "secondary"}
                  size="xs"
                  onClick={() => setRawJsonMode(false)}
                  className="gap-1 text-xs"
                >
                  <FormInput className="h-3 w-3" />
                  폼
                </Button>
                <Button
                  type="button"
                  variant={rawJsonMode ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => {
                    const args = buildArgs();
                    if (args) setRawJson(JSON.stringify(args, null, 2));
                    setRawJsonMode(true);
                  }}
                  className="gap-1 text-xs"
                >
                  <Code className="h-3 w-3" />
                  JSON
                </Button>
              </div>
            )}

            {/* 폼 모드 */}
            {!rawJsonMode && hasSchema ? (
              <div className="flex flex-col gap-3">
                {schemaProps.map((prop) => (
                  <div key={prop.name} className="flex flex-col gap-1">
                    <label className="text-xs font-medium">
                      {prop.name}
                      {prop.required && (
                        <span className="ml-0.5 text-destructive">*</span>
                      )}
                      {prop.type && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          ({prop.type})
                        </span>
                      )}
                    </label>
                    {prop.description && (
                      <p className="text-[11px] text-muted-foreground">
                        {prop.description}
                      </p>
                    )}
                    {prop.type === "object" || prop.type === "array" ? (
                      <Textarea
                        value={fieldValues[prop.name] ?? ""}
                        onChange={(e) =>
                          handleFieldChange(prop.name, e.target.value)
                        }
                        className={cn(
                          "font-mono text-xs",
                          fieldErrors[prop.name] && "border-destructive",
                        )}
                        rows={3}
                        placeholder={
                          prop.type === "object" ? '{ }' : '[ ]'
                        }
                        aria-invalid={!!fieldErrors[prop.name]}
                      />
                    ) : (
                      <Input
                        value={fieldValues[prop.name] ?? ""}
                        onChange={(e) =>
                          handleFieldChange(prop.name, e.target.value)
                        }
                        className={cn(
                          "text-xs",
                          fieldErrors[prop.name] && "border-destructive",
                        )}
                        placeholder={
                          prop.default !== undefined
                            ? `기본값: ${String(prop.default)}`
                            : prop.name
                        }
                        aria-invalid={!!fieldErrors[prop.name]}
                      />
                    )}
                    {fieldErrors[prop.name] && (
                      <p className="text-[11px] text-destructive">
                        {fieldErrors[prop.name]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">
                  Arguments (JSON)
                </Label>
                <Textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  className="font-mono text-xs"
                  rows={5}
                  placeholder='{ "key": "value" }'
                />
              </div>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleExecute}
              disabled={loading}
              className="w-fit gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              실행
            </Button>

            {result && (
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">
                  결과
                </Label>
                <pre
                  className={cn(
                    "max-h-72 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap",
                    result.isError
                      ? "border-destructive/50 bg-destructive/5 text-destructive"
                      : "border-border bg-muted/30",
                  )}
                >
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            좌측에서 Tool을 선택하세요.
          </p>
        )}
      </div>
    </div>
  );
}
