import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { cn } from "../lib/utils";
import {
  House,
  MagnifyingGlass,
  FolderSimple,
  Star,
  CaretDown,
  CaretRight,
  Compass,
  Layout,
  GraduationCap,
  Bell,
  SidebarSimple,
  Buildings,
  User,
  DotsThreeOutline,
  Trash,
  PencilSimple,
  SpinnerGap,
  Warning,
  KanbanIcon,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import crop from "~/assets/crop.png";
import { Cardholder, ChatTeardropDots, Cube } from "phosphor-react";
import { Kanban } from "lucide-react";

interface Project {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  type: "personal" | "organization";
  organizationId?: string;
  organizationName?: string;
}

interface Organization {
  id: string;
  name: string;
  role?: string;
}

const WORKSPACE_STORAGE_KEY = "nowgai:selectedWorkspace";

interface ProjectSidebarProps {
  className?: string;
  user?: {
    name?: string;
    email?: string;
    image?: string;
  } | null;
  onSearchClick?: () => void;
}

export function ProjectSidebar({
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

  // Edit/Delete state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentProjectId = new URLSearchParams(location.search).get(
    "conversationId"
  );

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

  // Filter projects based on selected workspace
  const filteredProjects = projects.filter((p) => {
    if (selectedWorkspace === "personal") {
      return p.type === "personal";
    }
    return p.type === "organization" && p.organizationId === selectedWorkspace;
  });

  // Get recent projects (last 10)
  const recentProjects = [...filteredProjects]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 10);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get workspace display name
  const getWorkspaceName = () => {
    if (selectedWorkspace === "personal") return "Personal Projects";
    const org = organizations.find((o) => o.id === selectedWorkspace);
    return org?.name || "Organization";
  };

  // Handle project rename
  const handleRename = async (projectId: string, title: string) => {
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
  };

  // Handle project delete
  const handleDelete = async (projectId: string) => {
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
  };

  // User avatar component
  const Avatar = () => {
    const displayName = user?.name || user?.email;
    const imageUrl = user?.image;
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
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "?";

    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
        {initials}
      </div>
    );
  };

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
        <ScrollArea className="flex-1 px-3 space-y-1">
          {/* Primary Navigation */}
          <Link
            to="/home"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/home"
                ? "bg-white/[0.08] text-white"
                : "text-white/60 hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <House className="w-4 h-4" />
            {!isCollapsed && "Home"}
          </Link>

          <button
            onClick={onSearchClick}
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

              <Link
                to="/home"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <Cardholder className="w-4 h-4" />
                All Projects
              </Link>

              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors">
                <Star className="w-4 h-4" />
                Starred
              </button>

              {/* Recent Projects */}
              <div className="pt-4">
                <button
                  onClick={() =>
                    setRecentProjectsExpanded(!recentProjectsExpanded)
                  }
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
                        <div key={project.id} className="group relative">
                          <Link
                            to={`/workspace?conversationId=${project.id}`}
                            className={cn(
                              "flex items-center gap-3 pl-6 pr-2 py-2 rounded-lg text-sm transition-colors",
                              currentProjectId === project.id
                                ? "bg-purple-500/10 text-white border-l-2 border-purple-500 ml-1"
                                : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                            )}
                          >
                              <ChatTeardropDots className="w-5 h-5" />
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium text-sm">
                                {project.title || "Untitled Project"}
                              </div>
                              <div className="text-[10px] text-white/30">
                                {formatDate(project.updatedAt)}
                              </div>
                            </div>
                          </Link>

                          {/* Actions Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                                onClick={(e) => e.preventDefault()}
                              >
                                <DotsThreeOutline className="w-5 h-5 text-white/50" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-40 bg-[#1a1a1a] border-white/10"
                            >
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingProject(project);
                                  setNewTitle(project.title);
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <PencilSimple className="w-5 h-5" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setProjectToDelete(project);
                                  setDeleteDialogOpen(true);
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
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <Avatar />
              {!isCollapsed && (
                <span className="text-sm text-white/70 truncate max-w-[120px]">
                  {user?.name || user?.email || "User"}
                </span>
              )}
            </button>
            {!isCollapsed && (
              <button className="p-2 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white transition-colors relative">
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

export default ProjectSidebar;
