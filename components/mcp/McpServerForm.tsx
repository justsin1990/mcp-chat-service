"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { McpServer, McpTransportType } from "@/lib/types/mcp";

interface KeyValue {
  key: string;
  value: string;
}

interface McpServerFormProps {
  open: boolean;
  editTarget?: McpServer | null;
  onClose: () => void;
  onSubmit: (data: Omit<McpServer, "id" | "createdAt" | "updatedAt">) => void;
}

const DEFAULT_TRANSPORT: McpTransportType = "streamable-http";

function recordToKeyValues(record?: Record<string, string>): KeyValue[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

function keyValuesToRecord(pairs: KeyValue[]): Record<string, string> {
  return pairs
    .filter((p) => p.key.trim() !== "")
    .reduce<Record<string, string>>((acc, { key, value }) => {
      acc[key.trim()] = value;
      return acc;
    }, {});
}

export function McpServerForm({
  open,
  editTarget,
  onClose,
  onSubmit,
}: McpServerFormProps) {
  const isEdit = !!editTarget;

  const [name, setName] = useState("");
  const [transportType, setTransportType] =
    useState<McpTransportType>(DEFAULT_TRANSPORT);

  // streamable-http 필드
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<KeyValue[]>([]);

  // stdio 필드
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [envVars, setEnvVars] = useState<KeyValue[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;

    if (editTarget) {
      setName(editTarget.name);
      const t = editTarget.transport;
      setTransportType(t.type);
      if (t.type === "streamable-http") {
        setUrl(t.url);
        setHeaders(recordToKeyValues(t.headers));
      } else {
        setCommand(t.command);
        setArgs(t.args?.join(", ") ?? "");
        setEnvVars(recordToKeyValues(t.env));
      }
    } else {
      setName("");
      setTransportType(DEFAULT_TRANSPORT);
      setUrl("");
      setHeaders([]);
      setCommand("");
      setArgs("");
      setEnvVars([]);
    }
    setErrors({});
  }, [open, editTarget]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "서버 이름을 입력하세요.";
    if (transportType === "streamable-http") {
      if (!url.trim()) next.url = "URL을 입력하세요.";
      else {
        try {
          new URL(url.trim());
        } catch {
          next.url = "올바른 URL 형식이 아닙니다.";
        }
      }
    } else {
      if (!command.trim()) next.command = "실행 명령어를 입력하세요.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const transport =
      transportType === "streamable-http"
        ? {
            type: "streamable-http" as const,
            url: url.trim(),
            ...(headers.length > 0 && {
              headers: keyValuesToRecord(headers),
            }),
          }
        : {
            type: "stdio" as const,
            command: command.trim(),
            ...(args.trim() && {
              args: args
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }),
            ...(envVars.length > 0 && {
              env: keyValuesToRecord(envVars),
            }),
          };

    onSubmit({
      name: name.trim(),
      transport,
      enabled: editTarget?.enabled ?? true,
    });
    onClose();
  }

  function addKeyValue(setter: React.Dispatch<React.SetStateAction<KeyValue[]>>) {
    setter((prev) => [...prev, { key: "", value: "" }]);
  }

  function updateKeyValue(
    setter: React.Dispatch<React.SetStateAction<KeyValue[]>>,
    index: number,
    field: "key" | "value",
    val: string,
  ) {
    setter((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)),
    );
  }

  function removeKeyValue(
    setter: React.Dispatch<React.SetStateAction<KeyValue[]>>,
    index: number,
  ) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "MCP 서버 수정" : "MCP 서버 추가"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* 서버 이름 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-name">서버 이름 *</Label>
            <Input
              id="mcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My MCP Server"
              aria-describedby={errors.name ? "mcp-name-error" : undefined}
            />
            {errors.name ? (
              <p id="mcp-name-error" className="text-xs text-destructive" role="alert">
                {errors.name}
              </p>
            ) : null}
          </div>

          {/* 전송 방식 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-transport">전송 방식 *</Label>
            <Select
              value={transportType}
              onValueChange={(v) => setTransportType(v as McpTransportType)}
            >
              <SelectTrigger id="mcp-transport">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="streamable-http">Streamable HTTP</SelectItem>
                <SelectItem value="stdio">stdio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {transportType === "streamable-http" ? (
            <>
              {/* URL */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-url">URL *</Label>
                <Input
                  id="mcp-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                  aria-describedby={errors.url ? "mcp-url-error" : undefined}
                />
                {errors.url ? (
                  <p id="mcp-url-error" className="text-xs text-destructive" role="alert">
                    {errors.url}
                  </p>
                ) : null}
              </div>

              {/* 커스텀 헤더 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>커스텀 헤더</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addKeyValue(setHeaders)}
                    aria-label="헤더 추가"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    추가
                  </Button>
                </div>
                {headers.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={h.key}
                      onChange={(e) =>
                        updateKeyValue(setHeaders, i, "key", e.target.value)
                      }
                      placeholder="Authorization"
                      aria-label={`헤더 키 ${i + 1}`}
                    />
                    <Input
                      value={h.value}
                      onChange={(e) =>
                        updateKeyValue(setHeaders, i, "value", e.target.value)
                      }
                      placeholder="Bearer token"
                      aria-label={`헤더 값 ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeKeyValue(setHeaders, i)}
                      aria-label={`헤더 ${i + 1} 삭제`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Command */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-command">Command *</Label>
                <Input
                  id="mcp-command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx"
                  aria-describedby={errors.command ? "mcp-command-error" : undefined}
                />
                {errors.command ? (
                  <p id="mcp-command-error" className="text-xs text-destructive" role="alert">
                    {errors.command}
                  </p>
                ) : null}
              </div>

              {/* Args */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-args">Arguments</Label>
                <Input
                  id="mcp-args"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="-y, @modelcontextprotocol/server-filesystem"
                />
                <p className="text-xs text-muted-foreground">
                  쉼표(,)로 구분하여 입력하세요.
                </p>
              </div>

              {/* Env vars */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>환경 변수</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addKeyValue(setEnvVars)}
                    aria-label="환경 변수 추가"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    추가
                  </Button>
                </div>
                {envVars.map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={e.key}
                      onChange={(ev) =>
                        updateKeyValue(setEnvVars, i, "key", ev.target.value)
                      }
                      placeholder="KEY"
                      aria-label={`환경 변수 키 ${i + 1}`}
                    />
                    <Input
                      value={e.value}
                      onChange={(ev) =>
                        updateKeyValue(setEnvVars, i, "value", ev.target.value)
                      }
                      placeholder="value"
                      aria-label={`환경 변수 값 ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeKeyValue(setEnvVars, i)}
                      aria-label={`환경 변수 ${i + 1} 삭제`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="button" onClick={handleSubmit}>
            {isEdit ? "저장" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
