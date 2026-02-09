import { UserRole, hasAdminAccess } from "@nowgai/shared/types";
import {
    ArrowSquareOut,
    ArrowUp,
    Bell,
    BookOpen,
    CaretRight,
    ChartBar,
    ChatCircle,
    CurrencyDollar,
    Database,
    Gear,
    GitBranch,
    GithubLogo,
    Lightning,
    Palette,
    PlusCircle,
    Shield,
    SignOut,
    Sparkle,
    SpinnerGap,
    Users
} from "@phosphor-icons/react";
import { memo, useEffect, useRef, useState } from "react";
import { redirect, useNavigate } from "react-router";
import {
    DatabaseConnectionDialog,
    type DbProvider,
} from "../components/DatabaseConnectionDialog";
import FigmaImportModal from "../components/FigmaImportModal";
import { FilePreview } from "../components/FileUpload";
import GitHubImportModal from "../components/GitHubImportModal";
import GradientGlow from "../components/GradientGlow";
import { ProjectAdminDialog } from "../components/ProjectAdminDialog";
import { ProjectSidebar } from "../components/ProjectSidebar";
import { Button } from "../components/ui/button";
import { ColorSchemeDialog } from "../components/ui/ColorSchemeDialog";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
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
import { OPENROUTER_MODELS } from "../consts/models";
import { useFileHandling } from "../hooks/useFileHandling";
import { useOrgAdminData } from "../hooks/useOrgAdminData";
import { useProjectCreation } from "../hooks/useProjectCreation";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { auth } from "../lib/auth";
import { authClient } from "../lib/authClient";
import { preloadNodeModulesCache } from "../lib/nodeModulesPreloader";
import { cn } from "../lib/utils";
import type { DesignScheme } from "../types/design-scheme";
import { getShortcutLabel } from "../utils/platform";
import type { Route } from "./+types/home";

// Memoized Avatar component - extracted to avoid recreation on every render
interface HomeAvatarProps {
  displayName?: string;
  imageUrl?: string;
  size?: number;
}

