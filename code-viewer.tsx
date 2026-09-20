"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Copy, Maximize2, Minimize2, Check, ChevronRight } from "lucide-react";
import type { GeneratedFile } from "@/types/project";
import { languageFromPath } from "@/lib/language-map";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-text-muted">
      Loading editor…
    </div>
  ),
});

export function CodeViewer({ file }: { file: GeneratedFile }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fontSize = useUIStore((s) => s.editorFontSize);
  const wordWrap = useUIStore((s) => s.editorWordWrap);
  const theme = useUIStore((s) => s.theme);

  const language = languageFromPath(file.path);
  const lineCount = useMemo(() => file.content.split("\n").length, [file.content]);
  const segments = file.path.split("/").filter(Boolean);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {fullscreen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm",
          fullscreen && "fixed inset-4 z-50 shadow-2xl md:inset-10"
        )}
      >
        <div className="flex items-center gap-1 border-b border-border bg-surface-elevated/40 px-1.5 pt-1.5">
          <div className="flex items-center gap-1.5 rounded-t-md border border-b-0 border-border bg-surface px-3 py-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span className="truncate font-mono text-xs text-text-primary">
              {segments[segments.length - 1]}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex min-w-0 items-center gap-1 text-xs text-text-muted">
            {segments.map((seg, i) => (
              <span key={i} className="flex shrink-0 items-center gap-1 last:min-w-0 last:shrink">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-text-muted/50" />}
                <span
                  className={cn(
                    "truncate font-mono",
                    i === segments.length - 1 && "text-text-secondary"
                  )}
                >
                  {seg}
                </span>
              </span>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {language}
            </span>
            <span className="hidden text-[10px] text-text-muted sm:inline">
              {lineCount} lines
            </span>
            <div className="mx-1 h-4 w-px bg-border" />
            <button
              onClick={handleCopy}
              className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              aria-label="Copy code"
              title="Copy code"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setFullscreen((v) => !v)}
              className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              aria-label="Toggle fullscreen"
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className={fullscreen ? "flex-1" : "h-[420px]"}>
          <Editor
            height="100%"
            language={language}
            value={file.content}
            theme={theme === "pearl" ? "light" : "vs-dark"}
            options={{
              readOnly: true,
              fontSize,
              wordWrap: wordWrap ? "on" : "off",
              minimap: { enabled: file.content.split("\n").length > 60 },
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              renderLineHighlight: "gutter",
            }}
          />
        </div>
      </div>
    </>
  );
}
