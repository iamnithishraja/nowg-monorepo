import { useState } from "react";
import { Check, ChevronRight, Loader2, XCircle, FileText, FolderOpen, Terminal, Search, Globe, Layers } from "lucide-react";
import { cn } from "../lib/utils";

interface ToolCallItemProps {
  toolCall: any;
  isCompact?: boolean;
  onFileClick?: (filePath: string) => void;
}

// Get file icon based on tool type
function getToolIcon(name: string) {
  switch (name) {
    case "edit":
    case "multiedit":
    case "write":
    case "read":
      return <FileText className="w-3 h-3 text-purple-400" />;
    case "ls":
    case "list":
    case "mkdir":
    case "glob":
      return <FolderOpen className="w-3 h-3 text-amber-400" />;
    case "shell":
    case "bash":
    case "install":
      return <Terminal className="w-3 h-3 text-cyan-400" />;
    case "grep":
    case "codesearch":
    case "lsp":
      return <Search className="w-3 h-3 text-blue-400" />;
    case "websearch":
    case "webfetch":
      return <Globe className="w-3 h-3 text-green-400" />;
    case "batch":
      return <Layers className="w-3 h-3 text-pink-400" />;
    default:
      return <FileText className="w-3 h-3 text-muted-foreground" />;
  }
}

// Determine the effective status of a tool call
// If loaded from DB with results, it's completed even if status is missing
function getEffectiveStatus(toolCall: any): string {
  // Explicit status takes precedence
  if (toolCall.status === "error") return "error";
  if (toolCall.status === "executing") return "executing";
  if (toolCall.status === "completed") return "completed";
  
  // If tool call has a result or endTime, it's completed (loaded from DB)
  if (toolCall.result || toolCall.endTime) {
    return "completed";
  }
  
  // Otherwise it's pending (currently streaming)
  return toolCall.status || "pending";
}

// Get status icon based on tool call status
function getStatusIcon(status?: string, size: "sm" | "md" = "sm") {
  const sizeClass = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  
  switch (status) {
    case "pending":
    case "executing":
      return <Loader2 className={cn(sizeClass, "text-purple-400 animate-spin")} />;
    case "error":
      return <XCircle className={cn(sizeClass, "text-red-400")} />;
    case "completed":
    default:
      return <Check className={cn(sizeClass, "text-emerald-500/70")} />;
  }
}

// Check if tool is a file operation
function isFileOperation(name: string): boolean {
  return ["edit", "multiedit", "write", "read"].includes(name);
}

