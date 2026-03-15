import {
  ArrowsClockwise,
  ArrowsOutSimple,
  ArrowSquareOut,
  CaretDown,
  ChartBar,
  ChatCircle,
  CircleNotch,
  CloudArrowUp,
  Code,
  CurrencyDollar,
  Database,
  DeviceMobile,
  GitBranch,
  GithubLogo,
  Globe,
  Lightning,
  Shield,
  SignOut,
  User as UserIcon,
  Users,
} from "@phosphor-icons/react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { UserRole, hasAdminAccess } from "@nowgai/shared/types";
import { useGitHubAuth } from "~/hooks/useGitHubAuth";
import { useGitHubRepository } from "~/hooks/useGitHubRepository";
import { authClient } from "../lib/authClient";
import { cn } from "../lib/utils";
import { useIsSyncingToR2 } from "../stores/useWorkspaceStore";
import { UnifiedDeploymentDialog, useDeployDialog } from "./DeployDialog";
import { GitHubDeleteDialog } from "./github/GitHubDeleteDialog";
import { GitHubRepositoryDialog } from "./github/GitHubRepositoryDialog";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { VersionSelector } from "./VersionSelector";
import { NotificationBell } from "./NotificationBell";

// Vercel Logo SVG
const VercelIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 76 65" fill="currentColor">
    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
  </svg>
);

// Supabase Logo SVG
const SupabaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 109 113" fill="none">
    <path
      d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
      fill="url(#paint0_linear)"
    />
    <path
      d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
      fill="url(#paint1_linear)"
      fillOpacity="0.2"
    />
    <path
      d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.04068L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z"
      fill="#3ECF8E"
    />
    <defs>
      <linearGradient
        id="paint0_linear"
        x1="53.9738"
        y1="54.974"
        x2="94.1635"
        y2="71.8295"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#249361" />
        <stop offset="1" stopColor="#3ECF8E" />
      </linearGradient>
      <linearGradient
        id="paint1_linear"
        x1="36.1558"
        y1="30.578"
        x2="54.4844"
        y2="65.0806"
        gradientUnits="userSpaceOnUse"
      >
        <stop />
        <stop offset="1" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

type TabType = "files" | "preview";

interface FileItem {
  name: string;
  path: string;
  content: string;
}

interface WorkspaceRightHeaderProps {
  conversationId?: string;
  messageCount?: number;
  versions?: Array<{ id: string; label: string }>;
  currentVersionId?: string | null;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  previewUrl?: string | null;
  onVersionSelect?: (versionId: string) => void;
  onAgentClick?: () => void;
  /** Revert to a specific version - makes it the new latest */
  onRevertToVersion?: (versionId: string) => void;
  /** Go back to the latest version */
  onGoToLatest?: () => void;
  /** Whether restoring a version */
  isRestoringVersion?: boolean;
}