const HomeAvatar = memo(function HomeAvatar({ displayName, imageUrl, size = 8 }: HomeAvatarProps) {
  const [broken, setBroken] = useState(false);
  const sizeClass = size === 10 ? "w-10 h-10" : "w-8 h-8";

  if (imageUrl && !broken) {
    return (
      <img
        src={imageUrl}
        alt=""
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setBroken(true)}
        className={`${sizeClass} rounded-full object-cover border border-white/10`}
      />
    );
  }

  const initials = displayName
    ? displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold`}
    >
      {initials}
    </div>
  );
});

export async function loader({ request }: Route.LoaderArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  return { user: session.user };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "NowgAI - Build Production Ready Apps" },
    {
      name: "description",
      content: "Build fullstack web apps by prompting",
    },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const user = loaderData?.user;
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(
    OPENROUTER_MODELS[0].id
  );
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const shortcutLabel = getShortcutLabel();

  const [useSupabase, setUseSupabase] = useState(false);
  const [showDatabaseDialog, setShowDatabaseDialog] = useState(false);
  const [selectedDbProvider, setSelectedDbProvider] =
    useState<DbProvider | null>(null);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showFigmaModal, setShowFigmaModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [designScheme, setDesignScheme] = useState<DesignScheme | undefined>();
  const [enableDesignScheme, setEnableDesignScheme] = useState<boolean>(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [showProjectAdminDialog, setShowProjectAdminDialog] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState<string>("");
  const [selectedProjectAdminId, setSelectedProjectAdminId] =
    useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const {
    hasSupabaseConnected,
    isCheckingToken: isCheckingSupabase,
    supabaseUser,
    handleConnectSupabase,
    handleDisconnectSupabase,
    checkSupabaseToken,
  } = useSupabaseAuth();

  // File handling
  const {
    imageDataList,
    isDragging,
    dragHandlers,
    handleFileSelect,
    handleRemoveFile,
  } = useFileHandling({
    uploadedFiles,
    setUploadedFiles,
  });

  // Fetch user with org admin access info
  const [userWithAccess, setUserWithAccess] = useState<any>(null);
  const [isLoadingUserAccess, setIsLoadingUserAccess] = useState(true);

  useEffect(() => {
    const fetchUserAccess = async () => {
      try {
        const res = await fetch("/api/admin/me", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUserWithAccess(data);
        }
      } catch (error) {
        console.error("Error fetching user access:", error);
      } finally {
        setIsLoadingUserAccess(false);
      }
    };
    if (user) {
      fetchUserAccess();
    }
  }, [user]);

  // Check if user is org_admin, project_admin, or full admin
  const isOrgAdmin =
    userWithAccess?.role === UserRole.ORG_ADMIN ||
    userWithAccess?.hasOrgAdminAccess === true;
  const isProjectAdmin =
    userWithAccess?.role === UserRole.PROJECT_ADMIN ||
    userWithAccess?.hasProjectAdminAccess === true;
  const isFullAdmin = hasAdminAccess(userWithAccess?.role);
  const canAccessAdminPanel = isFullAdmin || isOrgAdmin || isProjectAdmin;

  const WORKSPACE_STORAGE_KEY = "nowgai:selectedWorkspace";

  // Get sidebar context from localStorage (set by AppSidebar)
  const [sidebarContext, setSidebarContext] = useState<"personal" | "organization">(
    // Default value - will be updated by useEffect on client side
    "personal"
  );

  // Initialize context from localStorage on client side - only after user access is loaded
  useEffect(() => {
    if (isLoadingUserAccess) return; // Wait for user access to be loaded

    // Prefer workspace selection if present (ProjectSidebar persists org id here)
    const workspace = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    const workspaceImpliesOrg =
      workspace && workspace !== "personal" ? true : false;

    const saved = localStorage.getItem("web-sidebar-context");
    if (workspaceImpliesOrg) {
      setSidebarContext("organization");
    } else if (saved === "personal" || saved === "organization") {
      setSidebarContext(saved);
    } else {
      // Default to organization for org_admins, personal for others
      setSidebarContext(isOrgAdmin ? "organization" : "personal");
    }
  }, [isOrgAdmin, isLoadingUserAccess]);

  // Listen for context changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "web-sidebar-context") {
        const saved = e.newValue;
        if (saved === "personal" || saved === "organization") {
          setSidebarContext(saved);
        }
      }

      // Also react to workspace selection changes (org id vs "personal")
      if (e.key === WORKSPACE_STORAGE_KEY) {
        const workspace = e.newValue;
        if (workspace && workspace !== "personal") {
          setSelectedOrganizationId(workspace);
          setSidebarContext("organization");
        } else if (workspace === "personal") {
          setSidebarContext("personal");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Also listen for custom events from the same tab (when sidebar changes context)
  useEffect(() => {
    const handleContextChange = (e: CustomEvent) => {
      const newContext = e.detail;
      if (newContext === "personal" || newContext === "organization") {
        setSidebarContext(newContext);
      }
    };

    window.addEventListener("sidebarContextChange", handleContextChange as EventListener);
    return () => window.removeEventListener("sidebarContextChange", handleContextChange as EventListener);
  }, []);

  // Poll localStorage periodically to ensure sync (fallback mechanism)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      const saved = localStorage.getItem("web-sidebar-context");
      if (saved === "personal" || saved === "organization") {
        if (saved !== sidebarContext) {
          setSidebarContext(saved);
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(pollInterval);
  }, [sidebarContext]);


  // Use hooks for org admin data and project creation
  const { organizations, availableUsers, isLoadingUsers } = useOrgAdminData(
    isOrgAdmin,
    selectedOrganizationId
  );
  const { createProject, isCreatingProject } = useProjectCreation();

  // Set default organization when organizations are loaded
  useEffect(() => {
    if (organizations.length === 0) return;

    // Prefer persisted org workspace selection when available
    const workspace = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (workspace && workspace !== "personal") {
      const exists = organizations.some((o) => o.id === workspace);
      if (exists && workspace !== selectedOrganizationId) {
        setSelectedOrganizationId(workspace);
        return;
      }
    }

    if (!selectedOrganizationId) {
      setSelectedOrganizationId(organizations[0].id);
    }
  }, [organizations, selectedOrganizationId]);

  // Check for pending organization invitation after social signup
  useEffect(() => {
    if (user) {
      const pendingInviteToken = localStorage.getItem("pendingInviteToken");
      if (pendingInviteToken) {
        localStorage.removeItem("pendingInviteToken");
        // Redirect to accept invitation page
        window.location.href = `/organizations/user/accept?token=${pendingInviteToken}`;
        return;
      }

      // Check for pending invitations and send emails
      // This runs once when user first loads home page (after signup/verification)
      const checkPendingInvitations = async () => {
        try {
          const response = await fetch(
            "/api/organizations/user/check-pending-invitations",
            {
              method: "POST",
              credentials: "include",
            }
          );
          if (response.ok) {
            const data = await response.json();
            if (data.invitations && data.invitations.length > 0) {
              // Invitations were found and emails sent
              // Show notification to user via console (toast can be added later if needed)
              const orgNames = data.invitations
                .map((inv: any) => inv.organizationName)
                .join(", ");

              console.log(
                `✅ Found ${data.invitations.length} pending invitation(s) from: ${orgNames}. Invitation emails have been sent to your email address.`
              );

              // You can add a toast notification here if you have a toast system set up
              // For now, the emails are sent and user will receive them
            }
          }
        } catch (error) {
          // Ignore errors - not critical
          console.error("Error checking pending invitations:", error);
        }
      };

      // Only check once per session, but also check if URL has verification parameter
      const urlParams = new URLSearchParams(window.location.search);
      const isNewlyVerified =
        urlParams.has("verified") || urlParams.has("email_verified");
      const hasCheckedInvitations = sessionStorage.getItem(
        "checkedPendingInvitations"
      );

      // Check if newly verified or haven't checked yet
      if (isNewlyVerified || !hasCheckedInvitations) {
        checkPendingInvitations();
        sessionStorage.setItem("checkedPendingInvitations", "true");

        // Clean up URL params if present
        if (isNewlyVerified) {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        }
      }
    }
  }, [user]);

  // Fetch user balance
  useEffect(() => {
    let aborted = false;
    const fetchBalance = async () => {
      try {
        const res = await fetch("/api/profile/balance", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (!aborted) {
            setBalance(data.balance);
            setIsWhitelisted(data.isWhitelisted);
          }
        }
      } catch {}
    };
    if (user) {
      fetchBalance();
    }
    return () => {
      aborted = true;
    };
  }, [user]);

  // Preload node_modules cache in background when page loads
  useEffect(() => {
    const timer = setTimeout(() => {
      preloadNodeModulesCache().catch((err) => {
        console.error("[Home] Preload error:", err);
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Handle Supabase OAuth callback redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("supabase_connected") === "true") {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      setTimeout(() => {
        checkSupabaseToken();
      }, 500);
    }
  }, [checkSupabaseToken]);

  // Focus search input when dialog opens
  useEffect(() => {
    if (showSearchDialog) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [showSearchDialog]);

  // Handle Supabase toggle
  const handleSupabaseToggle = (checked: boolean) => {
    if (checked) {
      setShowDatabaseDialog(true);
    } else {
      setUseSupabase(false);
      setSelectedDbProvider(null);
    }
  };

  const handleSelectDbProvider = (provider: DbProvider) => {
    if (provider === "neon") {
      setSelectedDbProvider(provider);
      setUseSupabase(true);
      setShowDatabaseDialog(false);
    } else {
      if (!hasSupabaseConnected) {
        return;
      }
      setSelectedDbProvider(provider);
      setUseSupabase(true);
      setShowDatabaseDialog(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setCurrentPrompt(textarea.value);
    textarea.style.height = "auto";
    const minHeight = 56;
    const maxHeight = 200;
    const contentHeight = Math.max(textarea.scrollHeight, minHeight);
    const newHeight = Math.min(contentHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  };

  const enhancePrompt = async () => {
    if (!currentPrompt.trim() || isEnhancing) return;

    setIsEnhancing(true);

    try {
      const response = await fetch("/api/enhancer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentPrompt,
          model: selectedModel,
          provider: { name: "OpenRouter" },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setCurrentPrompt(data.enhancedPrompt);
    } catch (error) {
      console.error("Error enhancing prompt:", error);
    } finally {
      setIsEnhancing(false);
    }
  };

  const sendPrompt = async () => {
    if (!currentPrompt.trim() || isCreatingConversation) return;

    // Wait for user access to be loaded
    if (isLoadingUserAccess) {
      // Wait a bit and try again
      setTimeout(() => sendPrompt(), 100);
      return;
    }

    // Determine project type based on sidebar context
    const shouldCreateOrgProject = isOrgAdmin && sidebarContext === "organization" && organizations.length > 0;

    // If user is org_admin and in organization context and has organizations, show project admin assignment dialog
    if (shouldCreateOrgProject) {
      setPendingPrompt(currentPrompt);
      setPendingFiles([...uploadedFiles]);
      // Pre-fill project title with a suggestion from the prompt
      const titleSuggestion = currentPrompt
        .split(/[.!?]/)[0]
        .trim()
        .slice(0, 50);
      setProjectTitle(titleSuggestion || "");
      setShowProjectAdminDialog(true);
      return;
    }

    // Create personal conversation for:
    // - Non-org-admin users
    // - Org_admin users in personal context
    // - Org_admin users without organizations
    await createConversation(currentPrompt, uploadedFiles);
  };

  const createConversation = async (prompt: string, files: File[]) => {
    setIsCreatingConversation(true);

    if ((window as any).conversationCreating) return;
    (window as any).conversationCreating = true;

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const clientRequestId =
        (window.crypto && "randomUUID" in window.crypto
          ? (window.crypto as any).randomUUID()
          : Math.random().toString(36).slice(2)) +
        "-" +
        Date.now();

      const uploadedFilesData = await Promise.all(
        files.map(async (file) => {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });

          return {
            name: file.name,
            type: file.type,
            size: file.size,
            base64Data,
          };
        })
      );

      const requestBody = {
        action: "create",
        title: prompt.slice(0, 50),
        model: selectedModel,
        firstMessage: prompt,
        clientRequestId,
        filesMap: {},
        uploadedFiles: uploadedFilesData,
      };

      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const conversationId = data.conversationId;

        // Notify sidebar to refresh conversations
        window.dispatchEvent(new CustomEvent("conversationCreated"));

        if (selectedDbProvider) {
          try {
            const endpoint =
              selectedDbProvider === "neon"
                ? "/api/neon/provision"
                : "/api/supabase/provision";

            const provisionResponse = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId, enable: true }),
            });

            if (!provisionResponse.ok) {
              const errorData = await provisionResponse
                .json()
                .catch(() => ({}));
              console.error(
                `${selectedDbProvider} provision failed:`,
                errorData
              );
              if (selectedDbProvider === "supabase") {
                handleConnectSupabase();
              }
              return;
            }

            await provisionResponse.json();
          } catch (e) {
            console.error(`${selectedDbProvider} provision failed`, e);
            return;
          }
        }

        navigate(`/workspace?conversationId=${conversationId}`, {
          state: {
            initialPrompt: prompt,
            model: selectedModel,
            hasUploadedFiles: files.length > 0,
            designScheme: enableDesignScheme ? designScheme : undefined,
          },
        });
      } else {
        console.error("Failed to create conversation");
        alert("Failed to create conversation. Please try again.");
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      setIsCreatingConversation(false);
      (window as any).conversationCreating = false;
      setUploadedFiles([]);
    }
  };

  const handleCreateProject = async () => {
    if (
      !selectedProjectAdminId ||
      !selectedOrganizationId ||
      !pendingPrompt.trim() ||
      !projectTitle.trim()
    ) {
      alert(
        "Please provide a project title, select a project admin and organization"
      );
      return;
    }

    await createProject({
      organizationId: selectedOrganizationId,
      projectAdminId: selectedProjectAdminId,
      projectTitle: projectTitle.trim(),
      prompt: pendingPrompt,
      model: selectedModel,
      files: pendingFiles,
      selectedDbProvider,
      designScheme: enableDesignScheme ? designScheme : undefined,
      handleConnectSupabase,
    });

    // Reset dialog state after successful creation
    setShowProjectAdminDialog(false);
    setSelectedProjectAdminId("");
    setProjectTitle("");
    setPendingPrompt("");
    setPendingFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      sendPrompt();
    }
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

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleInsertExamplePrompt = (text: string) => {
    setCurrentPrompt(text);
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

  // Example prompts
  const examplePrompts = [
    {
      label: "Landing Page",
      prompt:
        "Create a modern landing page with a large hero, features grid, pricing section, and contact form. Use React + Tailwind. Make it responsive and accessible.",
    },
    {
      label: "Habit Tracker",
      prompt:
        "Make a personal habit tracker where users can set daily or weekly habits, log completions, and view streaks and progress. Include progress bars and motivational messages.",
    },
    {
      label: "Local Landmarks",
      prompt:
        "Build a local landmarks explorer that lists notable places from an API, shows them on a map, and supports search and filtering. Use React, Tailwind, and Leaflet.",
    },
  ] as const;
  const getModelDisplayName = (modelId: string) => {
    const model = OPENROUTER_MODELS.find((m) => m.id === modelId);
    return model ? `${model.name}` : modelId;
  };

  // Get display name and image for avatar
  const displayName = user?.name || user?.email;
  const imageUrl = user?.image;

  return (
    <div className="h-screen w-screen bg-[#0c0c0c] text-white flex overflow-hidden">
      {/* Sidebar */}
      <ProjectSidebar
        user={user}
        onSearchClick={() => setShowSearchDialog(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Gradient Background */}
        <GradientGlow />

        {/* Header - Right side only */}
        <header className="relative z-10 flex items-center justify-end px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Balance Display */}
            {balance !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <CurrencyDollar
                  className="w-4 h-4 text-green-400"
                  weight="bold"
                />
                <span className="text-sm font-medium text-white">
                  ${balance.toFixed(2)}
                </span>
                {isWhitelisted && (
                  <Lightning
                    className="w-3 h-3 text-yellow-400"
                    weight="fill"
                  />
                )}
              </div>
            )}

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center hover:opacity-80 transition-opacity">
                  <HomeAvatar displayName={displayName} imageUrl={imageUrl} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72" align="end">
                <DropdownMenuLabel>
                  <button
                    type="button"
                    onClick={() => navigate("/profile")}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3 cursor-pointer">
                      <HomeAvatar displayName={displayName} imageUrl={imageUrl} size={10} />
                      <div className="min-w-0">
                        <div className="font-semibold truncate text-white">
                          {user?.name || "User"}
                        </div>
                        {user?.email && (
                          <div className="text-white/50 text-sm truncate">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Balance in dropdown */}
                {balance !== null && (
                  <>
                    <div className="px-2 py-3 mx-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-purple-500/20">
                            <CurrencyDollar
                              className="w-4 h-4 text-purple-400"
                              weight="bold"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-white/50">Balance</p>
                            <p className="text-lg font-bold text-purple-400">
                              ${balance.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {!isWhitelisted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate("/recharge")}
                            className="h-8 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-400"
                          >
                            Recharge
                          </Button>
                        )}
                      </div>
                      {isWhitelisted && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-purple-400">
                          <Lightning className="w-3 h-3" weight="fill" />
                          <span>Unlimited Access</span>
                        </div>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}

                {canAccessAdminPanel && (
                  <DropdownMenuItem
                    onClick={() => navigate("/admin")}
                    className="gap-2 cursor-pointer"
                  >
                    <Shield className="w-4 h-4" weight="bold" />
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => navigate("/analytics")}
                  className="gap-2 cursor-pointer"
                >
                  <ChartBar className="w-4 h-4" weight="bold" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/deployments")}
                  className="gap-2 cursor-pointer"
                >
                  <GitBranch className="w-4 h-4" weight="bold" />
                  Deployments
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/supabase-projects")}
                  className="gap-2 cursor-pointer"
                >
                  <Database className="w-4 h-4" weight="bold" />
                  Supabase Projects
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/teams")}
                  className="gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4" weight="bold" />
                  Teams
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/manage-org/convo")}
                  className="gap-2 cursor-pointer"
                >
                  <ChatCircle className="w-4 h-4" weight="bold" />
                  Manage Organization
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  variant="destructive"
                  className="gap-2 cursor-pointer"
                >
                  <SignOut className="w-4 h-4" weight="bold" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Bell */}
            <button className="p-2 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white transition-colors">
              <Bell className="w-5 h-5" weight="bold" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main
          {...dragHandlers}
          className={cn(
            "relative z-10 flex-1 flex flex-col items-center px-6 overflow-y-auto",
            isDragging && "bg-purple-500/5"
          )}
          style={{ paddingTop: "15vh" }}
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
                <Select value={selectedModel} onValueChange={setSelectedModel}>
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
                    checked={selectedDbProvider !== null}
                    onCheckedChange={handleSupabaseToggle}
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

                {/* Color Scheme Toggle */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <Palette className="w-4 h-4 text-pink-400" />
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
                        const event = new CustomEvent("openColorSchemeDialog");
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
            {uploadedFiles.length > 0 && (
              <FilePreview
                files={uploadedFiles}
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
                "relative bg-[#1b1b1b] border rounded-xl overflow-hidden transition-colors",
                isDragging
                  ? "border-purple-500/50 bg-purple-500/5"
                  : "border-[#27272a]"
              )}
              style={{
                boxShadow: "0px 0px 36px 0px rgba(255, 255, 255, 0.1)",
              }}
            >
              <textarea
                ref={textareaRef}
                value={currentPrompt}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={`What shall we build today? (${shortcutLabel} to start)`}
                disabled={isEnhancing}
                rows={3}
                className="w-full bg-transparent text-white placeholder:text-white/30 px-5 py-5 resize-none focus:outline-none text-base min-h-[120px] max-h-[200px]"
                style={{ height: "120px" }}
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
                        <PlusCircle className="w-6 h-6" weight="bold" />
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
                  {/* Enhance Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={enhancePrompt}
                        disabled={!currentPrompt.trim() || isEnhancing}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          currentPrompt.trim() && !isEnhancing
                            ? "hover:bg-purple-500/20 text-purple-400 hover:text-purple-300"
                            : "text-white/20 cursor-not-allowed"
                        )}
                      >
                        {isEnhancing ? (
                          <SpinnerGap
                            className="w-4 h-4 animate-spin"
                            weight="bold"
                          />
                        ) : (
                          <Sparkle className="w-4 h-4" weight="bold" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Enhance prompt with AI</TooltipContent>
                  </Tooltip>

                  {/* Submit Button */}
                  <button
                    onClick={sendPrompt}
                    disabled={
                      !currentPrompt.trim() ||
                      isEnhancing ||
                      isCreatingConversation
                    }
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      currentPrompt.trim() &&
                        !isEnhancing &&
                        !isCreatingConversation
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-white/10 text-white/30 cursor-not-allowed"
                    )}
                  >
                    {isCreatingConversation ? (
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

            {/* Quick Actions Row */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* Examples Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full px-3 bg-white/[0.03] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.06]"
                  >
                    <BookOpen className="w-4 h-4 mr-1.5" weight="bold" />
                    Examples
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[28rem] p-2 bg-[#1a1a1a] border-white/10">
                  <DropdownMenuLabel className="px-1.5 py-1 text-xs text-white/50">
                    Start with an example
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="grid grid-cols-1 gap-2 p-1">
                    {examplePrompts.map((item) => (
                      <DropdownMenuItem
                        key={item.label}
                        onClick={() => handleInsertExamplePrompt(item.prompt)}
                        className="p-0 cursor-pointer focus:bg-transparent"
                      >
                        <div className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] transition-colors p-3">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 rounded-md bg-purple-500/10 text-purple-400 p-1">
                              <BookOpen className="w-3.5 h-3.5" weight="bold" />
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-medium text-sm">
                                {item.label}
                              </div>
                              <div className="text-xs text-white/50 line-clamp-2">
                                {item.prompt}
                              </div>
                            </div>
                            <CaretRight
                              className="w-4 h-4 text-white/30 shrink-0"
                              weight="bold"
                            />
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* AI Helper Links */}
              <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] px-1 py-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full px-3 text-white/50 hover:text-white hover:bg-white/[0.06]"
                      onClick={() => handleOpenProvider("chatgpt")}
                    >
                      <ArrowSquareOut
                        className="w-3.5 h-3.5 mr-1.5"
                        weight="bold"
                      />
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
                      className="h-7 rounded-full px-3 text-white/50 hover:text-white hover:bg-white/[0.06]"
                      onClick={() => handleOpenProvider("gemini")}
                    >
                      <ArrowSquareOut
                        className="w-3.5 h-3.5 mr-1.5"
                        weight="bold"
                      />
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
                      className="h-7 rounded-full px-3 text-white/50 hover:text-white hover:bg-white/[0.06]"
                      onClick={() => handleOpenProvider("perplexity")}
                    >
                      <ArrowSquareOut
                        className="w-3.5 h-3.5 mr-1.5"
                        weight="bold"
                      />
                      Perplexity
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Open Perplexity (helper prompt copied)
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Search Dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="max-w-2xl p-0 bg-[#1a1a1a] border-white/10">
          <DialogHeader className="p-4 border-b border-white/10">
            <DialogTitle className="text-sm text-white">
              Search Projects
            </DialogTitle>
          </DialogHeader>
          <div className="p-3">
            <Input
              ref={searchInputRef}
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <div className="border-t border-white/10">
            <ScrollArea className="max-h-80">
              <div className="p-2">
                <div className="text-xs text-white/40 px-2 py-6 text-center">
                  Type to search across your projects
                </div>
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <GitHubImportModal
        isOpen={showGitHubModal}
        onClose={() => setShowGitHubModal(false)}
        selectedModel={selectedModel}
      />

      <FigmaImportModal
        isOpen={showFigmaModal}
        onClose={() => setShowFigmaModal(false)}
        selectedModel={selectedModel}
      />

      <ColorSchemeDialog
        designScheme={designScheme}
        setDesignScheme={setDesignScheme}
        showButton={false}
      />

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
        isProvisioningNeon={false}
        isNeonAvailable={true}
      />

      {/* Project Admin Assignment Dialog for org_admin */}
      <ProjectAdminDialog
        open={showProjectAdminDialog}
        onOpenChange={(open) => {
          setShowProjectAdminDialog(open);
          if (!open) {
            // Reset state when dialog closes
            setSelectedProjectAdminId("");
            setProjectTitle("");
            setPendingPrompt("");
            setPendingFiles([]);
          }
        }}
        organizations={organizations}
        availableUsers={availableUsers}
        isLoadingUsers={isLoadingUsers}
        selectedOrganizationId={selectedOrganizationId}
        selectedProjectAdminId={selectedProjectAdminId}
        projectTitle={projectTitle}
        onOrganizationChange={setSelectedOrganizationId}
        onProjectAdminChange={setSelectedProjectAdminId}
        onProjectTitleChange={setProjectTitle}
        onCreateProject={handleCreateProject}
        isCreating={isCreatingProject}
      />
    </div>
  );
}
