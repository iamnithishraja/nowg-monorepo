import {
  Bell,
  Buildings,
  Cardholder,
  CaretDown,
  CaretRight,
  ChatTeardropDots,
  Compass,
  Cube,
  DotsThreeOutline,
  House,
  KanbanIcon,
  MagnifyingGlass,
  PencilSimple,
  SidebarSimple,
  SpinnerGap,
  Star,
  Trash,
  User,
  Warning,
} from "@phosphor-icons/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import crop from "~/assets/crop.png";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";

interface Project {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  type: "personal" | "organization";
  organizationId?: string;
  organizationName?: string;
  starred?: boolean;
}

interface Organization {
  id: string;
  name: string;
  role?: string;
}

const WORKSPACE_STORAGE_KEY = "nowgai:selectedWorkspace";
const SIDEBAR_CONTEXT_STORAGE_KEY = "web-sidebar-context";

// User avatar component - extracted and memoized
interface UserAvatarProps {
  displayName?: string;
  imageUrl?: string;
}

const UserAvatar = memo(function UserAvatar({
  displayName,
  imageUrl,
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);

  if (imageUrl && !broken) {
    return (
      <img
        src={imageUrl}
        alt=""
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setBroken(true)}
        className="w-8 h-8 rounded-full object-cover border border-white/10"
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
    <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
      {initials}
    </div>
  );
});

interface ProjectSidebarProps {
  className?: string;
  user?: {
    name?: string;
    email?: string;
    image?: string;
  } | null;
  onSearchClick?: () => void;
}

