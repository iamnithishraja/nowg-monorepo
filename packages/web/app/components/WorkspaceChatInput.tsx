import {
  BookOpen,
  CaretRight,
  ArrowSquareOut,
  GithubLogo,
  SpinnerGap,
  Cursor,
  Palette,
  PaperPlaneRight,
  Sparkle,
  Square,
  Upload,
  ChatCircle
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { OPENROUTER_MODELS } from "../consts/models";
import { useFileHandling } from "../hooks/useFileHandling";
import { cn } from "../lib/utils";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import type { DesignScheme } from "../types/design-scheme";

import { FilePreview } from "./FileUpload";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { PlusCircle, SelectionPlus } from "phosphor-react";
import { ArrowUp } from "lucide-react";

interface WorkspaceChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isLoading: boolean;
  isProcessingTemplate: boolean;
  isStreaming: boolean;
  onInterrupt?: () => void;
  // File upload props
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  // Empty state props
  isEmpty?: boolean;
  conversationId?: string | null;
  onGitHubImport?: () => void;
  onFigmaImport?: () => void;
  designScheme?: DesignScheme | undefined;
  enableDesignScheme?: boolean;
  onDesignSchemeToggle?: (enabled: boolean) => void;
  onDesignSchemeChange?: (scheme: DesignScheme | undefined) => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}

