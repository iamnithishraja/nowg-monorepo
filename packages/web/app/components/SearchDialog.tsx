import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";

interface FileItem { name: string; path: string; content: string }

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  files: FileItem[];
  onSelect: (path: string) => void;
}

function highlight(text: string, query: string) {
  if (!query) return text;
  try {
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(safe, "ig");
    return text.replace(re, (m) => `__HIGHLIGHT__${m}__END__`)
               .split("__HIGHLIGHT__").map((chunk, i) => {
                  const [hit, rest] = chunk.split("__END__");
                  if (i === 0) return rest === undefined ? chunk : (<><mark className="bg-primary/30 text-foreground px-0.5 rounded">{hit}</mark>{rest}</>);
                  return rest === undefined ? <mark className="bg-primary/30 text-foreground px-0.5 rounded" key={i}>{hit}</mark> : (<span key={i}><mark className="bg-primary/30 text-foreground px-0.5 rounded">{hit}</mark>{rest}</span>);
               });
  } catch {
    return text;
  }
}

export default function SearchDialog({ open, onOpenChange, files, onSelect }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as { path: string; snippet: React.ReactNode }[];
    const qLower = q.toLowerCase();
    const out: { path: string; snippet: React.ReactNode }[] = [];
    for (const f of files) {
      const idx = f.content.toLowerCase().indexOf(qLower);
      const pathHit = f.path.toLowerCase().includes(qLower);
      if (idx !== -1 || pathHit) {
        let snippetText = "";
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(f.content.length, idx + q.length + 60);
          snippetText = (start > 0 ? "…" : "") + f.content.slice(start, end) + (end < f.content.length ? "…" : "");
        } else {
          snippetText = f.path;
        }
        out.push({ path: f.path, snippet: highlight(snippetText, q) });
        if (out.length >= 100) break;
      }
    }
    return out;
  }, [files, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-auto">
        <DialogHeader className="p-4 border-b border-border/60">
          <DialogTitle className="text-sm">Search</DialogTitle>
        </DialogHeader>
        <div className="p-3">
          <Input
            ref={inputRef}
            placeholder="Search in project…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="border-t border-border/60">
          <ScrollArea className="max-h-80">
            <div className="p-2 space-y-1">
              {results.length === 0 ? (
                <div className="text-xs text-muted-foreground px-2 py-6">No matches yet</div>
              ) : (
                results.map((r, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-2 py-2 rounded hover:bg-muted/60 transition-colors"
                    onClick={() => {
                      onOpenChange(false);
                      onSelect(r.path);
                    }}
                    title={r.path}
                  >
                    <div className="text-[11px] text-muted-foreground truncate">{r.path}</div>
                    <div className="text-xs mt-0.5 leading-relaxed break-words text-foreground/90">
                      {r.snippet}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
