import { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Bot,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
  XCircle,
  FileCode,
  FileEdit,
  Terminal,
  Search,
  FolderSearch,
  Eye,
  Wrench,
  Sparkles,
  StopCircle,
} from "lucide-react";
import { useAgentChat, type AgentToolCall, type AgentMessage } from "../hooks/useAgentChat";
import type { FileMap } from "../utils/constants";

interface TemplateFile {
  name: string;
  path: string;
  content: string;
}

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateFiles?: TemplateFile[];
}

/**
 * Get icon for a tool
 */
function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase();
  if (name === "read" || name.includes("read")) return <Eye className="w-4 h-4" />;
  if (name === "grep" || name.includes("search")) return <Search className="w-4 h-4" />;
  if (name === "ls" || name === "list" || name.includes("dir")) return <FolderSearch className="w-4 h-4" />;
  if (name === "bash" || name === "shell") return <Terminal className="w-4 h-4" />;
  if (name === "edit" || name === "multiedit") return <FileEdit className="w-4 h-4" />;
  if (name === "write") return <FileCode className="w-4 h-4" />;
  return <Wrench className="w-4 h-4" />;
}

/**
 * Get status color for a tool call
 */
function getStatusColor(status: AgentToolCall["status"]) {
  switch (status) {
    case "completed": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "error": return "text-red-400 bg-red-500/10 border-red-500/20";
    case "executing": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    default: return "text-gray-400 bg-gray-500/10 border-gray-500/20";
  }
}

/**
 * Tool call item component
 */
