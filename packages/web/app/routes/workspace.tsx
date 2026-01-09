import type { Route } from "./+types/workspace";
import { redirect } from "react-router";
import { auth } from "../lib/auth";
import ChatPanel from "../components/ChatPanel";
import RightPanel from "../components/RightPanel";
import { WorkspaceChatInput } from "../components/WorkspaceChatInput";
import GradientGlow from "../components/GradientGlow";
import WorkspaceLoader from "../components/WorkspaceLoader";
import { WorkspaceLeftHeader } from "../components/WorkspaceLeftHeader";
import { WorkspaceRightHeader } from "../components/WorkspaceRightHeader";
import { useWorkspaceController } from "../hooks/useWorkspaceController";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router";
import { usePreventBrowserDragDrop } from "../hooks/usePreventBrowserDragDrop";
import { useFileHandling } from "../hooks/useFileHandling";
import type { DesignScheme } from "../types/design-scheme";
import { InsufficientBalanceModal, ProjectSidebar } from "../components";
import GitHubImportModal from "../components/GitHubImportModal";
import FigmaImportModal from "../components/FigmaImportModal";
import { ColorSchemeDialog } from "../components/ui/ColorSchemeDialog";
import {
  DatabaseConnectionDialog,
  type DbProvider,
} from "../components/DatabaseConnectionDialog";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import {
  Database,
  Palette,
  Upload,
  GithubLogo,
  SpinnerGap,
  Sparkle,
  ArrowUp,
  CurrencyDollar,
  Gear,
} from "@phosphor-icons/react";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { FilePreview } from "../components/FileUpload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { cn } from "../lib/utils";
import { OPENROUTER_MODELS } from "../consts/models";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "../components/ui/resizable";
import { Check } from "phosphor-react";

export async function loader({ request }: Route.LoaderArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  return { conversationId, user: session.user };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Workspace - NowgAI" },
    { name: "description", content: "Build fullstack web apps by prompting" },
  ];
}

