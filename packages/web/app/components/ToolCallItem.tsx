import { useState } from "react";
import { Loader2, Check, ChevronRight, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface ToolCallItemProps {
  toolCall: any;
  isCompact?: boolean;
}

function getToolDescription(name: string, args?: any): string {
  const filePath = args?.filePath || args?.file_path || args?.path;
  const fileName = filePath ? filePath.split("/").pop() || filePath : null;

  const descriptions: Record<string, string> = {
    edit: fileName ? `Editing ${fileName}` : "Editing file",
    multiedit: fileName ? `Editing ${fileName}` : "Editing files",
    write: fileName ? `Creating ${fileName}` : "Creating file",
    read: fileName ? `Reading ${fileName}` : "Reading file",
    ls: args?.path ? `Listing ${args.path}` : "Listing directory",
    shell: args?.command ? `Running: ${args.command}` : "Running command",
    install: args?.package
      ? `Installing ${args.package}`
      : "Installing packages",
    mkdir: args?.path ? `Creating folder: ${args.path}` : "Creating folder",
  };

  return descriptions[name] || "Working...";
}

export function ToolCallItem({
  toolCall,
  isCompact = false,
}: ToolCallItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const userFriendlyDescription = getToolDescription(
    toolCall.name,
    toolCall.args
  );

  // Compact inline style for during streaming
  if (isCompact) {
    return (
      <div
        className="flex items-center gap-2 py-1 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {toolCall.status === "executing" ? (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />
        ) : toolCall.status === "completed" ? (
          <Check className="w-3 h-3 text-emerald-500/70" />
        ) : toolCall.status === "error" ? (
          <XCircle className="w-3 h-3 text-red-400/70" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        )}
        <span className="truncate">{userFriendlyDescription}</span>
        {toolCall.endTime && toolCall.startTime && (
          <span className="text-[10px] text-muted-foreground/40 ml-auto">
            {toolCall.endTime - toolCall.startTime}ms
          </span>
        )}
        <ChevronRight
          className={cn(
            "w-3 h-3 text-muted-foreground/30 transition-transform",
            isExpanded && "rotate-90"
          )}
        />
      </div>
    );
  }

  // Full style for expanded view
  return (
    <div className="border border-border/20 rounded-lg overflow-hidden bg-surface-2/30">
      <div
        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-surface-3/20 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {toolCall.status === "executing" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400/70" />
        ) : toolCall.status === "completed" ? (
          <Check className="w-3.5 h-3.5 text-emerald-500/70" />
        ) : toolCall.status === "error" ? (
          <XCircle className="w-3.5 h-3.5 text-red-400/70" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        )}

        <span className="text-xs text-muted-foreground truncate flex-1">
          {userFriendlyDescription}
        </span>

        {toolCall.endTime && toolCall.startTime && (
          <span className="text-[10px] text-muted-foreground/50 ml-auto mr-1">
            {toolCall.endTime - toolCall.startTime}ms
          </span>
        )}

        <ChevronRight
          className={cn(
            "w-3 h-3 text-muted-foreground/40 transition-transform",
            isExpanded && "rotate-90"
          )}
        />
      </div>

      {isExpanded && (
        <div className="border-t border-border/10 px-2.5 py-2 space-y-2 bg-surface-1/30">
          <div>
            <div className="text-[9px] uppercase text-muted-foreground/50 mb-1">
              Arguments
            </div>
            <pre className="text-[10px] font-mono bg-surface-1/50 rounded p-1.5 overflow-x-auto max-h-24 text-muted-foreground/70">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {toolCall.result && (
            <div>
              <div className="text-[9px] uppercase text-muted-foreground/50 mb-1">
                Result
              </div>
              <pre className="text-[10px] font-mono bg-surface-1/50 rounded p-1.5 overflow-x-auto max-h-32 text-muted-foreground/70">
                {toolCall.result?.output
                  ? toolCall.result.output.substring(0, 500) +
                    (toolCall.result.output.length > 500 ? "..." : "")
                  : toolCall.result?.error
                    ? toolCall.result.error
                    : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