function ProjectSidebarComponent({
  className,
  user,
  onSearchClick,
}: ProjectSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isWorkspace = location.pathname === "/workspace";
  // Collapse sidebar by default on workspace pages to maximize editing space.
  // Keep it expanded on the home/dashboard so users can browse projects easily.
  const [isCollapsed, setIsCollapsed] = useState(() => isWorkspace);
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<
    "personal" | string
  >("personal");
  const [hasLoadedWorkspaceFromStorage, setHasLoadedWorkspaceFromStorage] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recentProjectsExpanded, setRecentProjectsExpanded] = useState(true);
  const [projectView, setProjectView] = useState<"recent" | "all" | "starred">(
    "recent"
  );
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Edit/Delete state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentProjectId = useMemo(
    () => new URLSearchParams(location.search).get("conversationId"),
    [location.search]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside dropdown content and trigger
      if (
        openDropdownId &&
        !target.closest('[data-slot="dropdown-menu-content"]') &&
        !target.closest('[data-slot="dropdown-menu-trigger"]')
      ) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openDropdownId]);

  // Listen for toggle event from workspace header
  useEffect(() => {
    const handleToggle = () => {
      setIsCollapsed((prev) => !prev);
    };
    window.addEventListener("toggleProjectSidebar", handleToggle);
    return () =>
      window.removeEventListener("toggleProjectSidebar", handleToggle);
  }, []);

  // Load persisted workspace selection
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (stored) {
        setSelectedWorkspace(stored);
      }
    } catch (err) {
      console.error("Error reading workspace from localStorage:", err);
    }
    setHasLoadedWorkspaceFromStorage(true);
  }, []);

  // Persist workspace selection
  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedWorkspaceFromStorage) return;
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, selectedWorkspace);
    } catch (err) {
      console.error("Error saving workspace to localStorage:", err);
    }
  }, [selectedWorkspace, hasLoadedWorkspaceFromStorage]);

  // Keep chat creation context in sync with selected workspace (home.tsx uses this)
  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedWorkspaceFromStorage) return;

    const nextContext: "personal" | "organization" =
      selectedWorkspace === "personal" ? "personal" : "organization";

    try {
      window.localStorage.setItem(SIDEBAR_CONTEXT_STORAGE_KEY, nextContext);
    } catch (err) {
      console.error("Error saving sidebar context to localStorage:", err);
    }

    // Notify listeners in the same tab (home.tsx listens for this)
    window.dispatchEvent(
      new CustomEvent("sidebarContextChange", { detail: nextContext })
    );
  }, [selectedWorkspace, hasLoadedWorkspaceFromStorage]);

  // Fetch projects and organizations
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch personal conversations
        const convResponse = await fetch("/api/conversations");
        const convData = convResponse.ok
          ? await convResponse.json()
          : { conversations: [] };

        // Fetch organization conversations
        let orgConversations: Project[] = [];
        let orgs: Organization[] = [];
        try {
          const orgResponse = await fetch("/api/organization-conversations", {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            credentials: "include",
          });
          if (orgResponse.ok) {
            const orgData = await orgResponse.json();
            orgConversations = (orgData.conversations || []).map(
              (conv: any) => ({
                id: conv.id,
                title: conv.title,
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt,
                type: "organization" as const,
                organizationId: conv.organization?.id || null,
                organizationName: conv.organization?.name || null,
                starred: conv.starred || false,
              })
            );
            orgs = orgData.organizations || [];
          }
        } catch {}

        // Map personal conversations
        const personalProjects: Project[] = (convData.conversations || [])
          .filter((c: any) => !c.organizationId && !c.teamId)
          .map((conv: any) => ({
            id: conv.id,
            title: conv.title,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt || conv.lastMessageAt,
            type: "personal" as const,
            starred: conv.starred || false,
          }));

        setProjects([...personalProjects, ...orgConversations]);
        setOrganizations(orgs);
      } catch (err) {
        console.error("Error fetching projects:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter projects based on selected workspace - MEMOIZED
  const filteredProjects = useMemo(
    () =>
      projects.filter((p) => {
        if (selectedWorkspace === "personal") {
          return p.type === "personal";
        }
        return (
          p.type === "organization" && p.organizationId === selectedWorkspace
        );
      }),
    [projects, selectedWorkspace]
  );

  // Helper to check if project is starred
  const isProjectStarred = useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      return project?.starred || false;
    },
    [projects]
  );

  // Get recent projects (last 5) - MEMOIZED (for display in recent section)
  const recentProjects = useMemo(
    () =>
      [...filteredProjects]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .slice(0, 5),
    [filteredProjects]
  );

  // Get projects based on view - MEMOIZED
  const displayedProjects = useMemo(() => {
    let projectsToShow = [...filteredProjects];

    if (projectView === "starred") {
      projectsToShow = projectsToShow.filter((p) => p.starred === true);
    } else if (projectView === "all") {
      // Show ALL projects sorted by date
      projectsToShow = projectsToShow.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    return projectsToShow;
  }, [filteredProjects, projectView]);

  // Format date for display - MEMOIZED
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  // Get workspace display name - MEMOIZED
  const getWorkspaceName = useCallback(() => {
    if (selectedWorkspace === "personal") return "Personal Projects";
    const org = organizations.find((o) => o.id === selectedWorkspace);
    return org?.name || "Organization";
  }, [selectedWorkspace, organizations]);

  // Handle project rename - MEMOIZED
  const handleRename = useCallback(async (projectId: string, title: string) => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateTitle",
          conversationId: projectId,
          title,
        }),
      });
      if (response.ok) {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, title } : p))
        );
        setEditingProject(null);
        setNewTitle("");
      }
    } catch (err) {
      console.error("Error renaming project:", err);
    }
  }, []);

  // Handle project delete - MEMOIZED
  const handleDelete = useCallback(
    async (projectId: string) => {
      setIsDeleting(true);
      try {
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", conversationId: projectId }),
        });
        if (response.ok) {
          setProjects((prev) => prev.filter((p) => p.id !== projectId));
          setDeleteDialogOpen(false);
          setProjectToDelete(null);
          if (projectId === currentProjectId) {
            navigate("/home");
          }
        }
      } catch (err) {
        console.error("Error deleting project:", err);
      } finally {
        setIsDeleting(false);
      }
    },
    [currentProjectId, navigate]
  );

  // Handle star/unstar project - MEMOIZED
  const handleStarToggle = useCallback(async (projectId: string) => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggleStar",
          conversationId: projectId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle star");
      }

      const data = await response.json();

      // Update local state
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, starred: data.starred } : p
        )
      );
    } catch (err) {
      console.error("Error toggling star:", err);
    }
  }, []);

  // Memoize user avatar props
  const avatarProps = useMemo(
    () => ({
      displayName: user?.name || user?.email,
      imageUrl: user?.image,
    }),
    [user?.name, user?.email, user?.image]
  );

  return (
    <>
      <aside
        className={cn(
          "flex flex-col h-full bg-surface-1 border-r border-subtle transition-all duration-300 relative",
          isWorkspace && isCollapsed
            ? "w-0 overflow-hidden border-r-0"
            : isCollapsed
              ? "w-16 overflow-hidden"
              : "w-60 overflow-hidden",
          className
        )}
      >
        {/* Sidebar glow effect - bottom left */}
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: "-80px",
            left: "-100px",
            width: "350px",
            height: "280px",
            borderRadius: "50%",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(139, 92, 246, 0.25) 0%, rgba(123, 76, 255, 0.15) 40%, transparent 70%)",
            filter: "blur(50px)",
          }}
        />
        {/* Header */}
        <div
          className={cn(
            "flex items-center py-4",
            isCollapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          {!isWorkspace && !isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src={crop}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-white font-semibold text-sm tracking-tight">
                NowgAI
              </span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-md hover:bg-white/5 text-white/50 hover:text-white transition-colors shrink-0"
          >
            <SidebarSimple className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Selector */}
        {!isCollapsed && (
          <div className="px-3 mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                    {selectedWorkspace === "personal"
                      ? "P"
                      : getWorkspaceName().charAt(0)}
                  </div>
                  <span className="flex-1 text-left text-white text-sm font-medium truncate">
                    {getWorkspaceName()}
                  </span>
                  <CaretDown className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 bg-[#1a1a1a] border-white/10"
              >
                <DropdownMenuItem
                  onClick={() => setSelectedWorkspace("personal")}
                  className="gap-2 cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  Personal Projects
                </DropdownMenuItem>
                {organizations.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    {organizations.map((org) => (
                      <DropdownMenuItem
                        key={org.id}
                        onClick={() => setSelectedWorkspace(org.id)}
                        className="gap-2 cursor-pointer"
                      >
                        <Buildings className="w-4 h-4" />
                        {org.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1 min-h-0 px-3 space-y-1">
          {/* Primary Navigation */}
          <Link
            to="/home"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/home"
                ? "bg-white/[0.08] text-white"
                : "text-white/60 hover:text-white hover:bg-white/[0.04]"
            )}
            onClick={() => setOpenDropdownId(null)}
          >
            <House className="w-4 h-4" />
            {!isCollapsed && "Home"}
          </Link>

          <button
            onClick={() => {
              setOpenDropdownId(null);
              onSearchClick?.();
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              "text-white/60 hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <MagnifyingGlass className="w-4 h-4" />
            {!isCollapsed && "Search"}
          </button>

          {/* Projects Section */}
          {!isCollapsed && (
            <>
              <div className="pt-4 pb-2">
                <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Projects
                </span>
              </div>

              <button
                onClick={() => {
                  setOpenDropdownId(null);
                  // Toggle: if already "all", go back to "recent", otherwise set to "all"
                  setProjectView(projectView === "all" ? "recent" : "all");
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  projectView === "all"
                    ? "bg-white/[0.08] text-white"
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                )}
              >
                <Cardholder className="w-4 h-4" />
                All Projects
              </button>

              <button
                onClick={() => {
                  setOpenDropdownId(null);
                  // Toggle: if already "starred", go back to "recent", otherwise set to "starred"
                  setProjectView(
                    projectView === "starred" ? "recent" : "starred"
                  );
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  projectView === "starred"
                    ? "bg-white/[0.08] text-white"
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                )}
              >
                <Star
                  className={cn(
                    "w-4 h-4",
                    projectView === "starred" && "fill-current"
                  )}
                />
                Starred
              </button>

              {/* Recent Projects - Only show when not viewing All or Starred */}
              {projectView === "recent" && (
                <div className="pt-4">
                  <button
                    onClick={() => {
                      setOpenDropdownId(null);
                      setRecentProjectsExpanded(!recentProjectsExpanded);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/30 hover:text-white/50 transition-colors"
                  >
                    {recentProjectsExpanded ? (
                      <CaretDown className="w-5 h-5" />
                    ) : (
                      <CaretRight className="w-5 h-5" />
                    )}
                    Recent Projects
                  </button>

                  {recentProjectsExpanded && (
                    <div className="mt-1 space-y-0.5">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <SpinnerGap className="w-4 h-4 animate-spin text-white/30" />
                        </div>
                      ) : recentProjects.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-white/30">
                          No projects yet
                        </p>
                      ) : (
                        recentProjects.map((project) => (
                          <div
                            key={project.id}
                            className="group relative max-w-54"
                          >
                            <Link
                              to={`/workspace?conversationId=${project.id}`}
                              className={cn(
                                "flex items-center gap-3 pl-6 pr-10 py-2 rounded-lg text-sm transition-colors w-full",
                                currentProjectId === project.id
                                  ? "bg-purple-500/10 text-white border-l-2 border-purple-500 ml-1"
                                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                              )}
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <ChatTeardropDots className="w-5 h-5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="truncate font-medium text-sm block">
                                    {project.title || "Untitled Project"}
                                  </span>
                                  {project.starred && (
                                    <Star className="w-3 h-3 fill-current text-yellow-400 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[10px] text-white/30 truncate">
                                  {formatDate(project.updatedAt)}
                                </div>
                              </div>
                            </Link>

                            {/* Actions Menu */}
                            <DropdownMenu
                              open={openDropdownId === project.id}
                              onOpenChange={(open) =>
                                setOpenDropdownId(open ? project.id : null)
                              }
                            >
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all z-10"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  <DotsThreeOutline className="w-4 h-4 text-white/60 hover:text-white" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-40 bg-[#1a1a1a] border-white/10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStarToggle(project.id);
                                    setOpenDropdownId(null);
                                  }}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Star
                                    className={cn(
                                      "w-5 h-5",
                                      project.starred && "fill-current"
                                    )}
                                  />
                                  {project.starred ? "Unstar" : "Star"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectToDelete(project);
                                    setDeleteDialogOpen(true);
                                    setOpenDropdownId(null);
                                  }}
                                  className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
                                >
                                  <Trash className="w-5 h-5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* All Projects - Show when selected */}
              {projectView === "all" && (
                <div className="pt-4">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">
                    All Projects
                  </div>
                  <div className="space-y-0.5">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <SpinnerGap className="w-4 h-4 animate-spin text-white/30" />
                      </div>
                    ) : displayedProjects.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-white/30">
                        No projects yet
                      </p>
                    ) : (
                      displayedProjects.map((project) => (
                        <div
                          key={project.id}
                          className="group relative max-w-54"
                        >
                          <Link
                            to={`/workspace?conversationId=${project.id}`}
                            className={cn(
                              "flex items-center gap-3 pl-6 pr-10 py-2 rounded-lg text-sm transition-colors w-full",
                              currentProjectId === project.id
                                ? "bg-purple-500/10 text-white border-l-2 border-purple-500 ml-1"
                                : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                            )}
                            onClick={() => setOpenDropdownId(null)}
                          >
                            <ChatTeardropDots className="w-5 h-5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate font-medium text-sm block">
                                  {project.title || "Untitled Project"}
                                </span>
                                {project.starred && (
                                  <Star className="w-3 h-3 fill-current text-yellow-400 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] text-white/30 truncate">
                                {formatDate(project.updatedAt)}
                              </div>
                            </div>
                          </Link>

                          {/* Actions Menu */}
                          <DropdownMenu
                            open={openDropdownId === project.id}
                            onOpenChange={(open) =>
                              setOpenDropdownId(open ? project.id : null)
                            }
                          >
                            <DropdownMenuTrigger asChild>
                              <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all z-10"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                <DotsThreeOutline className="w-4 h-4 text-white/60 hover:text-white" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-40 bg-[#1a1a1a] border-white/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarToggle(project.id);
                                  setOpenDropdownId(null);
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <Star
                                  className={cn(
                                    "w-5 h-5",
                                    project.starred && "fill-current"
                                  )}
                                />
                                {project.starred ? "Unstar" : "Star"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectToDelete(project);
                                  setDeleteDialogOpen(true);
                                  setOpenDropdownId(null);
                                }}
                                className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
                              >
                                <Trash className="w-5 h-5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Starred Projects - Show when selected */}
              {projectView === "starred" && (
                <div className="pt-4">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">
                    Starred Projects
                  </div>
                  <div className="space-y-0.5">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <SpinnerGap className="w-4 h-4 animate-spin text-white/30" />
                      </div>
                    ) : displayedProjects.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-white/30">
                        No starred projects yet
                      </p>
                    ) : (
                      displayedProjects.map((project) => (
                        <div
                          key={project.id}
                          className="group relative max-w-54"
                        >
                          <Link
                            to={`/workspace?conversationId=${project.id}`}
                            className={cn(
                              "flex items-center gap-3 pl-6 pr-10 py-2 rounded-lg text-sm transition-colors w-full",
                              currentProjectId === project.id
                                ? "bg-purple-500/10 text-white border-l-2 border-purple-500 ml-1"
                                : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                            )}
                            onClick={() => setOpenDropdownId(null)}
                          >
                            <ChatTeardropDots className="w-5 h-5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate font-medium text-sm block">
                                  {project.title || "Untitled Project"}
                                </span>
                                {project.starred && (
                                  <Star className="w-3 h-3 fill-current text-yellow-400 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] text-white/30 truncate">
                                {formatDate(project.updatedAt)}
                              </div>
                            </div>
                          </Link>

                          {/* Actions Menu */}
                          <DropdownMenu
                            open={openDropdownId === project.id}
                            onOpenChange={(open) =>
                              setOpenDropdownId(open ? project.id : null)
                            }
                          >
                            <DropdownMenuTrigger asChild>
                              <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all z-10"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                <DotsThreeOutline className="w-4 h-4 text-white/60 hover:text-white" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-40 bg-[#1a1a1a] border-white/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarToggle(project.id);
                                  setOpenDropdownId(null);
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <Star
                                  className={cn(
                                    "w-5 h-5",
                                    project.starred && "fill-current"
                                  )}
                                />
                                {project.starred ? "Unstar" : "Star"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectToDelete(project);
                                  setDeleteDialogOpen(true);
                                  setOpenDropdownId(null);
                                }}
                                className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
                              >
                                <Trash className="w-5 h-5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Resources Section */}
              <div className="pt-6">
                <div className="flex items-center gap-2 px-3 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    Resources
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/10 text-white/40">
                    Soon
                  </span>
                </div>

                <div className="mt-1 space-y-0.5 opacity-40">
                  <button
                    disabled
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/40 cursor-not-allowed"
                  >
                    <Compass className="w-4 h-4" />
                    Explore
                  </button>
                  <button
                    disabled
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/40 cursor-not-allowed"
                  >
                    <Cube className="w-4 h-4" />
                    Templates
                  </button>
                  <button
                    disabled
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/40 cursor-not-allowed"
                  >
                    <KanbanIcon className="w-4 h-4" />
                    Learn
                  </button>
                </div>
              </div>
            </>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/4 transition-colors"
            >
              <UserAvatar
                displayName={avatarProps.displayName}
                imageUrl={avatarProps.imageUrl}
              />
              {!isCollapsed && (
                <span className="text-sm text-white/70 truncate max-w-30">
                  {user?.name || user?.email || "User"}
                </span>
              )}
            </button>
            {!isCollapsed && (
              <button className="p-2 rounded-lg hover:bg-white/4 text-white/40 hover:text-white transition-colors relative">
                <Bell className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingProject}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProject(null);
            setNewTitle("");
          }
        }}
      >
        <DialogContent className="bg-[#1a1a1a] border-white/10 sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingProject && newTitle.trim()) {
                handleRename(editingProject.id, newTitle.trim());
              }
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-white">Rename Project</DialogTitle>
              <DialogDescription className="text-white/50">
                Enter a new name for this project.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="title" className="text-white/70">
                Title
              </Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-2 bg-white/5 border-white/10 text-white"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingProject(null);
                  setNewTitle("");
                }}
                className="border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newTitle.trim()}
                className="bg-purple-500 hover:bg-purple-600 text-white"
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Warning className="w-5 h-5 text-red-500" />
              Delete Project
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <DialogDescription className="text-white/60">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-white">
                "{projectToDelete?.title || "Untitled Project"}"
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="border-white/10 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                projectToDelete && handleDelete(projectToDelete.id)
              }
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? (
                <>
                  <SpinnerGap className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const ProjectSidebar = memo(ProjectSidebarComponent);
export default ProjectSidebar;
