import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "./ui/scroll-area";

interface FileItem { name: string; path: string; content: string }

interface FileSearchPaneProps {
  files: FileItem[];
  onSelect: (path: string) => void;
  onClose: () => void;
  hideHeader?: boolean;
}

function countOccurrences(text: string, query: string) {
  if (!query) return 0;
  try {
    const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    return (text.match(re) || []).length;
  } catch {
    return 0;
  }
}

function highlightSnippet(text: string, query: string): React.ReactNode {
  if (!query) return text.slice(0, 140);
  try {
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(safe, "ig");
    const snippet = text.length > 200 ? text.slice(0, 200) + "…" : text;
    const parts = snippet.split(re);
    const matches = snippet.match(re) || [];
    const out: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      out.push(parts[i]);
      if (i < matches.length) {
        out.push(
          <mark key={`m-${i}`} className="bg-primary/30 text-foreground px-0.5 rounded">
            {matches[i]}
          </mark>
        );
      }
    }
    return out;
  } catch {
    return text.slice(0, 200);
  }
}

export default function FileSearchPane({ files, onSelect, onClose, hideHeader = false }: FileSearchPaneProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as { path: string; count: number; snippet: React.ReactNode }[];
    const ql = q.toLowerCase();
    const out: { path: string; count: number; snippet: React.ReactNode }[] = [];
    for (const f of files) {
      const count = countOccurrences(f.content, q);
      if (count > 0 || f.path.toLowerCase().includes(ql)) {
        // Build basic snippet around first occurrence
        const idx = f.content.toLowerCase().indexOf(ql);
        let snippetText = f.content;
        if (idx !== -1) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(f.content.length, idx + q.length + 120);
          snippetText = (start > 0 ? "…" : "") + f.content.slice(start, end) + (end < f.content.length ? "…" : "");
        }
        out.push({ path: f.path, count: Math.max(count, 1), snippet: highlightSnippet(snippetText, q) });
        if (out.length >= 200) break;
      }
    }
    return out;
  }, [files, query]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      {!hideHeader && (
        <div className="px-3 py-2 border-b border-border flex items-center gap-3 text-xs">
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
            title="Back to Files"
          >
            Files
          </button>
          <div className="flex items-center gap-1 text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.07l3.24 3.24a.75.75 0 1 0 1.06-1.06l-3.24-3.24A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" clipRule="evenodd" />
            </svg>
            <span>Search</span>
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="p-2 border-b border-border/60">
        <div className="flex items-center gap-2 bg-background/80 border border-border/60 rounded px-2 py-1">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-2">
            {(!query || results.length === 0) && (
              <div className="text-xs text-muted-foreground px-2 py-2">Type to search across files…</div>
            )}
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => onSelect(r.path)}
                className="w-full text-left px-2 py-2 rounded hover:bg-muted/50 transition-colors"
                title={r.path}
              >
                <div className="flex items-center gap-2">
                  <div className="text-[11px] text-muted-foreground truncate flex-1">{r.path}</div>
                  <span className="text-[10px] rounded-full bg-primary/20 text-foreground px-2 py-0.5">{r.count}</span>
                </div>
                <div className="text-xs mt-1 leading-relaxed break-words text-foreground/90">
                  {r.snippet}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