export default function Workspace({ loaderData }: Route.ComponentProps) {
  const user = loaderData?.user;
  const location = useLocation();
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] =
    useState(false);
  const [errorData, setErrorData] = useState<any>(null);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showFigmaModal, setShowFigmaModal] = useState(false);
  const [showDatabaseDialog, setShowDatabaseDialog] = useState(false);
  const [selectedDbProvider, setSelectedDbProvider] =
    useState<DbProvider | null>(null);
  const [isProvisioningNeon, setIsProvisioningNeon] = useState(false);
  const [adminProjectId, setAdminProjectId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingConversationData, setIsLoadingConversationData] =
    useState(false);
  const [hasLoadedConversationData, setHasLoadedConversationData] =
    useState(false);
  const [messagesLoadedForConversation, setMessagesLoadedForConversation] =
    useState<string | null>(null);
  const [shortcutLabel, setShortcutLabel] = useState("⌘ Return");
  const lastConversationIdRef = useRef<string | null>(null);
  const messagesCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [shouldShowLoader, setShouldShowLoader] = useState(true); // Latch to prevent flicker

  const {
    hasSupabaseConnected,
    isCheckingToken: isCheckingSupabase,
    supabaseUser,
    handleConnectSupabase,
    handleDisconnectSupabase,
  } = useSupabaseAuth();

  const [designScheme, setDesignScheme] = useState<DesignScheme | undefined>(
    () => {
      const state = location.state as any;
      return state?.designScheme;
    }
  );
  const [enableDesignScheme, setEnableDesignScheme] = useState<boolean>(false);

  const [hadInitialPrompt] = useState(
    () => !!(location.state as any)?.initialPrompt
  );

  // Handle insufficient balance modal
  const handleInsufficientBalance = (errorData?: any) => {
    setErrorData(errorData || null);
    setShowInsufficientBalanceModal(true);
  };

  const controller = useWorkspaceController(
    enableDesignScheme ? designScheme : undefined,
    handleInsufficientBalance
  );

  const [selectedElementInfo, setSelectedElementInfo] = useState<any | null>(
    null
  );

  // Get file reconstruction state from store
  const isReconstructingFiles = useWorkspaceStore(
    (state) => state.isReconstructingFiles
  );

  // Track when messages have been loaded for the current conversation
  // This ensures we don't show empty UI before messages have a chance to load
  useEffect(() => {
    // Clear any pending timeout when conversation changes
    if (lastConversationIdRef.current !== controller.conversationId) {
      if (messagesCheckTimeoutRef.current) {
        clearTimeout(messagesCheckTimeoutRef.current);
        messagesCheckTimeoutRef.current = null;
      }
      lastConversationIdRef.current = controller.conversationId;
      setMessagesLoadedForConversation(null);
    }

    if (controller.conversationId) {
      // If we have messages, mark them as loaded immediately
      if (controller.messages.length > 0) {
        setMessagesLoadedForConversation(controller.conversationId);
        if (messagesCheckTimeoutRef.current) {
          clearTimeout(messagesCheckTimeoutRef.current);
          messagesCheckTimeoutRef.current = null;
        }
      } else if (messagesLoadedForConversation === controller.conversationId) {
        // Messages were already marked as loaded for this conversation
        // This means the conversation is truly empty
      } else if (hasLoadedConversationData) {
        // Conversation metadata is loaded, but messages haven't been set yet
        // Wait for useWorkspaceInit to finish loading messages
        // Clear any existing timeout first
        if (messagesCheckTimeoutRef.current) {
          clearTimeout(messagesCheckTimeoutRef.current);
        }
        messagesCheckTimeoutRef.current = setTimeout(() => {
          // After delay, if messages are still empty, mark as loaded (truly empty conversation)
          if (controller.conversationId && controller.messages.length === 0) {
            setMessagesLoadedForConversation(controller.conversationId);
          }
          messagesCheckTimeoutRef.current = null;
        }, 800); // Increased delay to ensure useWorkspaceInit has time to load
      }
    } else {
      // No conversation, reset state
      setMessagesLoadedForConversation(null);
      lastConversationIdRef.current = null;
    }

    return () => {
      if (messagesCheckTimeoutRef.current) {
        clearTimeout(messagesCheckTimeoutRef.current);
        messagesCheckTimeoutRef.current = null;
      }
    };
  }, [
    controller.conversationId,
    controller.messages.length,
    hasLoadedConversationData,
    messagesLoadedForConversation,
  ]);

  // Conversation + loading state helpers
  const hasConversation = !!controller.conversationId;
  const hasMessagesLoaded =
    messagesLoadedForConversation === controller.conversationId;

  // Keep loader visible until we've confirmed messages are loaded
  // This prevents any flash of empty UI
  const isHydratingConversation =
    hasConversation &&
    !hadInitialPrompt && // Skip loader when coming from home with initial prompt
    (isInitialLoading ||
      controller.chatIsLoading ||
      controller.chatIsStreaming ||
      controller.isProcessingTemplate ||
      isLoadingConversationData ||
      !hasLoadedConversationData ||
      isReconstructingFiles ||
      !hasMessagesLoaded);

  // Latch the loader - once loading is done, never show it again (prevents flicker)
  useEffect(() => {
    if (
      shouldShowLoader &&
      !isHydratingConversation &&
      hasConversation &&
      !hadInitialPrompt
    ) {
      // Loading is complete, turn off loader permanently
      setShouldShowLoader(false);
    }
  }, [
    shouldShowLoader,
    isHydratingConversation,
    hasConversation,
    hadInitialPrompt,
  ]);

  // Reset loader when conversation changes
  useEffect(() => {
    if (!hadInitialPrompt) {
      setShouldShowLoader(true);
    }
  }, [controller.conversationId, hadInitialPrompt]);

  // Only show empty state when we're absolutely certain:
  // 1. Initial loading is done
  // 2. Conversation data is loaded
  // 3. Messages have been confirmed loaded (even if empty)
  // 4. No active loading/streaming/processing
  // 5. Messages array is actually empty (not just not loaded yet)
  const isEmptyConversation =
    !isInitialLoading &&
    hasLoadedConversationData &&
    hasMessagesLoaded &&
    controller.messages.length === 0 &&
    !controller.chatIsLoading &&
    !controller.chatIsStreaming &&
    !controller.isProcessingTemplate &&
    !isLoadingConversationData &&
    !isReconstructingFiles &&
    hasConversation &&
    false;

  // File handling hook for drag and drop
  const {
    imageDataList,
    isDragging,
    dragHandlers,
    handleFileSelect,
    handleRemoveFile,
  } = useFileHandling({
    uploadedFiles: controller.uploadedFiles,
    setUploadedFiles: controller.setUploadedFiles,
  });

  // Platform-aware shortcut label
  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const platform = (navigator.platform || "").toLowerCase();
      const isApple =
        /mac|iphone|ipad|ipod/.test(platform) ||
        /Mac|iPhone|iPad|iPod/.test(ua);
      setShortcutLabel(isApple ? "⌘ Return" : "Ctrl+Enter");
    } catch {}
  }, []);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Load conversation data to check adminProjectId and database provider
  useEffect(() => {
    const loadConversationData = async () => {
      if (controller.conversationId) {
        setIsLoadingConversationData(true);
        setHasLoadedConversationData(false);
        try {
          const response = await fetch(
            `/api/conversations?conversationId=${controller.conversationId}`
          );
          if (response.ok) {
            const data = await response.json();
            // Check if conversation belongs to a project
            if (data.conversation?.adminProjectId) {
              setAdminProjectId(
                typeof data.conversation.adminProjectId === "string"
                  ? data.conversation.adminProjectId
                  : data.conversation.adminProjectId.toString()
              );
            } else {
              setAdminProjectId(null);
            }
            // Check if database is already provisioned
            if (data.conversation?.dbProvider) {
              setSelectedDbProvider(data.conversation.dbProvider as DbProvider);
            } else {
              setSelectedDbProvider(null);
            }
          }
        } catch (error) {
          console.error("Failed to load conversation data:", error);
          setAdminProjectId(null);
          setSelectedDbProvider(null);
        } finally {
          setIsLoadingConversationData(false);
          setHasLoadedConversationData(true);
        }
      } else {
        // Reset when conversation changes
        setAdminProjectId(null);
        setSelectedDbProvider(null);
        setIsLoadingConversationData(false);
        setHasLoadedConversationData(false);
      }
    };
    loadConversationData();
  }, [controller.conversationId]);

  // Handle database toggle - opens dialog to select provider
  // Once enabled, database cannot be disabled
  const handleDatabaseToggle = (checked: boolean) => {
    // If database is already enabled, don't allow disabling
    if (selectedDbProvider !== null) {
      return;
    }
    if (checked) {
      setShowDatabaseDialog(true);
    }
  };

  // Handle database provider selection from dialog
  const handleSelectDbProvider = async (provider: DbProvider) => {
    if (!controller.conversationId) return;

    if (provider === "neon") {
      setIsProvisioningNeon(true);
      try {
        const response = await fetch("/api/neon/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: controller.conversationId,
            enable: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          alert(
            `Failed to provision Neon: ${errorData.message || "Unknown error"}`
          );
          return;
        }

        setSelectedDbProvider(provider);
        setShowDatabaseDialog(false);
      } catch (error) {
        console.error("Failed to provision Neon:", error);
        alert("Failed to provision Neon database. Please try again.");
      } finally {
        setIsProvisioningNeon(false);
      }
    } else {
      // Supabase - only enable if already connected
      if (!hasSupabaseConnected) {
        console.warn("Cannot select Supabase - user not authenticated.");
        return;
      }

      try {
        const response = await fetch("/api/supabase/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: controller.conversationId,
            enable: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          alert(
            `Failed to provision Supabase: ${
              errorData.message || "Unknown error"
            }`
          );
          if (errorData.error === "SUPABASE_NOT_CONNECTED") {
            handleConnectSupabase();
          }
          return;
        }

        setSelectedDbProvider(provider);
        setShowDatabaseDialog(false);
      } catch (error) {
        console.error("Failed to provision Supabase:", error);
        alert("Failed to provision Supabase database. Please try again.");
      }
    }
  };

  // Use backend-generated title or fallback to first user message
  const getChatTitle = () => {
    // Use backend-generated title if available
    if (controller.conversationTitle) {
      return controller.conversationTitle;
    }

    // If we have a conversation ID but no title, it might still be loading
    if (controller.conversationId && !controller.conversationTitle) {
      return "Loading...";
    }

    // Fallback to first user message if no backend title
    const firstUserMessage = controller.messages.find((m) => m.role === "user");
    if (firstUserMessage?.content) {
      const fallbackTitle =
        firstUserMessage.content.slice(0, 50).trim() +
        (firstUserMessage.content.length > 50 ? "..." : "");
      return fallbackTitle;
    }

    return undefined;
  };

  usePreventBrowserDragDrop();

  // Show loading screen while the workspace is initializing or hydrating
  // an existing conversation. This prevents the intermediate empty hero
  // screen from briefly flashing between the home page and workspace.
  // Use shouldShowLoader latch for existing conversations to prevent flicker
  const showLoader = hadInitialPrompt
    ? false // New conversation from home - show workspace immediately
    : (isInitialLoading || (isHydratingConversation && shouldShowLoader)) &&
      hasConversation;

  if (showLoader) {
    return <WorkspaceLoader title={getChatTitle()} />;
  }

  return (
    <div className="h-screen w-screen bg-[#080808] text-white flex overflow-hidden">
      {/* Sidebar */}
      <ProjectSidebar user={user} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Gradient Background - subtle in workspace */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-[-30%] left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-gradient-to-t from-purple-500/10 via-pink-500/5 to-transparent blur-[100px]" />
        </div>

        {isEmptyConversation ? (
          // Empty state UI - new design
          <main
            {...dragHandlers}
            className={cn(
              "relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-24 overflow-y-auto",
              isDragging && "bg-purple-500/5"
            )}
          >
            {/* Hero */}
            <div className="text-center mb-8">
              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-3">
                Your next big thing starts here
              </h1>
              <p className="text-lg text-white/50 font-medium">
                Prompt to Production Ready Apps
              </p>
            </div>

            {/* Input Container */}
            <div className="w-full max-w-3xl">
              {/* Model & Options Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                {/* Model Selection */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-white/60">
                    Model:
                  </label>
                  <Select
                    value={controller.selectedModel}
                    onValueChange={controller.setSelectedModel}
                  >
                    <SelectTrigger className="w-52 bg-white/[0.04] border-white/[0.08] text-white h-9 hover:bg-white/[0.06]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10">
                      {OPENROUTER_MODELS.map((model) => (
                        <SelectItem
                          key={model.id}
                          value={model.id}
                          className="text-white hover:bg-white/10"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm">{model.name}</span>
                            <span className="text-xs text-white/50">
                              {model.provider}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Options */}
                <div className="flex items-center gap-3">
                  {/* Database Toggle */}
                  {selectedDbProvider !== null ? (
                    // Database enabled - show checkmark
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <Database className="w-4 h-4 text-purple-400" />
                      <Label className="text-xs text-white/80">
                        Database Enabled
                      </Label>
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20">
                        <Check className="w-3 h-3 text-purple-400" />
                      </div>
                    </div>
                  ) : (
                    // Database not enabled - show toggle
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <Database className="w-4 h-4 text-purple-400" weight="bold" />
                      <Label
                        htmlFor="db-toggle"
                        className="text-xs text-white/60 cursor-pointer"
                      >
                        Enable Database
                      </Label>
                      <Switch
                        id="db-toggle"
                        checked={false}
                        onCheckedChange={handleDatabaseToggle}
                        className="scale-75 data-[state=checked]:bg-purple-500"
                      />
                      {selectedDbProvider !== null && (
                        <Button
                          onClick={() => setShowDatabaseDialog(true)}
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                        >
                          <Gear className="w-3 h-3" weight="bold" />
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Color Scheme Toggle */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Palette className="w-4 h-4 text-pink-400" weight="bold" />
                    <Label
                      htmlFor="design-toggle"
                      className="text-xs text-white/60 cursor-pointer"
                    >
                      Color Scheme
                    </Label>
                    <Switch
                      id="design-toggle"
                      checked={enableDesignScheme}
                      onCheckedChange={(checked) => {
                        setEnableDesignScheme(!!checked);
                        if (!checked) setDesignScheme(undefined);
                      }}
                      className="scale-75 data-[state=checked]:bg-pink-500"
                    />
                    {enableDesignScheme && (
                      <Button
                        onClick={() => {
                          const event = new CustomEvent(
                            "openColorSchemeDialog"
                          );
                          window.dispatchEvent(event);
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-pink-400 hover:text-pink-300 hover:bg-pink-500/10"
                      >
                        <Palette className="w-3 h-3" weight="bold" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* File Preview */}
              {controller.uploadedFiles.length > 0 && (
                <FilePreview
                  files={controller.uploadedFiles}
                  onRemove={handleRemoveFile}
                  removeIcon="✕"
                  fileIcon="📄"
                  imageDataList={imageDataList}
                  className="mb-4"
                />
              )}

              {/* Input Field */}
              <div
                className={cn(
                  "relative bg-[#1a1a1a]/80 backdrop-blur-xl border rounded-2xl overflow-hidden shadow-2xl shadow-black/40 transition-colors",
                  isDragging
                    ? "border-purple-500/50 bg-purple-500/5"
                    : "border-white/[0.08]"
                )}
              >
                <textarea
                  value={controller.input}
                  onChange={(e) => controller.setInput(e.target.value)}
                  onKeyDown={controller.handleKeyDown}
                  placeholder={`What shall we build today? (${shortcutLabel} to start)`}
                  disabled={
                    controller.chatIsLoading || controller.isProcessingTemplate
                  }
                  rows={1}
                  className="w-full bg-transparent text-white placeholder:text-white/30 px-5 py-4 pr-28 resize-none focus:outline-none text-base min-h-[56px] max-h-[200px]"
                  style={{ height: "96px" }}
                />

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    {/* File Upload Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleFileSelect}
                          className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
                        >
                          <Upload className="w-4 h-4" weight="bold" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Upload files</TooltipContent>
                    </Tooltip>

                    {/* GitHub Import */}
                    <button
                      onClick={() => setShowGitHubModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white text-sm font-medium transition-all"
                    >
                      <GithubLogo className="w-3.5 h-3.5" weight="bold" />
                      Import from GitHub
                    </button>

                    {/* Figma Import */}
                    <button
                      onClick={() => setShowFigmaModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white text-sm font-medium transition-all"
                    >
                      <svg
                        className="w-3.5 h-3.5"
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
                      Import from Figma
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Submit Button */}
                    <button
                      onClick={controller.handleSubmit}
                      disabled={
                        !controller.input.trim() ||
                        controller.chatIsLoading ||
                        controller.isProcessingTemplate
                      }
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                        controller.input.trim() &&
                          !controller.chatIsLoading &&
                          !controller.isProcessingTemplate
                          ? "bg-white text-black hover:bg-white/90"
                          : "bg-white/10 text-white/30 cursor-not-allowed"
                      )}
                    >
                      {controller.chatIsLoading ||
                      controller.isProcessingTemplate ? (
                        <SpinnerGap className="w-4 h-4 animate-spin" weight="bold" />
                      ) : (
                        <ArrowUp className="w-4 h-4" weight="bold" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        ) : (
          // Regular workspace view (when conversation has messages)
          <div className="flex-1 z-10 min-h-0 h-screen transition-all duration-200 ease-out relative">
            {/* Top glow effect - positioned towards left */}
            <div
              className="pointer-events-none absolute -top-8 left-0 h-48 w-[600px] z-20"
              style={{
                background:
                  "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139, 92, 246, 0.8) 0%, rgba(168, 85, 247, 0.8) 40%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />
            <ResizablePanelGroup
              direction="horizontal"
              className="gap-0 relative z-10"
            >
              {/* Left Panel - Chat (narrower) */}
              <ResizablePanel defaultSize={28} minSize={22} maxSize={40}>
                <div className="flex flex-col h-full min-h-0 max-h-full bg-canvas py-2">
                  {/* Left Panel Header */}
                  <WorkspaceLeftHeader chatTitle={getChatTitle()} />

                  {/* Chat Messages */}
                  <div className="flex-1 min-h-0 overflow-auto modern-scrollbar">
                    <ChatPanel
                      messages={controller.messages}
                      selectedModel={controller.selectedModel}
                      isLoading={
                        controller.chatIsLoading || controller.chatIsStreaming
                      }
                      isProcessingTemplate={controller.isProcessingTemplate}
                      error={controller.chatError}
                      onRevert={controller.handleRevert}
                      selectedElementInfo={selectedElementInfo}
                      onInspectorEnable={() => setSelectedElementInfo(null)}
                    />
                  </div>
                  {/* Bottom Section with Balance and Input */}
                  <div className="shrink-0 bg-canvas">
                    {/* Database Toggle */}
                    <div className="px-3 pb-2 flex items-center gap-3">
                      {selectedDbProvider !== null ? (
                        // Database enabled - show checkmark
                        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <Database className="w-3.5 h-3.5 text-purple-400" />
                          <Label className="text-xs text-white/80">
                            Database Enabled
                          </Label>
                          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/20">
                            <Check className="w-2.5 h-2.5 text-purple-400" />
                          </div>
                        </div>
                      ) : (
                        // Database not enabled - show toggle
                        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <Database className="w-3.5 h-3.5 text-purple-400" />
                          <Label
                            htmlFor="db-toggle-chat"
                            className="text-xs text-white/60 cursor-pointer"
                          >
                            Enable Database
                          </Label>
                          <Switch
                            id="db-toggle-chat"
                            checked={false}
                            onCheckedChange={handleDatabaseToggle}
                            className="scale-75 data-[state=checked]:bg-purple-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="px-3 pb-3">
                      <WorkspaceChatInput
                        input={controller.input}
                        setInput={controller.setInput}
                        onSubmit={controller.handleSubmit}
                        onKeyDown={controller.handleKeyDown}
                        isLoading={controller.chatIsLoading}
                        isProcessingTemplate={controller.isProcessingTemplate}
                        isStreaming={controller.chatIsStreaming}
                        onInterrupt={controller.handleInterrupt}
                        uploadedFiles={controller.uploadedFiles}
                        setUploadedFiles={controller.setUploadedFiles}
                        isEmpty={false}
                        conversationId={controller.conversationId}
                        selectedModel={controller.selectedModel}
                        onModelChange={controller.setSelectedModel}
                      />
                    </div>
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle className="w-px bg-subtle hover:bg-[var(--accent-primary)]/50 transition-colors" />

              {/* Right Panel - Preview/Editor (wider) */}
              <ResizablePanel defaultSize={72} minSize={55}>
                <div className="flex flex-col h-full min-h-0 max-h-full bg-canvas overflow-hidden py-2">
                  {/* Right Panel Header */}
                  <WorkspaceRightHeader
                    conversationId={controller.conversationId || undefined}
                    messageCount={controller.messages.length}
                    versions={controller.versionOptions}
                    currentVersionId={controller.currentVersionId}
                    activeTab={controller.activeTab}
                    onTabChange={controller.setActiveTab}
                    previewUrl={controller.previewUrl}
                    onVersionSelect={controller.handleVersionSelect}
                  />

                  {/* Right Panel Content */}
                  <div className="flex-1 min-h-0 overflow-hidden pb-2 pr-2">
                    <RightPanel
                      activeTab={controller.activeTab}
                      setActiveTab={controller.setActiveTab}
                      templateFilesState={controller.templateFilesState}
                      selectedPath={controller.selectedPath}
                      setSelectedPath={controller.setSelectedPath}
                      saveFile={controller.saveFile}
                      previewUrl={controller.previewUrl || undefined}
                      terminalLines={controller.terminalLines}
                      isTerminalRunning={controller.isTerminalRunning}
                      isLoading={
                        controller.chatIsLoading || controller.chatIsStreaming
                      }
                      conversationTitle={
                        controller.conversationTitle || undefined
                      }
                      conversationId={controller.conversationId || undefined}
                      onElementSelected={(info) => setSelectedElementInfo(info)}
                      onInspectorEnable={() => setSelectedElementInfo(null)}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>

      {/* Insufficient Balance Modal */}
      <InsufficientBalanceModal
        isOpen={showInsufficientBalanceModal}
        onClose={() => {
          setShowInsufficientBalanceModal(false);
          setErrorData(null);
        }}
        errorData={errorData}
      />

      {/* GitHub Import Modal */}
      <GitHubImportModal
        isOpen={showGitHubModal}
        onClose={() => setShowGitHubModal(false)}
        selectedModel={controller.selectedModel}
      />

      {/* Figma Import Modal */}
      <FigmaImportModal
        isOpen={showFigmaModal}
        onClose={() => setShowFigmaModal(false)}
        selectedModel={controller.selectedModel}
      />

      {/* Color Scheme Dialog */}
      <ColorSchemeDialog
        designScheme={designScheme}
        setDesignScheme={setDesignScheme}
        showButton={false}
      />

      {/* Database Connection Dialog */}
      <DatabaseConnectionDialog
        open={showDatabaseDialog}
        onOpenChange={setShowDatabaseDialog}
        hasSupabaseConnected={hasSupabaseConnected}
        isCheckingSupabaseToken={isCheckingSupabase}
        supabaseEmail={supabaseUser?.email}
        onConnectSupabase={handleConnectSupabase}
        onDisconnectSupabase={handleDisconnectSupabase}
        selectedProvider={selectedDbProvider}
        onSelectProvider={handleSelectDbProvider}
        isProvisioningNeon={isProvisioningNeon}
        isNeonAvailable={true}
      />
    </div>
  );
}
