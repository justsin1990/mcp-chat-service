"use client";

import { ChevronDown, ChevronRight, Hammer, FileText, FolderOpen } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { McpCapabilities } from "@/lib/types/mcp";

interface McpCapabilitiesViewProps {
  capabilities: McpCapabilities;
}

export function McpCapabilitiesView({ capabilities }: McpCapabilitiesViewProps) {
  const { tools, prompts, resources } = capabilities;
  const total = tools.length + prompts.length + resources.length;

  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        사용 가능한 기능이 없습니다.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap gap-1.5">
        {tools.length > 0 && (
          <Badge variant="outline" className="gap-1 text-[11px]">
            <Hammer className="h-3 w-3" />
            Tools {tools.length}
          </Badge>
        )}
        {prompts.length > 0 && (
          <Badge variant="outline" className="gap-1 text-[11px]">
            <FileText className="h-3 w-3" />
            Prompts {prompts.length}
          </Badge>
        )}
        {resources.length > 0 && (
          <Badge variant="outline" className="gap-1 text-[11px]">
            <FolderOpen className="h-3 w-3" />
            Resources {resources.length}
          </Badge>
        )}
      </div>

      {tools.length > 0 && (
        <CapabilitySection
          title="Tools"
          icon={<Hammer className="h-3.5 w-3.5" />}
          items={tools.map((t) => ({
            name: t.name,
            description: t.description,
          }))}
        />
      )}

      {prompts.length > 0 && (
        <CapabilitySection
          title="Prompts"
          icon={<FileText className="h-3.5 w-3.5" />}
          items={prompts.map((p) => ({
            name: p.name,
            description: p.description,
          }))}
        />
      )}

      {resources.length > 0 && (
        <CapabilitySection
          title="Resources"
          icon={<FolderOpen className="h-3.5 w-3.5" />}
          items={resources.map((r) => ({
            name: r.name,
            description: r.description ?? r.uri,
          }))}
        />
      )}
    </div>
  );
}

interface CapabilitySectionProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ name: string; description?: string }>;
}

function CapabilitySection({ title, icon, items }: CapabilitySectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {icon}
        {title} ({items.length})
      </button>

      {open && (
        <ul className="ml-6 mt-1 flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.name} className="text-xs">
              <span className="font-mono font-medium text-foreground">
                {item.name}
              </span>
              {item.description && (
                <span className="ml-1.5 text-muted-foreground">
                  — {item.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
