import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  XCircle,
  Wrench,
  FileSearch,
  FolderSearch,
  Terminal,
  Search,
  FileEdit,
  FileCode,
  Globe,
  Zap,
} from "lucide-react";
import type { ToolExecutionStatus } from "../hooks/useToolExecution";

/**
 * Get an icon for a tool based on its name
 */
function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase();
  
  if (name === "read" || name.includes("read")) {
    return <FileSearch className="w-4 h-4 shrink-0" />;
  }
  if (name === "grep" || name.includes("search") || name.includes("grep")) {
    return <Search className="w-4 h-4 shrink-0" />;
  }
  if (name === "ls" || name === "list" || name.includes("dir")) {
    return <FolderSearch className="w-4 h-4 shrink-0" />;
  }
  if (name === "bash" || name === "shell" || name.includes("terminal")) {
    return <Terminal className="w-4 h-4 shrink-0" />;
  }
  if (name === "edit" || name === "multiedit" || name.includes("edit")) {
    return <FileEdit className="w-4 h-4 shrink-0" />;
  }
  if (name === "write") {
    return <FileCode className="w-4 h-4 shrink-0" />;
  }
  if (name.includes("web") || name.includes("fetch")) {
    return <Globe className="w-4 h-4 shrink-0" />;
  }
  if (name === "lsp" || name.includes("lsp")) {
    return <Zap className="w-4 h-4 shrink-0" />;
  }
  
  // Default tool icon
  return <Wrench className="w-4 h-4 shrink-0" />;
}

/**
 * Get a human-readable description for a tool
 */
function getToolDescription(toolName: string): string {
  const descriptions: Record<string, string> = {
    read: "Reading file",
    grep: "Searching in files",
    bash: "Running command",
    ls: "Listing directory",
    glob: "Finding files",
    edit: "Editing file",
    multiedit: "Editing multiple files",
    write: "Writing file",
    batch: "Running batch operations",
    lsp: "LSP operation",
    webfetch: "Fetching web content",
    websearch: "Searching the web",
    codesearch: "Searching code",
  };
  
  return descriptions[toolName.toLowerCase()] || `Running ${toolName}`;
}

interface ToolExecutionChecklistProps {
  title?: string;
  executions: ToolExecutionStatus[];
  isCollapsible?: boolean;
}

export function ToolExecutionChecklist({
  title = "Tool Executions",
  executions,
  isCollapsible = true,
}: ToolExecutionChecklistProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (executions.length === 0) {
    return null;
  }

  const completedCount = executions.filter(
    (e) => e.status === "completed"
  ).length;
  const errorCount = executions.filter((e) => e.status === "error").length;
  const pendingCount = executions.filter(
    (e) => e.status === "pending" || e.status === "executing"
  ).length;

  return (
    <div className="bg-gradient-to-b from-surface-2/80 to-surface-1/90 border border-border/30 rounded-2xl overflow-hidden shadow-lg shadow-black/5 backdrop-blur-sm">
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
          isCollapsible ? "cursor-pointer hover:bg-surface-3/30" : ""
        }`}
        onClick={() => isCollapsible && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20">
          {isCollapsible && isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-blue-400" />
          ) : isCollapsible ? (
            <ChevronDown className="w-4 h-4 text-blue-400" />
          ) : (
            <Wrench className="w-4 h-4 text-blue-400" />
          )}
        </div>
        <span className="font-medium text-sm text-foreground">{title}</span>
        <div className="ml-auto flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {pendingCount} running
            </span>
          )}
          {completedCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {completedCount} done
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              {errorCount} error
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="border-t border-border/20">
          <div className="divide-y divide-border/20">
            {executions.map((execution) => (
              <div
                key={execution.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-3/20 transition-colors"
              >
                {/* Status indicator */}
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-lg ${
                    execution.status === "completed"
                      ? "bg-emerald-500/15 border border-emerald-500/20"
                      : execution.status === "error"
                        ? "bg-red-500/15 border border-red-500/20"
                        : "bg-blue-500/15 border border-blue-500/20"
                  }`}
                >
                  {execution.status === "completed" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : execution.status === "error" ? (
                    <XCircle className="w-3 h-3 text-red-400" />
                  ) : (
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                  )}
                </div>

                {/* Tool icon */}
                <div
                  className={
                    execution.status === "completed" ||
                    execution.status === "error"
                      ? "opacity-100"
                      : "opacity-60"
                  }
                >
                  {getToolIcon(execution.name)}
                </div>

                {/* Tool name and description */}
                <div className="flex flex-col">
                  <span
                    className={`text-sm font-mono ${
                      execution.status === "completed"
                        ? "text-foreground"
                        : execution.status === "error"
                          ? "text-red-400"
                          : "text-foreground/60"
                    }`}
                  >
                    {execution.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {getToolDescription(execution.name)}
                  </span>
                </div>

                {/* Duration */}
                {execution.endTime && (
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                    {execution.endTime - execution.startTime}ms
                  </span>
                )}

                {/* Status badge */}
                <span
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${
                    execution.status === "completed"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : execution.status === "error"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {execution.status === "completed"
                    ? "Done"
                    : execution.status === "error"
                      ? "Error"
                      : execution.status === "executing"
                        ? "Running..."
                        : "Pending"}
                </span>
              </div>
            ))}
          </div>

          {/* Error details */}
          {executions.some((e) => e.status === "error" && e.error) && (
            <div className="px-4 py-3 bg-red-500/5 border-t border-border/20">
              {executions
                .filter((e) => e.status === "error" && e.error)
                .map((e) => (
                  <div
                    key={e.id}
                    className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 font-mono text-xs text-red-400"
                  >
                    <span className="font-semibold">{e.name}:</span> {e.error}
                  </div>
                ))}
            </div>
          )}

          {/* Result preview for completed executions */}
          {executions.some(
            (e) => e.status === "completed" && e.result?.output
          ) && (
            <div className="px-4 py-3 bg-surface-2/30 border-t border-border/20">
              <details className="group">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  View results
                </summary>
                <div className="mt-2 space-y-2">
                  {executions
                    .filter((e) => e.status === "completed" && e.result?.output)
                    .map((e) => (
                      <div
                        key={e.id}
                        className="bg-surface-1/80 border border-border/30 rounded-xl px-4 py-2.5"
                      >
                        <div className="text-[10px] text-muted-foreground mb-1">
                          {e.result?.title || e.name}
                        </div>
                        <pre className="font-mono text-xs text-foreground/80 whitespace-pre-wrap max-h-32 overflow-auto">
                          {e.result?.output?.substring(0, 500)}
                          {(e.result?.output?.length || 0) > 500 && "..."}
                        </pre>
                      </div>
                    ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolExecutionChecklist;