// Get description based on tool status (past tense for completed)
function getToolDescription(name: string, args?: any, status?: string, result?: any): { 
  text: string; 
  fileName: string | null;
  filePath: string | null;
  additions?: number;
  deletions?: number;
} {
  const filePath = args?.filePath || args?.file_path || args?.path;
  const fileName = filePath ? filePath.split("/").pop() || filePath : null;
  const isCompleted = status === "completed";
  const isInProgress = status === "pending" || status === "executing";
  
  // Extract diff metadata from result if available
  const metadata = result?.metadata;
  const additions = metadata?.additions;
  const deletions = metadata?.deletions;

  // For file operations, use past tense when completed
  const fileDescriptions: Record<string, { inProgress: string; completed: string; fallbackInProgress: string; fallbackCompleted: string }> = {
    edit: { inProgress: "Editing", completed: "Edited", fallbackInProgress: "Editing file", fallbackCompleted: "Edited file" },
    multiedit: { inProgress: "Editing", completed: "Edited", fallbackInProgress: "Editing files", fallbackCompleted: "Edited files" },
    write: { inProgress: "Creating", completed: "Created", fallbackInProgress: "Creating file", fallbackCompleted: "Created file" },
    read: { inProgress: "Reading", completed: "Read", fallbackInProgress: "Reading file", fallbackCompleted: "Read file" },
  };

  // Handle file operations - show file name if available, otherwise show fallback
  if (fileDescriptions[name]) {
    const desc = fileDescriptions[name];
    if (fileName) {
      // File path available - show actual file name
      const verb = isCompleted ? desc.completed : desc.inProgress;
      return { 
        text: `${verb} ${fileName}`, 
        fileName, 
        filePath,
        additions: isCompleted ? additions : undefined,
        deletions: isCompleted ? deletions : undefined,
      };
    } else {
      // No file path - use fallback text (still descriptive)
      return { 
        text: isCompleted ? desc.fallbackCompleted : desc.fallbackInProgress, 
        fileName: null, 
        filePath: null,
      };
    }
  }

  const otherDescriptions: Record<string, { inProgress: string; completed: string }> = {
    ls: { 
      inProgress: args?.path ? `Listing ${args.path}` : "Listing directory",
      completed: args?.path ? `Listed ${args.path}` : "Listed directory"
    },
    list: { 
      inProgress: args?.path ? `Listing ${args.path}` : "Listing directory",
      completed: args?.path ? `Listed ${args.path}` : "Listed directory"
    },
    shell: { 
      inProgress: args?.command ? `Running: ${args.command.substring(0, 50)}${args.command.length > 50 ? '...' : ''}` : "Running command",
      completed: args?.command ? `Ran: ${args.command.substring(0, 50)}${args.command.length > 50 ? '...' : ''}` : "Ran command"
    },
    bash: { 
      inProgress: args?.command ? `Running: ${args.command.substring(0, 50)}${args.command.length > 50 ? '...' : ''}` : "Running command",
      completed: args?.command ? `Ran: ${args.command.substring(0, 50)}${args.command.length > 50 ? '...' : ''}` : "Ran command"
    },
    install: { 
      inProgress: args?.package ? `Installing ${args.package}` : "Installing packages",
      completed: args?.package ? `Installed ${args.package}` : "Installed packages"
    },
    mkdir: { 
      inProgress: args?.path ? `Creating folder: ${args.path}` : "Creating folder",
      completed: args?.path ? `Created folder: ${args.path}` : "Created folder"
    },
    glob: { 
      inProgress: args?.pattern ? `Finding files: ${args.pattern}` : "Finding files",
      completed: args?.pattern ? `Found files: ${args.pattern}` : "Found files"
    },
    lsp: { 
      inProgress: args?.command ? `Running LSP: ${args.command}` : "Running LSP",
      completed: args?.command ? `Ran LSP: ${args.command}` : "Ran LSP"
    },
    grep: { 
      inProgress: args?.pattern ? `Searching: ${args.pattern}` : "Searching files",
      completed: args?.pattern ? `Searched: ${args.pattern}` : "Searched files"
    },
    codesearch: { 
      inProgress: args?.pattern ? `Searching code: ${args.pattern}` : "Searching code",
      completed: args?.pattern ? `Searched code: ${args.pattern}` : "Searched code"
    },
    websearch: { 
      inProgress: args?.query ? `Searching web: ${args.query}` : "Searching web",
      completed: args?.query ? `Searched web: ${args.query}` : "Searched web"
    },
    webfetch: { 
      inProgress: args?.url ? `Fetching: ${args.url}` : "Fetching web content",
      completed: args?.url ? `Fetched: ${args.url}` : "Fetched web content"
    },
  };

  const desc = otherDescriptions[name];
  if (desc) {
    return { 
      text: isCompleted ? desc.completed : desc.inProgress, 
      fileName: null, 
      filePath: null 
    };
  }

  // Final fallback - show the tool name so user knows what happened
  return { 
    text: isInProgress ? `Running ${name}...` : `${name} completed`, 
    fileName: null, 
    filePath: null 
  };
}

