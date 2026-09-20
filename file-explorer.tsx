"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileCode2,
  FileJson2,
  FileText,
  FileType2,
  Braces,
  Hash,
} from "lucide-react";
import type { GeneratedFile } from "@/types/project";
import { cn } from "@/lib/utils";

type TreeNode = {
  name: string;
  path: string;
  isFile: boolean;
  children: Map<string, TreeNode>;
};

function buildTree(files: GeneratedFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isFile: false, children: new Map() };
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let node = root;
    let acc = "";
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      if (!node.children.has(part)) {
        node.children.set(part, { name: part, path: acc, isFile, children: new Map() });
      }
      node = node.children.get(part)!;
    });
  }
  return root;
}

const EXT_STYLE: Record<string, { icon: typeof FileCode2; className: string }> = {
  js: { icon: FileCode2, className: "text-warning" },
  jsx: { icon: FileCode2, className: "text-accent" },
  ts: { icon: FileCode2, className: "text-accent" },
  tsx: { icon: FileCode2, className: "text-accent" },
  json: { icon: FileJson2, className: "text-warning" },
  md: { icon: FileText, className: "text-text-secondary" },
  css: { icon: Hash, className: "text-success" },
  html: { icon: FileType2, className: "text-error" },
  py: { icon: FileCode2, className: "text-success" },
};

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_STYLE[ext] ?? { icon: Braces, className: "text-text-muted" };
}

function FolderRow({
  node,
  depth,
  activePath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const entries = useMemo(
    () =>
      Array.from(node.children.values()).sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
    [node]
  );

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs text-text-secondary transition-colors duration-150 hover:bg-surface-elevated hover:text-text-primary"
      >
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 text-text-muted transition-transform duration-150", open && "rotate-90")}
        />
        {open ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent/70" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-accent/70" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {open && (
        <div>
          {entries.map((child) =>
            child.isFile ? (
              <FileRow
                key={child.path}
                node={child}
                depth={depth + 1}
                active={activePath === child.path}
                onSelect={onSelect}
              />
            ) : (
              <FolderRow
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                onSelect={onSelect}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({
  node,
  depth,
  active,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  active: boolean;
  onSelect: (path: string) => void;
}) {
  const { icon: Icon, className } = fileIcon(node.name);
  return (
    <button
      onClick={() => onSelect(node.path)}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs transition-colors duration-150",
        active
          ? "bg-accent/10 text-text-primary"
          : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      )}
    >
      <span className="w-3 shrink-0" />
      <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-accent" : className)} />
      <span className="truncate font-mono">{node.name}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
    </button>
  );
}

export function FileExplorer({
  files,
  activePath,
  onSelect,
}: {
  files: GeneratedFile[];
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const entries = useMemo(
    () =>
      Array.from(tree.children.values()).sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
    [tree]
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Explorer
        </span>
        <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
          {files.length} files
        </span>
      </div>
      <div className="flex flex-col gap-0.5 overflow-y-auto">
        {entries.map((entry) =>
          entry.isFile ? (
            <FileRow
              key={entry.path}
              node={entry}
              depth={0}
              active={activePath === entry.path}
              onSelect={onSelect}
            />
          ) : (
            <FolderRow key={entry.path} node={entry} depth={0} activePath={activePath} onSelect={onSelect} />
          )
        )}
      </div>
    </div>
  );
}