export function WorkspaceChatInput({
  input,
  setInput,
  onSubmit,
  onKeyDown,
  isLoading,
  isProcessingTemplate,
  isStreaming,
  onInterrupt,
  uploadedFiles = [],
  setUploadedFiles,
  isEmpty = false,
  conversationId,
  onGitHubImport,
  onFigmaImport,
  designScheme,
  enableDesignScheme = false,
  onDesignSchemeToggle,
  onDesignSchemeChange,
  selectedModel: propSelectedModel,
  onModelChange,
}: WorkspaceChatInputProps) {
  const isDisabled = isLoading || isProcessingTemplate || isStreaming;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl+Enter");

  // Workspace state for switching tabs and edit mode
  // Hooks MUST be called unconditionally - always call useWorkspaceStore
  const setWorkspaceActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const isEditActive = useWorkspaceStore((s) => s.isEditActive);
  const setIsEditActive = useWorkspaceStore((s) => s.setIsEditActive);
  const storeSelectedModel = useWorkspaceStore((s) => s.selectedModel);
  const chatMode = useWorkspaceStore((s) => s.chatMode);
  const setChatMode = useWorkspaceStore((s) => s.setChatMode);
  // Use propSelectedModel if provided, otherwise fall back to store value
  const selectedModel = propSelectedModel || storeSelectedModel;

  // Platform-aware shortcut label
  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const platform = (navigator.platform || "").toLowerCase();
      const isApple =
        /mac|iphone|ipad|ipod/.test(platform) ||
        /Mac|iPhone|iPad|iPod/.test(ua);
      setShortcutLabel(isApple ? "⌘ Return" : "Ctrl+Enter");
    } catch {
      // no-op (SSR or unavailable navigator)
    }
  }, []);

  const examplePrompts = [
    {
      label: "Landing Page",
      prompt:
        "Create a modern landing page with a large hero, features grid, pricing section, and contact form. Use React + Tailwind. Make it responsive and accessible.",
    },
    {
      label: "Habit Tracker",
      prompt:
        "Make a personal habit tracker where users can set daily or weekly habits, log completions, and view streaks and progress. Include progress bars and motivational messages. Use a clean, goal‑focused layout.",
    },
    {
      label: "Local Landmarks",
      prompt:
        "Build a local landmarks explorer that lists notable places from an API, shows them on a map, and supports search and filtering. Use React, Tailwind, and a map library like Leaflet.",
    },
  ] as const;

  const handleInsertExamplePrompt = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      try {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.selectionStart = el.selectionEnd = el.value.length;
        }
      } catch {}
    });
  };

  const handleOpenProvider = async (
    provider: "chatgpt" | "gemini" | "perplexity"
  ) => {
    const providerUrl: Record<typeof provider, string> = {
      chatgpt: "https://chat.openai.com/",
      gemini: "https://gemini.google.com/app",
      perplexity: "https://www.perplexity.ai/",
    };
    try {
      const helperMessage =
        "Draft a concise, actionable prompt for Nowgai to build a full‑stack web app. Include features, preferred tech stack, APIs, and constraints. Return only the prompt text.";
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(helperMessage);
      }
    } catch {}
    try {
      window.open(providerUrl[provider], "_blank", "noopener,noreferrer");
    } catch {}
  };

  const {
    imageDataList,
    isDragging,
    dragHandlers,
    handleFileSelect,
    handleRemoveFile,
  } = useFileHandling({
    uploadedFiles: uploadedFiles || [],
    setUploadedFiles: setUploadedFiles || (() => {}),
  });

  // Handle Escape key to interrupt
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && (isLoading || isStreaming) && onInterrupt) {
      onInterrupt();
      return;
    }
    onKeyDown(e);
  };

  const handleSend = () => {
    if (!input.trim() || isDisabled || isEnhancing) return;
    onSubmit();
  };

  const handleEnhance = async () => {
    if (!input.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const modelToUse = selectedModel || OPENROUTER_MODELS[0].id;
      const response = await fetch("/api/enhancer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          model: modelToUse,
          provider: { name: "OpenRouter" },
        }),
      });
      if (!response.ok) {
        throw new Error(`Enhancer failed: ${response.status}`);
      }
      const data = await response.json();
      if (data?.enhancedPrompt && typeof data.enhancedPrompt === "string") {
        setInput(data.enhancedPrompt);
        // Move cursor to end
        requestAnimationFrame(() => {
          try {
            const el = textareaRef.current;
            if (el) {
              el.focus();
              el.selectionStart = el.selectionEnd = el.value.length;
            }
          } catch {}
        });
      }
    } catch (e) {
      console.error("Error enhancing prompt:", e);
    } finally {
      setIsEnhancing(false);
    }
  };

  // End edit mode when explicitly requested (e.g., Close button)
  useEffect(() => {
    const endEdit = () => setIsEditActive(false);
    window.addEventListener("endEditMode", endEdit);
    return () => window.removeEventListener("endEditMode", endEdit);
  }, [setIsEditActive]);

  // Use the same approach as home page - regular textarea with external bottom bar
  return (
    <div className="relative">
      {/* File Preview */}
      {uploadedFiles && uploadedFiles.length > 0 && (
        <FilePreview
          files={uploadedFiles}
          onRemove={handleRemoveFile}
          removeIcon="✕"
          fileIcon="📄"
          imageDataList={imageDataList}
        />
      )}

      {isEmpty ? (
        // Empty state UI - similar to home route
        <div className="p-px rounded-2xl sm:rounded-3xl bg-linear-to-b from-white/15 via-white/5 to-transparent">
          <div
            {...dragHandlers}
            className={cn(
              "relative bg-background/70 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300",
              isDragging && "border-primary/50 bg-primary/5"
            )}
          >
            <div className="p-4 sm:p-5 md:p-6">
              {/* Model Selection and Feature Toggles */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <label className="text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
                    Model:
                  </label>
                  <Select
                    value={selectedModel}
                    onValueChange={(value) => {
                      if (onModelChange) {
                        onModelChange(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-64 bg-muted/50 border border-border/60 text-foreground h-9 hover:bg-muted hover:border-primary/30 focus:border-primary focus:bg-muted focus:shadow-md focus:shadow-primary/10 transition-all duration-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background/80 border border-primary/30">
                      {OPENROUTER_MODELS.map((model) => (
                        <SelectItem
                          key={model.id}
                          value={model.id}
                          className="text-foreground hover:bg-primary/20"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm">{model.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {model.provider}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  {/* Enable Color Scheme toggle */}
                  <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 hover:border-primary/20 transition-all duration-300 group">
                    <Palette className="w-4 h-4 text-primary group-hover:text-primary/80 transition-colors" />
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="design-toggle"
                        className="text-xs text-muted-foreground group-hover:text-foreground/80 cursor-pointer select-none transition-colors whitespace-nowrap"
                      >
                        Enable Color Scheme
                      </Label>
                      <Switch
                        id="design-toggle"
                        checked={enableDesignScheme}
                        onCheckedChange={(checked) => {
                          if (onDesignSchemeToggle) {
                            onDesignSchemeToggle(!!checked);
                          }
                          if (!checked && onDesignSchemeChange) {
                            onDesignSchemeChange(undefined);
                          }
                        }}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary/50 hover:data-[state=checked]:bg-primary/90 transition-all duration-300 scale-75"
                      />
                      <Button
                        onClick={() => {
                          const event = new CustomEvent("openColorSchemeDialog");
                          window.dispatchEvent(event);
                        }}
                        variant="ghost"
                        size="sm"
                        disabled={!enableDesignScheme}
                        className={cn(
                          "h-5 w-5 p-0",
                          enableDesignScheme
                            ? "text-primary/80 hover:text-primary hover:bg-primary/10 border-primary/30 hover:border-primary/50"
                            : "text-muted-foreground border-border/40",
                          "transition-all duration-200 scale-90 hover:scale-100",
                          "border rounded"
                        )}
                        title={
                          enableDesignScheme
                            ? "Open palette & design settings"
                            : "Enable Color Scheme to customize design"
                        }
                      >
                        <Palette className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="relative">
                <div className="pb-10">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={chatMode === "ask" 
                  ? `Ask a question... (${shortcutLabel} to send)`
                  : `Describe what you want to build... (${shortcutLabel} to start)`}
                disabled={isDisabled || isEnhancing}
                className="w-full h-24 resize-none overflow-y-auto border-0 focus-visible:ring-0 shadow-none p-3"
              />
                </div>

            {/* Bottom Bar with Buttons */}
            <div className="absolute bottom-0 left-0 right-0 h-12 px-2 flex items-center gap-2">
              {/* Chat Mode Toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
                <Button
                  onClick={() => setChatMode("build")}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-xs font-medium transition-all",
                    chatMode === "build"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Cursor className="w-3 h-3 mr-1" />
                  Build
                </Button>
                <Button
                  onClick={() => setChatMode("ask")}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-xs font-medium transition-all",
                    chatMode === "ask"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ChatCircle className="w-3 h-3 mr-1" />
                  Ask
                </Button>
              </div>

              <Button
                onClick={handleFileSelect}
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <Upload className="w-4 h-4" />
              </Button>

              <div className="flex-1" />

                  <Button
                    onClick={handleEnhance}
                    disabled={!input.trim() || isDisabled || isEnhancing}
                    variant="ghost"
                    className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10"
                    title="Enhance prompt"
                  >
                    {isEnhancing ? (
                      <SpinnerGap className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkle className="w-4 h-4" />
                    )}
                  </Button>

                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isDisabled || isEnhancing}
                    className="h-7 w-7 p-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                    title="Start building"
                  >
                    <PaperPlaneRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Guidance buttons row */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onGitHubImport}
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full px-3 bg-muted/50 border border-border/60 text-muted-foreground hover:bg-muted hover:border-primary/30 hover:text-foreground hover:shadow-md transition-all duration-300"
                      title="Import a repository from GitHub"
                    >
                      <GithubLogo className="w-4 h-4 mr-1.5" />
                      Import from GitHub
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Import a repository from GitHub</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onFigmaImport}
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full px-3 bg-muted/50 border border-border/60 text-muted-foreground hover:bg-muted hover:border-purple-500/30 hover:text-foreground hover:shadow-md transition-all duration-300"
                      title="Connect Figma"
                    >
                      <svg
                        className="w-4 h-4 mr-1.5"
                        viewBox="0 0 38 57"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" />
                        <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" />
                        <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" />
                        <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" />
                        <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" />
                      </svg>
                      Figma
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Connect Figma</TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full px-3"
                      title="Start with an example prompt"
                    >
                      <BookOpen className="w-4 h-4 mr-1.5" />
                      Examples
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-md p-2">
                    <DropdownMenuLabel className="px-1.5 py-1 text-xs text-muted-foreground">
                      Start with an example
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
                      {examplePrompts.map((item) => (
                        <DropdownMenuItem
                          key={item.label}
                          onClick={() => handleInsertExamplePrompt(item.prompt)}
                          className="p-0 cursor-pointer focus:bg-transparent"
                        >
                          <div className="w-full rounded-md border border-border/60 bg-muted/30 hover:bg-background transition-colors duration-200 p-3">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 rounded-md bg-primary/10 text-primary p-1">
                                <BookOpen className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1">
                                <div className="text-foreground font-medium text-sm">
                                  {item.label}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {item.prompt}
                                </div>
                              </div>
                              <CaretRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                    <div className="px-1.5 pt-1.5 pb-0">
                      <span className="text-[11px] text-muted-foreground">
                        Tip: Click an example to insert it into the prompt field.
                      </span>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1 py-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full px-3 hover:bg-background"
                        onClick={() => handleOpenProvider("chatgpt")}
                        aria-label="Open ChatGPT (helper prompt copied)"
                      >
                        <ArrowSquareOut className="w-4 h-4 mr-1.5" />
                        ChatGPT
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Open ChatGPT (helper prompt copied)
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full px-3 hover:bg-background"
                        onClick={() => handleOpenProvider("gemini")}
                        aria-label="Open Gemini (helper prompt copied)"
                      >
                        <ArrowSquareOut className="w-4 h-4 mr-1.5" />
                        Gemini
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Open Gemini (helper prompt copied)
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full px-3 hover:bg-background"
                        onClick={() => handleOpenProvider("perplexity")}
                        aria-label="Open Perplexity (helper prompt copied)"
                      >
                        <ArrowSquareOut className="w-4 h-4 mr-1.5" />
                        Perplexity
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Open Perplexity (helper prompt copied)
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-[11px] text-muted-foreground ml-2 whitespace-nowrap">
                    {shortcutLabel} to start
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Regular workspace input (when conversation has messages)
        <div className="rounded-xl bg-surface-2 border border-subtle overflow-hidden">
          <div
            {...dragHandlers}
            className={cn(
              "relative",
              isDragging && "bg-[var(--accent-primary)]/5"
            )}
          >
            {/* Text Input */}
            <div className="pb-11">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={chatMode === "ask" ? "Ask a question..." : "What shall we build today?"}
                disabled={isDisabled || isEnhancing}
                className="w-full min-h-24 resize-none overflow-y-auto border-0 focus-visible:ring-0 shadow-none px-4 py-3 bg-transparent text-primary placeholder-tertiary text-sm"
              />
            </div>

            {/* Bottom Bar with Buttons */}
            <div className="absolute bottom-0 left-0 right-0 h-11 px-3 flex items-center gap-2">
              {/* Chat Mode Toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
                <Button
                  onClick={() => setChatMode("build")}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs font-medium transition-all",
                    chatMode === "build"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Cursor className="w-3 h-3 mr-1" />
                  Build
                </Button>
                <Button
                  onClick={() => setChatMode("ask")}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs font-medium transition-all",
                    chatMode === "ask"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ChatCircle className="w-3 h-3 mr-1" />
                  Ask
                </Button>
              </div>

              {/* Model Selector - Always visible */}
              {selectedModel && onModelChange && (
                <Select
                  value={selectedModel}
                  onValueChange={(value) => {
                    if (onModelChange) {
                      onModelChange(value);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[140px] bg-muted/50 border border-border/60 text-foreground text-xs hover:bg-muted hover:border-primary/30 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background/80 border border-primary/30">
                    {OPENROUTER_MODELS.map((model) => (
                      <SelectItem
                        key={model.id}
                        value={model.id}
                        className="text-foreground hover:bg-primary/20"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{model.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {model.provider}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Upload Button */}
              <Button
                onClick={handleFileSelect}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-tertiary hover:text-primary hover:bg-surface-3/50 rounded-full transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
              </Button>

              {/* Edit Button */}
              <Button
                onClick={() => {
                  if (!isEditActive) {
                    setWorkspaceActiveTab("preview");
                    setIsEditActive(true);
                    const event = new CustomEvent("toggleInspector", {
                      detail: { enabled: true },
                    });
                    window.dispatchEvent(event);
                  } else {
                    setIsEditActive(false);
                    const event = new CustomEvent("toggleInspector", {
                      detail: { enabled: false },
                    });
                    window.dispatchEvent(event);
                    try {
                      window.dispatchEvent(new CustomEvent("endEditMode"));
                    } catch {}
                  }
                }}
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 px-3 rounded-lg gap-1.5 text-xs font-medium transition-all border",
                  isEditActive
                    ? "bg-[var(--accent-primary)]/20 text-accent-primary border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/30"
                    : "bg-surface-3/50 text-secondary border-subtle hover:bg-surface-3 hover:text-primary"
                )}
                title={
                  isEditActive
                    ? "Click an element in preview"
                    : "Edit element in preview"
                }
              >
                <SelectionPlus className="w-3.5 h-3.5" />
                Edit Canvas
              </Button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Action Buttons */}
              {!isLoading && !isStreaming && (
                <Button
                  onClick={handleEnhance}
                  disabled={!input.trim() || isDisabled || isEnhancing}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-tertiary hover:text-accent-primary hover:bg-[var(--accent-primary)]/10 rounded-full transition-colors"
                  title="Enhance prompt"
                >
                  {isEnhancing ? (
                    <SpinnerGap className="w-4 h-4 animate-spin text-accent-primary" />
                  ) : (
                    <Sparkle className="w-4 h-4" />
                  )}
                </Button>
              )}

              {/* Send button - Purple styled */}
              {!isLoading && !isStreaming && (
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isDisabled || isEnhancing}
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0 rounded-full transition-all",
                    input.trim() && !isDisabled && !isEnhancing
                      ? "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)]"
                      : "bg-surface-3 text-tertiary cursor-not-allowed"
                  )}
                  title="Send message"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
              )}

              {/* Stop button */}
              {(isLoading || isStreaming) && onInterrupt && (
                <Button
                  onClick={onInterrupt}
                  size="sm"
                  className="h-8 w-8 p-0 bg-[var(--error-500)]/20 hover:bg-[var(--error-500)]/30 text-error-500 rounded-full"
                  title="Stop generation"
                >
                  <Square className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="mt-1.5 px-1 text-[10px] text-tertiary text-right">
        Ctrl+Enter to Run • Esc to Stop
      </div>
    </div>
  );
}