// Single tool call item renderer (internal)
function SingleToolCallItem({
  toolCall,
  isCompact = false,
  onFileClick,
  // For batch sub-items: override display values
  overrideName,
  overrideArgs,
  hideExpand,
}: {
  toolCall: any;
  isCompact?: boolean;
  onFileClick?: (filePath: string) => void;
  overrideName?: string;
  overrideArgs?: any;
  hideExpand?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayName = overrideName || toolCall.name;
  const displayArgs = overrideArgs || toolCall.args;

  // Get effective status (handles DB-loaded tool calls that may not have explicit status)
  const effectiveStatus = getEffectiveStatus(toolCall);

  const { text, fileName, filePath, additions, deletions } = getToolDescription(
    displayName,
    displayArgs,
    effectiveStatus,
    toolCall.result
  );

  const isFileOp = isFileOperation(displayName);
  const isCompleted = effectiveStatus === "completed";
  const hasClickableFile = isFileOp && filePath && onFileClick;
  const hasDiffStats = isCompleted && (additions !== undefined || deletions !== undefined);

  // Handle file click
  const handleFileClick = (e: React.MouseEvent) => {
    if (hasClickableFile) {
      e.stopPropagation();
      onFileClick(filePath);
    }
  };

  // Render diff stats for edit operations
  const renderDiffStats = () => {
    if (!hasDiffStats) return null;
    
    return (
      <span className="flex items-center gap-1 ml-1">
        {additions !== undefined && additions > 0 && (
          <span className="text-emerald-400 font-mono text-[10px]">+{additions}</span>
        )}
        {deletions !== undefined && deletions > 0 && (
          <span className="text-red-400 font-mono text-[10px]">-{deletions}</span>
        )}
      </span>
    );
  };

  // Render the description with clickable file name
  const renderDescription = () => {
    if (hasDiffStats && fileName) {
      // For edit operations with diff stats, show: filename +N -M
      return (
        <span className="flex items-center gap-1">
          <span 
            className={cn(
              "truncate",
              hasClickableFile && "hover:text-purple-400 hover:underline cursor-pointer"
            )}
            onClick={handleFileClick}
          >
            {fileName}
          </span>
          {renderDiffStats()}
        </span>
      );
    }
    
    if (hasClickableFile) {
      // For read operations, make entire description clickable
      return (
        <span 
          className="truncate hover:text-purple-400 hover:underline cursor-pointer"
          onClick={handleFileClick}
        >
          {text}
        </span>
      );
    }
    
    return <span className="truncate">{text}</span>;
  };

  // Compact inline style for during streaming
  if (isCompact) {
    return (
      <div
        className="flex items-center gap-2 py-1 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer group"
        onClick={() => !hideExpand && setIsExpanded(!isExpanded)}
      >
        {getStatusIcon(effectiveStatus, "sm")}
        {getToolIcon(displayName)}
        {renderDescription()}
        {toolCall.endTime && toolCall.startTime && !hideExpand && (
          <span className="text-[10px] text-muted-foreground/40 ml-auto">
            {toolCall.endTime - toolCall.startTime}ms
          </span>
        )}
        {!hideExpand && (
          <ChevronRight
            className={cn(
              "w-3 h-3 text-muted-foreground/30 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        )}
      </div>
    );
  }

  // Full style for expanded view
  return (
    <div className="border border-border/20 rounded-lg overflow-hidden bg-surface-2/30">
      <div
        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-surface-3/20 transition-colors"
        onClick={() => !hideExpand && setIsExpanded(!isExpanded)}
      >
        {getStatusIcon(effectiveStatus, "md")}
        {getToolIcon(displayName)}

        <span className="text-xs text-muted-foreground flex-1 min-w-0">
          {renderDescription()}
        </span>

        {toolCall.endTime && toolCall.startTime && !hideExpand && (
          <span className="text-[10px] text-muted-foreground/50 ml-auto mr-1">
            {toolCall.endTime - toolCall.startTime}ms
          </span>
        )}

        {!hideExpand && (
          <ChevronRight
            className={cn(
              "w-3 h-3 text-muted-foreground/40 transition-transform shrink-0",
              isExpanded && "rotate-90"
            )}
          />
        )}
      </div>

      {isExpanded && !hideExpand && (
        <div className="border-t border-border/10 px-2.5 py-2 space-y-2 bg-surface-1/30">
          <div>
            <div className="text-[9px] uppercase text-muted-foreground/50 mb-1">
              Arguments
            </div>
            <pre className="text-[10px] font-mono bg-surface-1/50 rounded p-1.5 overflow-x-auto max-h-24 text-muted-foreground/70">
              {JSON.stringify(displayArgs, null, 2)}
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

/**
 * Main ToolCallItem export - handles batch expansion
 * For batch tool calls, renders each sub-call as individual items
 */
export function ToolCallItem({
  toolCall,
  isCompact = false,
  onFileClick,
}: ToolCallItemProps) {
  // Check if this is a batch tool call that should be expanded
  const isBatch = toolCall.name === "batch" && 
    toolCall.args?.tool_calls && 
    Array.isArray(toolCall.args.tool_calls) &&
    toolCall.args.tool_calls.length > 0;

  if (isBatch) {
    // Expand batch into individual items - render each sub-call separately
    const batchCalls = toolCall.args.tool_calls;
    const effectiveStatus = getEffectiveStatus(toolCall);
    
    return (
      <>
        {batchCalls.map((subCall: { tool: string; parameters: any }, index: number) => (
          <SingleToolCallItem
            key={`batch-${toolCall.id}-${index}`}
            toolCall={{
              ...toolCall,
              // Pass through the parent status/timing but use sub-call's tool info
              id: `${toolCall.id}-${index}`,
            }}
            isCompact={isCompact}
            onFileClick={onFileClick}
            overrideName={subCall.tool}
            overrideArgs={subCall.parameters}
            hideExpand={true}
          />
        ))}
      </>
    );
  }

  // Regular single tool call
  return (
    <SingleToolCallItem
      toolCall={toolCall}
      isCompact={isCompact}
      onFileClick={onFileClick}
    />
  );
}