export function WorkspaceRightHeader({
  conversationId,
  messageCount = 0,
  versions = [],
  currentVersionId,
  activeTab,
  onTabChange,
  previewUrl,
  onVersionSelect,
  onAgentClick,
  onRevertToVersion,
  onGoToLatest,
  isRestoringVersion = false,
}: WorkspaceRightHeaderProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<any | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [showGitHubDeleteDialog, setShowGitHubDeleteDialog] = useState(false);
  const [isGitHubDeleting, setIsGitHubDeleting] = useState(false);

  // R2 sync status
  const isSyncingToR2 = useIsSyncingToR2();

  // GitHub hooks
  const {
    isCheckingToken: isCheckingGitHubToken,
    hasGitHubConnected,
    githubToken,
    setGithubToken,
    checkGitHubToken,
    handleConnectGitHub,
  } = useGitHubAuth();

  const {
    repositoryStatus,
    isLoading: isGitHubLoading,
    error: gitHubError,
    success: gitHubSuccess,
    commitInfo,
    createRepository,
    syncRepository,
    deleteRepository,
    checkRepositoryStatus: recheckGitHubStatus,
    clearMessages: clearGitHubMessages,
  } = useGitHubRepository(conversationId, messageCount);

  const {
    isDeploying,
    showDialog,
    setShowDialog,
    deployLog,
    deployUrl,
    deployStage,
    deployProgress,
    copiedToClipboard,
    currentDeployment,
    startDeploy,
    deployVersion,
    copyToClipboard,
    refreshDeployment,
  } = useDeployDialog(
    conversationId,
    messageCount,
    currentVersionId,
    versions.length,
  );

  const [userWithAccess, setUserWithAccess] = useState<any | null>(null);

  // Fetch user session
  useEffect(() => {
    let aborted = false;
    const fetchSession = async () => {
      try {
        let session: any = null;
        try {
          session = await (authClient as any).getSession?.();
        } catch {}

        if (!session) {
          const res = await fetch("/api/auth/session", {
            credentials: "include",
          });
          if (res.ok) session = await res.json();
        }

        let maybeUser = session?.user || session?.data?.user || null;

        if (maybeUser) {
          try {
            const userRes = await fetch("/api/auth/user", {
              credentials: "include",
            });
            if (userRes.ok) {
              const userJson: any = await userRes.json();
              const richer = userJson?.user || userJson?.data?.user || userJson;
              if (richer) maybeUser = { ...maybeUser, ...richer };
            }
          } catch {}
        }

        if (!aborted) setUser(maybeUser);
      } catch {}
    };
    fetchSession();
    return () => {
      aborted = true;
    };
  }, []);

  // Fetch user with admin access info
  useEffect(() => {
    let aborted = false;
    const fetchUserAccess = async () => {
      try {
        const res = await fetch("/api/admin/me", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (!aborted) setUserWithAccess(data);
        }
      } catch (error) {
        console.error("Error fetching user access:", error);
      }
    };
    if (user) {
      fetchUserAccess();
    }
    return () => {
      aborted = true;
    };
  }, [user]);

  // Fetch balance
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
    if (user) fetchBalance();
    return () => {
      aborted = true;
    };
  }, [user]);

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleDeploy = (
    provider: "vercel" | "netlify",
    updateExisting = false,
    versionId?: string,
  ) => {
    // Commented out Vercel deployment logic as per user request
    if (provider === "vercel") {
      window.open("https://vercel.com/new", "_blank");
      return;
    }

    if (versionId) {
      deployVersion(versionId, provider);
    } else {
      startDeploy(provider, updateExisting);
    }
  };

  // GitHub handlers
  const handleOpenGitHubDialog = () => {
    if (conversationId) {
      recheckGitHubStatus();
      checkGitHubToken();
      clearGitHubMessages();
    }
    setShowGitHubDialog(true);
  };

  const handleCreateRepository = async (
    repoName: string,
    description: string,
    isPrivate: boolean,
  ) => {
    const result = await createRepository(
      repoName,
      description,
      isPrivate,
      githubToken,
    );
    if (result) {
      setGithubToken("");
    }
  };

  const handleSyncChanges = async () => {
    const result = await syncRepository(githubToken);
    if (result) {
      setGithubToken("");
    }
  };

  const handleGitHubDelete = async (deleteFromGitHub: boolean) => {
    setIsGitHubDeleting(true);
    const result = await deleteRepository(githubToken, deleteFromGitHub);
    setIsGitHubDeleting(false);

    if (result) {
      setShowGitHubDeleteDialog(false);
      setShowGitHubDialog(false);
    }
  };

  const handleConnectGitHubWrapper = async () => {
    try {
      await handleConnectGitHub();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleCloseGitHubDialog = () => {
    setShowGitHubDialog(false);
    clearGitHubMessages();
  };

  const hasRepository = repositoryStatus?.hasRepository || false;
  const isSynced = repositoryStatus?.isSynced !== false;

  const userInitials = (nameOrEmail?: string) => {
    if (!nameOrEmail) return "?";
    const parts = nameOrEmail
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 1) {
      const handle = nameOrEmail.includes("@")
        ? nameOrEmail.split("@")[0]
        : nameOrEmail;
      return handle.slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const Avatar = ({ size = 8 }: { size?: number }) => {
    const sizeClass = size === 10 ? "w-10 h-10" : "w-8 h-8";
    const displayName = user?.name || user?.email;
    const [broken, setBroken] = useState(false);
    const imageUrl =
      user?.image ||
      user?.picture ||
      user?.avatar ||
      user?.avatarUrl ||
      user?.photoURL;

    if (imageUrl && !broken) {
      return (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setBroken(true)}
          className={`${sizeClass} rounded-full object-cover border border-border/60`}
        />
      );
    }
    const initials = displayName ? userInitials(displayName) : "";
    return (
      <div
        className={`flex items-center justify-center ${sizeClass} rounded-full bg-primary/20 text-primary font-semibold`}
      >
        {initials || <UserIcon className="w-4 h-4 text-primary" />}
      </div>
    );
  };

  const formatUrl = (url: string | null | undefined) => {
    if (!url) return "Loading...";
    try {
      const parsed = new URL(url);
      const full = parsed.origin + parsed.pathname;
      if (full.length > 45) {
        // Show start and truncate end with ...
        return full.slice(0, 42) + "...";
      }
      return full;
    } catch {
      if (url.length > 45) {
        return url.slice(0, 42) + "...";
      }
      return url;
    }
  };

  return (
    <>
      <div className="h-12 shrink-0 flex items-center justify-between bg-transparent relative mb-1">
        {/* Left: Tabs & Version */}
        <div className="flex items-center gap-2">
          {/* Preview/Editor Tabs - border and text color when active */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#1a1a1a]/80 border border-white/[0.08]">
            <button
              onClick={() => onTabChange("preview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all border",
                activeTab === "preview"
                  ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[#1a1a1a]/80"
                  : "border-transparent text-white/60 hover:text-white",
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              onClick={() => onTabChange("files")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border",
                activeTab === "files"
                  ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[#1a1a1a]/80"
                  : "border-transparent text-white/60 hover:text-white",
              )}
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Version Selector */}
          {versions.length > 0 && onVersionSelect && (
            <VersionSelector
              versions={versions}
              currentVersionId={currentVersionId}
              onSelect={onVersionSelect}
              onRevertToVersion={onRevertToVersion}
              onGoToLatest={onGoToLatest}
              isRestoring={isRestoringVersion}
            />
          )}
        </div>

        {/* Center: URL Bar - matching screenshot */}
        <div className="flex-1 flex justify-center px-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1a1a]/80 border border-white/[0.08] max-w-[420px] w-full">
            <span className="flex-1 text-xs text-white/50 font-mono truncate">
              {formatUrl(previewUrl)}
            </span>
            <div className="flex items-center gap-0.5 shrink-0 border-l border-white/[0.08] pl-2 ml-1">
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("preview-control", {
                      detail: { action: "refresh" },
                    }),
                  )
                }
                className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
                title="Refresh"
              >
                <ArrowsClockwise className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("preview-control", {
                      detail: { action: "toggleDeviceMode" },
                    }),
                  )
                }
                className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
                title="Mobile view"
              >
                <DeviceMobile className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("preview-control", {
                      detail: { action: "toggleFullscreen" },
                    }),
                  )
                }
                className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
                title="Fullscreen"
              >
                <ArrowsOutSimple className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Deploy, Share, Avatar */}
        <div className="flex items-center gap-2">
          {/* R2 Sync Indicator - shows when syncing files to cloud */}
          {isSyncingToR2 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 animate-pulse">
              <CloudArrowUp className="w-4 h-4 text-violet-400" weight="bold" />
              <span className="text-xs text-violet-300 font-medium">
                Syncing to cloud...
              </span>
              <CircleNotch className="w-3.5 h-3.5 text-violet-400 animate-spin" />
            </div>
          )}

          {/* Deploy Button - purple with dropdown arrow */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-8 gap-1.5 px-4 rounded-lg text-xs font-medium text-white bg-[#8b5cf6] hover:bg-[#7c4deb] border-0"
                disabled={
                  !!isDeploying || versions.length === 0 || isSyncingToR2
                }
              >
                Deploy
                <CaretDown className="w-3 h-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-[#1a1a1a] border-white/[0.1]"
            >
              {currentDeployment ? (
                <DropdownMenuItem
                  onClick={async () => {
                    await refreshDeployment(true);
                    setShowDialog(true);
                  }}
                  className="gap-2 cursor-pointer"
                >
                  <ArrowSquareOut className="w-4 h-4" />
                  View Deployment
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    onClick={() => window.open("https://vercel.com/new", "_blank")}
                    className="gap-2 cursor-pointer"
                  >
                    <VercelIcon className="w-3.5 h-3.5" />
                    Deploy to Vercel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/supabase-projects")}
                    className="gap-2 cursor-pointer"
                  >
                    <SupabaseIcon className="w-4 h-4" />
                    Deploy to Supabase
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem
                onClick={handleOpenGitHubDialog}
                className="gap-2 cursor-pointer"
                disabled={!conversationId}
              >
                <GithubLogo className="w-4 h-4" />
                {hasRepository
                  ? isSynced
                    ? "Repository Synced"
                    : "Sync Changes"
                  : "Create Repository"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>


          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full hover:ring-2 hover:ring-white/20 transition-all">
                <Avatar size={8} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-64 bg-[#1a1a1a] border-white/[0.1]"
              align="end"
            >
              <DropdownMenuLabel>
                <button
                  onClick={() => navigate("/profile")}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-3 cursor-pointer">
                    <Avatar size={10} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
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
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              {balance !== null && (
                <>
                  <div className="px-2 py-2 mx-2 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CurrencyDollar className="w-4 h-4 text-[#8b5cf6]" />
                        <div>
                          <p className="text-xs text-white/50">Balance</p>
                          <p className="text-sm font-bold text-[#8b5cf6]">
                            ${balance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {!isWhitelisted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate("/recharge")}
                          className="h-7 text-xs bg-[#8b5cf6]/20 hover:bg-[#8b5cf6]/30 text-[#8b5cf6]"
                        >
                          Recharge
                        </Button>
                      )}
                    </div>
                    {isWhitelisted && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-[#8b5cf6]">
                        <Lightning className="w-3 h-3" />
                        <span>Unlimited Access</span>
                      </div>
                    )}
                  </div>
                  <DropdownMenuSeparator className="bg-white/[0.08]" />
                </>
              )}
              <DropdownMenuItem
                onClick={() => navigate("/profile")}
                className="gap-2 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/analytics")}
                className="gap-2 cursor-pointer"
              >
                <ChartBar className="w-4 h-4" />
                Analytics
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/deployments")}
                className="gap-2 cursor-pointer"
              >
                <GitBranch className="w-4 h-4" />
                Deployments
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/teams")}
                className="gap-2 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Teams
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/manage-org/convo")}
                className="gap-2 cursor-pointer"
              >
                <ChatCircle className="w-4 h-4" />
                Manage Organization
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/supabase-projects")}
                className="gap-2 cursor-pointer"
              >
                <Database className="w-4 h-4" />
                Supabase Projects
              </DropdownMenuItem>
              {user &&
                (() => {
                  const userRole = userWithAccess?.role || user?.role;
                  const hasOrgAdminAccess =
                    userWithAccess?.hasOrgAdminAccess ||
                    user?.hasOrgAdminAccess ||
                    false;
                  const hasProjectAdminAccess =
                    userWithAccess?.hasProjectAdminAccess ||
                    user?.hasProjectAdminAccess ||
                    false;
                  const isOrgAdmin =
                    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess;
                  const isProjectAdmin =
                    userRole === UserRole.PROJECT_ADMIN ||
                    hasProjectAdminAccess;
                  const isFullAdmin = hasAdminAccess(userRole);

                  if (isFullAdmin || isOrgAdmin || isProjectAdmin) {
                    return (
                      <DropdownMenuItem
                        onClick={() => navigate("/admin")}
                        className="gap-2 cursor-pointer"
                      >
                        <Shield className="w-4 h-4" />
                        Admin Panel
                      </DropdownMenuItem>
                    );
                  }
                  return null;
                })()}
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem
                onClick={handleSignOut}
                variant="destructive"
                className="gap-2 cursor-pointer"
              >
                <SignOut className="w-4 h-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification Bell */}
          <NotificationBell
            iconSize="w-4 h-4"
            buttonClassName="p-2 rounded-full hover:bg-white/[0.08] transition-colors text-white/50 hover:text-white"
          />
        </div>
      </div>

      {/* Deploy Dialog */}
      <UnifiedDeploymentDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        isDeploying={isDeploying}
        deployLog={deployLog}
        deployUrl={deployUrl}
        deployStage={deployStage}
        deployProgress={deployProgress}
        copiedToClipboard={copiedToClipboard}
        onCopyToClipboard={copyToClipboard}
        currentDeployment={currentDeployment}
        onCreateNewDeployment={handleDeploy}
        currentVersionId={currentVersionId}
      />

      {/* GitHub Repository Dialog */}
      <GitHubRepositoryDialog
        open={showGitHubDialog}
        onOpenChange={setShowGitHubDialog}
        hasRepository={hasRepository}
        repositoryStatus={repositoryStatus}
        hasGitHubConnected={hasGitHubConnected}
        isCheckingToken={isCheckingGitHubToken}
        githubToken={githubToken}
        setGithubToken={setGithubToken}
        isLoading={isGitHubLoading}
        error={gitHubError}
        success={gitHubSuccess}
        commitInfo={commitInfo}
        onConnectGitHub={handleConnectGitHubWrapper}
        onCreateRepository={handleCreateRepository}
        onSyncChanges={handleSyncChanges}
        onDeleteClick={() => setShowGitHubDeleteDialog(true)}
        onClose={handleCloseGitHubDialog}
      />

      {/* GitHub Delete Dialog */}
      <GitHubDeleteDialog
        open={showGitHubDeleteDialog}
        onOpenChange={setShowGitHubDeleteDialog}
        onDelete={handleGitHubDelete}
        isDeleting={isGitHubDeleting}
        error={gitHubError}
      />
    </>
  );
}