function ToolCallItem({ toolCall }: { toolCall: AgentToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if this is a file edit
  const isFileEdit = toolCall.name === "edit" || toolCall.name === "multiedit" || toolCall.name === "write";
  const filePath = (toolCall.args as any)?.filePath || (toolCall.args as any)?.file_path || null;
  
  return (
    <div className="border border-border/30 rounded-xl overflow-hidden bg-surface-2/50">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-3/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`flex items-center justify-center w-6 h-6 rounded-lg border ${getStatusColor(toolCall.status)}`}>
          {toolCall.status === "executing" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : toolCall.status === "completed" ? (
            <Check className="w-3 h-3" />
          ) : toolCall.status === "error" ? (
            <XCircle className="w-3 h-3" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-current" />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {getToolIcon(toolCall.name)}
          <span className="font-mono text-sm text-foreground">{toolCall.name}</span>
        </div>
        
        {filePath && (
          <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={filePath}>
            {filePath}
          </span>
        )}
        
        {toolCall.endTime && toolCall.startTime && (
          <span className="text-[10px] text-muted-foreground ml-auto mr-2">
            {toolCall.endTime - toolCall.startTime}ms
          </span>
        )}
        
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border/20 px-3 py-2.5 space-y-2">
          {/* Arguments */}
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Arguments</div>
            <pre className="text-xs font-mono bg-surface-1/80 rounded-lg p-2 overflow-x-auto max-h-32">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          
          {/* Result */}
          {toolCall.result && (
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1">Result</div>
              <pre className="text-xs font-mono bg-surface-1/80 rounded-lg p-2 overflow-x-auto max-h-48">
                {'output' in toolCall.result
                  ? (toolCall.result as any).output?.substring(0, 1000) + ((toolCall.result as any).output?.length > 1000 ? '...' : '')
                  : 'error' in toolCall.result
                    ? (toolCall.result as any).error
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
 * Message component
 */
function MessageItem({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  
  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
            : "bg-surface-2/80 border border-border/30 text-foreground"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
      
      {/* Tool calls for assistant messages */}
      {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
        <div className="w-full max-w-[85%] space-y-2 mt-1">
          <div className="text-[10px] uppercase text-muted-foreground">Tool Calls</div>
          {message.toolCalls.map((tc) => (
            <ToolCallItem key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Agent Modal Component
 * 
 * A modal interface for interacting with the AI agent.
 * Shows tool calls, file edits, and streaming responses in real-time.
 */
export function AgentModal({ isOpen, onClose, templateFiles }: AgentModalProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Convert templateFiles to FileMap for the agent
  const filesMap = useMemo(() => {
    if (!templateFiles) return {};
    const map: FileMap = {};
    for (const file of templateFiles) {
      map[file.path] = {
        type: "file" as const,
        content: file.content,
        isBinary: false,
      };
    }
    return map;
  }, [templateFiles]);
  
  const {
    messages,
    isLoading,
    isStreaming,
    currentText,
    currentToolCalls,
    error,
    step,
    awaitingAcknowledgement,
    sendMessage,
    acknowledge,
    stop,
    clearHistory,
    clearError,
  } = useAgentChat({
    files: filesMap,
    maxSteps: 15,
    onError: (errorMsg) => {
      console.error("[AgentModal] Agent error callback:", errorMsg);
    },
    onComplete: (message) => {
      console.log("[AgentModal] Agent complete callback:", message.id);
    },
    onAwaitingAcknowledgement: (ackTools, results) => {
      console.log("[AgentModal] Action tools executed, auto-acknowledging:", ackTools.length, "| Results:", results.length);
      // Auto-acknowledge immediately with the results passed directly
      // This avoids relying on async state updates
      setTimeout(() => {
        console.log("[AgentModal] Auto-acknowledging now with", results.length, "results");
        acknowledge(results);
      }, 100);
    },
  });
  
  // Log state changes for debugging
  useEffect(() => {
    if (error) {
      console.error("[AgentModal] Error state:", error);
    }
    if (isLoading || isStreaming) {
      console.log("[AgentModal] Loading state - isLoading:", isLoading, "isStreaming:", isStreaming, "step:", step);
    }
  }, [error, isLoading, isStreaming, step]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentText, currentToolCalls]);
  
  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) {
      console.log("[AgentModal] Submit prevented - empty input or loading");
      return;
    }
    
    const prompt = input.trim();
    console.log("[AgentModal] Submitting prompt:", prompt.substring(0, 100));
    setInput("");
    try {
      await sendMessage(prompt);
      console.log("[AgentModal] Message sent successfully");
    } catch (error) {
      console.error("[AgentModal] Error sending message:", error);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl h-[80vh] mx-4 bg-gradient-to-b from-surface-2 to-surface-1 rounded-3xl border border-border/30 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">AI Agent</h2>
              <p className="text-xs text-muted-foreground">
                {isStreaming ? `Step ${step} • Executing...` : "Ready to help"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-3/50 rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-3/50 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">What can I help you with?</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                I can read, edit, and create files. Ask me to make changes to your project!
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {["Read App.tsx", "List all files", "Add a new feature"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1.5 text-xs bg-surface-3/50 hover:bg-surface-3 text-muted-foreground hover:text-foreground rounded-full border border-border/30 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Messages */}
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
          
          {/* Streaming content */}
          {isStreaming && (currentText || currentToolCalls.length > 0) && (
            <div className="flex flex-col gap-2 items-start">
              {currentText && (
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-surface-2/80 border border-border/30">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {currentText}
                    <span className="inline-block w-2 h-4 bg-purple-400 ml-1 animate-pulse" />
                  </p>
                </div>
              )}
              
              {currentToolCalls.length > 0 && (
                <div className="w-full max-w-[85%] space-y-2 mt-1">
                  <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Active Tool Calls
                  </div>
                  {currentToolCalls.map((tc) => (
                    <ToolCallItem key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Error</span>
              </div>
              <p className="text-sm text-red-400/80 mt-1">{error}</p>
              <button
                onClick={clearError}
                className="text-xs text-red-400 hover:text-red-300 mt-2"
              >
                Dismiss
              </button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input area */}
        <div className="border-t border-border/20 px-6 py-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the agent to help..."
              rows={1}
              className="flex-1 resize-none bg-surface-3/50 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
              style={{ minHeight: "48px", maxHeight: "120px" }}
              disabled={isLoading}
            />
            
            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            )}
          </form>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Press ⌘+Enter to send • Agent can read and edit files
          </p>
        </div>
      </div>
    </div>
  );
}

export default AgentModal;
