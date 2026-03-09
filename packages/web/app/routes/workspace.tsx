import {
  ArrowUp,
  Check,
  Database,
  DownloadSimple,
  Gear,
  GithubLogo,
  List,
  Palette,
  SpinnerGap,
  Upload,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { redirect, useLocation, useSearchParams } from "react-router";
import {
  AgentModal,
  InsufficientBalanceModal,
  ProjectSidebar,
} from "../components";
import ChatPanel from "../components/ChatPanel";
import {
  DatabaseConnectionDialog,
  type DbProvider,
} from "../components/DatabaseConnectionDialog";
import { DownloadModal } from "../components/DownloadModal";
import FigmaImportModal from "../components/FigmaImportModal";
import { FilePreview } from "../components/FileUpload";
import GitHubImportModal from "../components/GitHubImportModal";
import RightPanel from "../components/RightPanel";
import { Button } from "../components/ui/button";
import { ColorSchemeDialog } from "../components/ui/ColorSchemeDialog";
import { Label } from "../components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";
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
import { WorkspaceChatInput } from "../components/WorkspaceChatInput";
import { WorkspaceLeftHeader } from "../components/WorkspaceLeftHeader";
import WorkspaceLoader from "../components/WorkspaceLoader";
import { WorkspaceRightHeader } from "../components/WorkspaceRightHeader";
import { OPENROUTER_MODELS } from "../consts/models";
import { useFileHandling } from "../hooks/useFileHandling";
import { usePreventBrowserDragDrop } from "../hooks/usePreventBrowserDragDrop";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { useWorkspaceController } from "../hooks/useWorkspaceController";
import { auth } from "../lib/auth";
import { downloadCodebaseAsZip, getProjectName } from "../lib/downloadCodebase";
import { downloadMessagesAsHTML } from "../lib/downloadMessages";
import { cn } from "../lib/utils";
import {
  useIsReconstructingFiles,
  useWorkspaceStore,
} from "../stores/useWorkspaceStore";
import type { DesignScheme } from "../types/design-scheme";
import { getShortcutLabel } from "../utils/platform";
import type { Route } from "./+types/workspace";
import type { PreviewApiHandle } from "../components/Preview";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const currentChatId = searchParams.get("chatId");
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] =
    useState(false);
  const [errorData, setErrorData] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [isPersistentModal, setIsPersistentModal] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showFigmaModal, setShowFigmaModal] = useState(false);
  const [showDatabaseDialog, setShowDatabaseDialog] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
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
  const shortcutLabel = getShortcutLabel();
  const lastConversationIdRef = useRef<string | null>(null);
  const messagesCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [shouldShowLoader, setShouldShowLoader] = useState(true); // Latch to prevent flicker
  const [currentChatTitle, setCurrentChatTitle] = useState<string | null>(null);
  const chatTitlePollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isCreatingNewChat, setIsCreatingNewChat] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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
    },
  );
  const [enableDesignScheme, setEnableDesignScheme] = useState<boolean>(false);

  const [hadInitialPrompt] = useState(
    () => !!(location.state as any)?.initialPrompt,
  );

  // Handle insufficient balance modal (triggered by prompts - not persistent)
  const handleInsufficientBalance = (errorData?: any) => {
    setErrorData(errorData || null);
    setIsPersistentModal(false); // Not persistent when triggered by prompt
    setShowInsufficientBalanceModal(true);
  };

  const controller = useWorkspaceController(
    enableDesignScheme ? designScheme : undefined,
    handleInsufficientBalance,
    // Update chat title immediately when generated from first message
    (title: string) => {
      setCurrentChatTitle(title);
      // Clear polling since we have the title now
      if (chatTitlePollIntervalRef.current) {
        clearTimeout(chatTitlePollIntervalRef.current);
        chatTitlePollIntervalRef.current = null;
      }
    },
  );

  const [selectedElementInfo, setSelectedElementInfo] = useState<any | null>(
    null,
  );

  const previewApiRef = useRef<PreviewApiHandle | null>(null);

  const handleSaveEdit = useCallback(async () => {
    const api = previewApiRef.current;
    if (!api) {
      console.warn("[Workspace] Preview not ready for save edit");
      return;
    }
    const convId = controller.conversationId;
    const files = controller.templateFilesState || [];
    if (!convId || files.length === 0) {
      console.warn("[Workspace] No conversation or files to save");
      return;
    }
    try {
      const html = await api.getPreviewHtml();
      const res = await fetch("/api/applyEditToSource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map((f: { path: string; content: string }) => ({
            path: f.path,
            content: f.content,
          })),
          previewHtml: html,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Save edit failed: ${res.status}`);
      }
      const data = await res.json();
      if (!data.success || !Array.isArray(data.files)) {
        throw new Error(data?.error || "Invalid response from server");
      }
      const mergedFiles = (controller.templateFilesState || []).map(
        (f: { path: string; content: string; name?: string }) => {
          const updated = data.files.find(
            (x: { path: string }) => x.path === f.path,
          );
          return updated
            ? { name: f.name || f.path.split("/").pop() || "", path: updated.path, content: updated.content }
            : { name: f.name || f.path.split("/").pop() || "", path: f.path, content: f.content };
        },
      );
      for (const f of data.files) {
        if (f.path && typeof f.content === "string") {
          controller.saveFile(f.path, f.content);
          if (!mergedFiles.some((m: { path: string }) => m.path === f.path)) {
            mergedFiles.push({ name: f.path.split("/").pop() || "", path: f.path, content: f.content });
          }
        }
      }
      const { useWorkspaceStore } = await import("../stores/useWorkspaceStore");
      const { uploadFilesToR2WithPresignedUrls, syncConversationJsonToR2 } =
        await import("../lib/r2UploadClient");
      const { filesToSnapshot, saveSnapshot } =
        await import("../lib/chatPersistence");
      useWorkspaceStore.getState().setIsSyncingToR2(true);
      try {
        await uploadFilesToR2WithPresignedUrls(convId, undefined, mergedFiles);
        await syncConversationJsonToR2(convId);
        const snapshot = filesToSnapshot(
          mergedFiles.map((f: { path: string; content: string }) => ({
            path: f.path,
            content: f.content,
          })),
        );
        await saveSnapshot(convId, snapshot);

        // Create a new version after saving the edit
        if (controller.handleManualVersionCreate) {
          // Force create a new version using the explicitly merged files
          controller.handleManualVersionCreate("Canvas Edit", true, mergedFiles);
        }
      } finally {
        useWorkspaceStore.getState().setIsSyncingToR2(false);
      }
    } catch (e) {
      console.error("[Workspace] Save edit failed:", e);
      throw e;
    }
  }, [
    controller.conversationId,
    controller.templateFilesState,
    controller.saveFile,
    controller.handleManualVersionCreate,
  ]);

  // Get file reconstruction state from store - use optimized selector
  const isReconstructingFiles = useIsReconstructingFiles();

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

  // Safety timeout: Force-clear loading states if stuck for too long
  // This prevents the loading screen from getting stuck indefinitely
  // (e.g., when returning to page during streaming and resume fails)
  useEffect(() => {
    if (!isHydratingConversation || !hasConversation) return;

    const timeout = setTimeout(() => {
      console.warn(
        "[Workspace] Loading timeout (15s) - checking for stuck states",
      );

      // Check if we have messages loaded - if so, we shouldn't be showing loader
      if (controller.messages.length > 0) {
        console.warn(
          "[Workspace] Messages exist but loader still showing - forcing reset",
        );

        // Force reset loading states via the store
        const { setIsReconstructingFiles } = useWorkspaceStore.getState();
        setIsReconstructingFiles(false);

        // Force reset chat loading states if they're stuck
        if (controller.chatIsLoading && !controller.chatIsStreaming) {
          controller.chat?.setIsLoading?.(false);
        }

        // Force the loader off
        setShouldShowLoader(false);
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timeout);
  }, [
    isHydratingConversation,
    hasConversation,
    controller.messages.length,
    controller.chatIsLoading,
    controller.chatIsStreaming,
  ]);

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

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Fetch user balance on page load and show persistent modal if balance is 0
  useEffect(() => {
    let aborted = false;
    const fetchBalance = async () => {
      try {
        setIsBalanceLoading(true);
        const res = await fetch("/api/profile/balance", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (!aborted) {
            setUserBalance(data.balance);
            // Show persistent modal if balance is 0 or less
            if (
              data.balance !== null &&
              data.balance <= 0 &&
              !data.isWhitelisted
            ) {
              setIsPersistentModal(true);
              setShowInsufficientBalanceModal(true);
              setErrorData({
                error:
                  "Your credits are exhausted. Please recharge to continue using the workspace.",
                errorType: "insufficient_balance",
                balance: data.balance,
                requiresRecharge: true,
              });
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      } finally {
        if (!aborted) {
          setIsBalanceLoading(false);
        }
      }
    };

    if (user) {
      fetchBalance();
    }

    return () => {
      aborted = true;
    };
  }, [user]);

  // Load conversation data to check adminProjectId and database provider
  useEffect(() => {
    const loadConversationData = async () => {
      if (controller.conversationId) {
        setIsLoadingConversationData(true);
        setHasLoadedConversationData(false);
        try {
          const response = await fetch(
            `/api/conversations?conversationId=${controller.conversationId}`,
          );
          if (response.ok) {
            const data = await response.json();
            // Check if conversation belongs to a project
            if (data.conversation?.adminProjectId) {
              setAdminProjectId(
                typeof data.conversation.adminProjectId === "string"
                  ? data.conversation.adminProjectId
                  : data.conversation.adminProjectId.toString(),
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

  // Handle download codebase
  const handleDownloadCodebase = useCallback(async () => {
    if (controller.templateFilesState.length === 0) {
      alert("No files to download. Create some files first!");
      return;
    }

    try {
      setIsDownloading(true);
      const projectName = getProjectName(
        controller.conversationTitle || undefined,
      );
      await downloadCodebaseAsZip(controller.templateFilesState, projectName);
    } catch (error) {
      console.error("Download failed:", error);
      alert(
        error instanceof Error ? error.message : "Failed to download codebase",
      );
    } finally {
      setIsDownloading(false);
    }
  }, [controller.templateFilesState, controller.conversationTitle]);

  // Handle download messages
  const handleDownloadMessages = useCallback(() => {
    if (controller.messages.length === 0) {
      alert("No messages to download.");
      return;
    }

    try {
      downloadMessagesAsHTML(
        controller.messages,
        controller.conversationTitle || undefined,
        controller.conversationId || undefined,
        currentChatId || undefined,
      );
    } catch (error) {
      console.error("Failed to download messages:", error);
      alert(
        error instanceof Error ? error.message : "Failed to download messages",
      );
    }
  }, [
    controller.messages,
    controller.conversationTitle,
    controller.conversationId,
    currentChatId,
  ]);

  // Handle download button click
  const handleDownloadClick = useCallback(() => {
    const hasCodebase = controller.templateFilesState.length > 0;
    const hasMessages = controller.messages.length > 0;

    if (hasCodebase && hasMessages) {
      // Show modal to choose
      setShowDownloadModal(true);
    } else if (hasCodebase) {
      // Only codebase, download directly
      handleDownloadCodebase();
    } else if (hasMessages) {
      // Only messages, download directly
      handleDownloadMessages();
    } else {
      alert("No files or messages to download.");
    }
  }, [
    controller.templateFilesState.length,
    controller.messages.length,
    handleDownloadCodebase,
    handleDownloadMessages,
  ]);

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
            `Failed to provision Neon: ${errorData.message || "Unknown error"}`,
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
            }`,
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

  // Reset chat title when chat changes
  useEffect(() => {
    setCurrentChatTitle(null);
    if (chatTitlePollIntervalRef.current) {
      clearTimeout(chatTitlePollIntervalRef.current);
      chatTitlePollIntervalRef.current = null;
    }
  }, [currentChatId]);

  // Fetch and poll for chat title when in a chat
  useEffect(() => {
    const fetchChatTitle = async () => {
      if (!currentChatId || !controller.conversationId) {
        setCurrentChatTitle(null);
        return;
      }

      try {
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "getChats",
            conversationId: controller.conversationId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const chat = data.chats?.find((c: any) => c.id === currentChatId);
          if (chat) {
            setCurrentChatTitle(chat.title);

            // Check if title is still a default title (Chat X) and we have messages
            // If so, keep polling for the generated title
            const isDefaultTitle = /^Chat \d+$/.test(chat.title);
            const hasMessages = controller.messages.length > 0;

            if (isDefaultTitle && hasMessages) {
              // Title is being generated, poll again in 2 seconds
              if (chatTitlePollIntervalRef.current) {
                clearTimeout(chatTitlePollIntervalRef.current);
              }
              chatTitlePollIntervalRef.current = setTimeout(() => {
                fetchChatTitle();
              }, 2000);
            } else {
              // Title is generated or no messages, stop polling
              if (chatTitlePollIntervalRef.current) {
                clearTimeout(chatTitlePollIntervalRef.current);
                chatTitlePollIntervalRef.current = null;
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching chat title:", error);
      }
    };

    fetchChatTitle();

    return () => {
      if (chatTitlePollIntervalRef.current) {
        clearTimeout(chatTitlePollIntervalRef.current);
        chatTitlePollIntervalRef.current = null;
      }
    };
  }, [currentChatId, controller.conversationId, controller.messages.length]);

  // Use backend-generated title or fallback to first user message - MEMOIZED
  const getChatTitle = useMemo(() => {
    // If we're in a chat, use the chat title
    if (currentChatId) {
      // If we have a chat title, use it
      if (currentChatTitle) {
        // Check if it's still a default title and we have messages (title is being generated)
        const isDefaultTitle = /^Chat \d+$/.test(currentChatTitle);
        const hasMessages = controller.messages.length > 0;

        if (isDefaultTitle && hasMessages) {
          // Title is being generated, show loading
          return "Loading...";
        }

        return currentChatTitle;
      }

      // No title yet, check if we have messages
      if (controller.messages.length > 0) {
        // Title is being generated
        return "Loading...";
      }

      // No messages yet, show loading
      return "Loading...";
    }

    // For conversations (not chats), use conversation title
    if (controller.conversationTitle) {
      return controller.conversationTitle;
    }

    // If we have a conversation ID but no title and no messages, it might still be loading
    if (controller.conversationId && !controller.conversationTitle) {
      return "Loading...";
    }

    return undefined;
  }, [
    currentChatId,
    currentChatTitle,
    controller.messages.length,
    controller.conversationTitle,
    controller.conversationId,
  ]);

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
    return <WorkspaceLoader title={getChatTitle} />;
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
          <>
            {/* Mobile: top bar to open sidebar */}
            <div className="md:hidden relative z-10 flex items-center justify-end px-4 py-3">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openProjectSidebar"))
                }
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/[0.06] text-white/80 hover:text-white transition-colors touch-manipulation"
                aria-label="Open menu"
              >
                <List className="w-6 h-6" weight="bold" />
              </button>
            </div>
            <main
              {...dragHandlers}
              className={cn(
                "relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-24 overflow-y-auto",
                isDragging && "bg-purple-500/5",
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
                        <Database
                          className="w-4 h-4 text-purple-400"
                          weight="bold"
                        />
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

                    {/* Download Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.08] text-xs font-medium flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06]"
                      onClick={handleDownloadClick}
                      disabled={
                        isDownloading ||
                        (controller.templateFilesState.length === 0 &&
                          controller.messages.length === 0)
                      }
                    >
                      <DownloadSimple
                        className="w-4 h-4 text-blue-400"
                        weight="bold"
                      />
                      <span className="text-xs text-white/60">
                        {isDownloading ? "Downloading..." : "Download"}
                      </span>
                    </Button>

                    {/* Color Scheme Toggle */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <Palette
                        className="w-4 h-4 text-pink-400"
                        weight="bold"
                      />
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
                              "openColorSchemeDialog",
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
                      : "border-white/[0.08]",
                  )}
                >
                  <textarea
                    value={controller.input}
                    onChange={(e) => controller.setInput(e.target.value)}
                    onKeyDown={controller.handleKeyDown}
                    placeholder={`What shall we build today? (${shortcutLabel} to start)`}
                    disabled={
                      controller.chatIsLoading ||
                      controller.isProcessingTemplate
                    }
                    rows={1}
                    className="w-full bg-transparent text-white placeholder:text-white/30 px-5 py-4 pr-28 resize-none focus:outline-none text-base min-h-[56px] max-h-[200px] overflow-y-scroll"
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
                            : "bg-white/10 text-white/30 cursor-not-allowed",
                        )}
                      >
                        {controller.chatIsLoading ||
                        controller.isProcessingTemplate ? (
                          <SpinnerGap
                            className="w-4 h-4 animate-spin"
                            weight="bold"
                          />
                        ) : (
                          <ArrowUp className="w-4 h-4" weight="bold" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </>
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
                  <WorkspaceLeftHeader
                    chatTitle={getChatTitle}
                    conversationId={controller.conversationId || undefined}
                    isCreatingNewChat={isCreatingNewChat}
                    currentChatTitle={currentChatTitle}
                    onCreateNewChat={async () => {
                      if (!controller.conversationId || isCreatingNewChat)
                        return;

                      setIsCreatingNewChat(true);
                      try {
                        const response = await fetch("/api/conversations", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "createChat",
                            conversationId: controller.conversationId,
                          }),
                        });

                        let data;
                        try {
                          data = await response.json();
                        } catch (jsonError) {
                          console.error(
                            "Error parsing JSON response:",
                            jsonError,
                          );
                          const text = await response.text();
                          console.error("Response text:", text);
                          alert(
                            `Failed to create chat: Invalid response from server (${response.status})`,
                          );
                          return;
                        }

                        if (!response.ok) {
                          console.error(
                            "Error creating chat:",
                            data.error || data.message || "Unknown error",
                          );
                          alert(
                            `Failed to create chat: ${data.error || data.message || `Server error (${response.status})`}`,
                          );
                          return;
                        }

                        if (data.success && data.chatId) {
                          // Navigate to the new chat with chatId query parameter
                          // Use setSearchParams instead of reload to preserve WebContainer state and preview
                          const newSearchParams = new URLSearchParams(
                            searchParams,
                          );
                          newSearchParams.set("chatId", data.chatId);
                          setSearchParams(newSearchParams);
                          // No reload needed - React Router will handle the navigation
                          // The useWorkspaceInit hook will detect the chatId change and load chat messages
                        } else {
                          console.error("Unexpected response format:", data);
                          alert(
                            "Failed to create chat: Invalid response format",
                          );
                        }
                      } catch (error) {
                        console.error("Error creating new chat:", error);
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : "Unknown error";
                        // Only show error if it's not a network error (network errors might be transient)
                        if (
                          !errorMessage.includes("network") &&
                          !errorMessage.includes("Network")
                        ) {
                          alert(`Failed to create chat: ${errorMessage}`);
                        } else {
                          // For network errors, try to create chat again silently or just navigate
                          console.warn(
                            "Network error during chat creation, but continuing...",
                          );
                        }
                      } finally {
                        setIsCreatingNewChat(false);
                      }
                    }}
                    currentChatId={currentChatId}
                    onChatChange={(chatId) => {
                      const newSearchParams = new URLSearchParams(searchParams);
                      if (chatId !== null) {
                        newSearchParams.set("chatId", chatId.toString());
                      } else {
                        newSearchParams.delete("chatId");
                      }
                      setSearchParams(newSearchParams);
                    }}
                  />

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
                      conversationId={controller.conversationId || undefined}
                      currentToolCalls={
                        (controller as any).currentToolCalls || []
                      }
                      streamingSegments={
                        (controller as any).streamingSegments || []
                      }
                      chatId={currentChatId || undefined}
                      conversationTitle={
                        currentChatId
                          ? (currentChatTitle ??
                              controller.conversationTitle) ||
                            undefined
                          : controller.conversationTitle || undefined
                      }
                      onFileClick={(filePath) => {
                        // Normalize path for the file tree (relative path without leading slash)
                        let normalizedPath = filePath;
                        if (normalizedPath.startsWith("/home/project/")) {
                          normalizedPath = normalizedPath.replace(
                            "/home/project/",
                            "",
                          );
                        } else if (normalizedPath.startsWith("/")) {
                          normalizedPath = normalizedPath.slice(1);
                        }
                        controller.setSelectedPath(normalizedPath);
                        // Switch to files tab to show the file in editor
                        controller.setActiveTab("files");
                      }}
                      onSaveEdit={handleSaveEdit}
                    />
                  </div>
                  {/* Bottom Section with Balance and Input */}
                  <div className="shrink-0 bg-canvas">
                    {/* Database Toggle and Download */}
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

                      {/* Download Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.08] text-xs font-medium flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06]"
                        onClick={handleDownloadClick}
                        disabled={
                          isDownloading ||
                          (controller.templateFilesState.length === 0 &&
                            controller.messages.length === 0)
                        }
                      >
                        <DownloadSimple
                          className="w-3.5 h-3.5 text-blue-400"
                          weight="bold"
                        />
                        <span className="text-xs text-white/60">
                          {isDownloading ? "..." : "Download"}
                        </span>
                      </Button>
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
                        onSaveEdit={handleSaveEdit}
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
                    onAgentClick={() => setShowAgentModal(true)}
                    onRevertToVersion={controller.handleRevertToVersion}
                    onGoToLatest={controller.handleReturnToLatestVersion}
                    isRestoringVersion={controller.isRestoringVersion}
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
                      previewApiRef={previewApiRef}
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
        persistent={isPersistentModal}
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

      {/* Agent Modal */}
      <AgentModal
        isOpen={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        templateFiles={controller.templateFilesState}
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

      {/* Download Modal */}
      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        onDownloadCodebase={handleDownloadCodebase}
        onDownloadMessages={handleDownloadMessages}
        hasCodebase={controller.templateFilesState.length > 0}
      />
    </div>
  );
}
