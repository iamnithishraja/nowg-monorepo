import {
  Bell,
  Buildings,
  Calendar,
  Cardholder,
  CaretDown,
  CaretRight,
  ChatCircle,
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
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const TIME_FILTER_STORAGE_KEY = "nowgai:projectTimeFilter";

type TimeFilter = 
  | "all" 
  | "today" 
  | "yesterday"
  | "thisWeek" 
  | "lastWeek" 
  | "last7Days"
  | "last30Days"
  | "thisMonth" 
  | "lastMonth" 
  | "last3Months" 
  | "last6Months" 
  | "thisYear" 
  | "lastYear";

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
}

function ProjectSidebarComponent({
  className,
  user,
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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [visibleMonthsCount, setVisibleMonthsCount] = useState(2); // Show first 2 months initially

  // Edit/Delete state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search state
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Project[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Focus search input when dialog opens and fetch projects
  useEffect(() => {
    if (showSearchDialog) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      fetchProjectsForSearch();
    } else {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [showSearchDialog]);

  // Fetch projects for search
  const fetchProjectsForSearch = async () => {
    setIsSearching(true);
    try {
      const response = await fetch("/api/conversations");
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.conversations || []);
      }
    } catch (error) {
      console.error("Error fetching projects for search:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Filter and deduplicate search results based on query
  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const filtered = searchResults.filter((project) => {
      const title = (project.title || "").toLowerCase();
      return title.includes(query);
    });
    // Remove duplicates based on ID
    const seen = new Set();
    return filtered.filter((project) => {
      if (seen.has(project.id)) return false;
      seen.add(project.id);
      return true;
    });
  }, [searchQuery, searchResults]);

  // Highlight search terms in text
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-purple-500/30 text-purple-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Load persisted workspace selection and time filter
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (stored) {
        setSelectedWorkspace(stored);
      }
      const storedFilter = window.localStorage.getItem(TIME_FILTER_STORAGE_KEY);
      const validFilters = ["all", "today", "yesterday", "thisWeek", "lastWeek", "last7Days", "last30Days", "thisMonth", "lastMonth", "last3Months", "last6Months", "thisYear", "lastYear"];
      if (storedFilter && validFilters.includes(storedFilter)) {
        setTimeFilter(storedFilter as TimeFilter);
      }
    } catch (err) {
      console.error("Error reading from localStorage:", err);
    }
    setHasLoadedWorkspaceFromStorage(true);
  }, []);

  // Persist workspace selection and time filter
  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedWorkspaceFromStorage) return;
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, selectedWorkspace);
    } catch (err) {
      console.error("Error saving workspace to localStorage:", err);
    }
  }, [selectedWorkspace, hasLoadedWorkspaceFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TIME_FILTER_STORAGE_KEY, timeFilter);
    } catch (err) {
      console.error("Error saving time filter to localStorage:", err);
    }
  }, [timeFilter]);

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

  // Filter projects by time frame - MEMOIZED
  const filterProjectsByTime = useCallback((projects: Project[], filter: TimeFilter): Project[] => {
    if (filter === "all") return projects;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return projects.filter((project) => {
      const projectDate = new Date(project.updatedAt);
      const projectDateOnly = new Date(projectDate.getFullYear(), projectDate.getMonth(), projectDate.getDate());

      switch (filter) {
        case "today": {
          return projectDateOnly.getTime() === today.getTime();
        }
        case "yesterday": {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return projectDateOnly.getTime() === yesterday.getTime();
        }
        case "thisWeek": {
          const dayOfWeek = now.getDay();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - dayOfWeek);
          return projectDateOnly >= startOfWeek;
        }
        case "lastWeek": {
          const dayOfWeek = now.getDay();
          const startOfLastWeek = new Date(today);
          startOfLastWeek.setDate(today.getDate() - dayOfWeek - 7);
          const endOfLastWeek = new Date(today);
          endOfLastWeek.setDate(today.getDate() - dayOfWeek - 1);
          return projectDateOnly >= startOfLastWeek && projectDateOnly <= endOfLastWeek;
        }
        case "last7Days": {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return projectDateOnly >= sevenDaysAgo;
        }
        case "last30Days": {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return projectDateOnly >= thirtyDaysAgo;
        }
        case "thisMonth": {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return projectDateOnly >= startOfMonth;
        }
        case "lastMonth": {
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          return projectDateOnly >= startOfLastMonth && projectDateOnly <= endOfLastMonth;
        }
        case "last3Months": {
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          return projectDateOnly >= threeMonthsAgo;
        }
        case "last6Months": {
          const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          return projectDateOnly >= sixMonthsAgo;
        }
        case "thisYear": {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          return projectDateOnly >= startOfYear;
        }
        case "lastYear": {
          const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
          const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
          return projectDateOnly >= startOfLastYear && projectDateOnly <= endOfLastYear;
        }
        default:
          return true;
      }
    });
  }, []);

  // Get recent projects (last 5) - MEMOIZED (for display in recent section)
  const recentProjects = useMemo(
    () => {
      let recent = [...filteredProjects]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      
      // Apply time filter to recent projects too
      recent = filterProjectsByTime(recent, timeFilter);
      
      return recent.slice(0, 5);
    },
    [filteredProjects, timeFilter, filterProjectsByTime]
  );

  // Get projects based on view and time filter - MEMOIZED
  const displayedProjects = useMemo(() => {
    let projectsToShow = [...filteredProjects];

    // Apply time filter first
    projectsToShow = filterProjectsByTime(projectsToShow, timeFilter);

    if (projectView === "starred") {
      projectsToShow = projectsToShow.filter((p) => p.starred === true);
    } else if (projectView === "all" || projectView === "recent") {
      // Show ALL projects sorted by date (when filter is active, show all filtered results)
      projectsToShow = projectsToShow.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    return projectsToShow;
  }, [filteredProjects, projectView, timeFilter, filterProjectsByTime]);

  // Auto-switch to "all" view when a filter is applied (except "all")
  useEffect(() => {
    if (timeFilter !== "all" && projectView === "recent") {
      setProjectView("all");
    }
  }, [timeFilter, projectView]);

  // Group projects by month - MEMOIZED
  const projectsByMonth = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    
    displayedProjects.forEach((project) => {
      const date = new Date(project.updatedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(project);
    });

    // Sort months in descending order (newest first)
    const sortedMonths = Object.keys(grouped).sort((a, b) => {
      return b.localeCompare(a);
    });

    return { grouped, sortedMonths };
  }, [displayedProjects]);

  // Format month label for display
  const formatMonthLabel = useCallback((monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, []);

  // Toggle month expansion
  const toggleMonthExpansion = useCallback((monthKey: string) => {
    setExpandedMonths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  }, []);

  // Initialize expanded months on mount or when projects change
  useEffect(() => {
    if (projectsByMonth.sortedMonths.length > 0 && expandedMonths.size === 0) {
      // Expand the first (most recent) month by default
      setExpandedMonths(new Set([projectsByMonth.sortedMonths[0]]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsByMonth.sortedMonths]);

  // Reset visible months count when switching views or time filter
  useEffect(() => {
    setVisibleMonthsCount(2); // Reset to show first 2 months
  }, [projectView, timeFilter]);

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
              setShowSearchDialog(true);
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

                  {/* Time Filter Dropdown */}
                  <div className="px-3 mb-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors group",
                          timeFilter !== "all"
                            ? "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/15"
                            : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                        )}>
                          <Calendar className={cn(
                            "w-4 h-4 shrink-0",
                            timeFilter !== "all" ? "text-purple-400" : "text-white/60"
                          )} />
                          <span className="flex-1 text-left text-sm font-medium truncate">
                            {timeFilter === "all" && "All Time"}
                            {timeFilter === "today" && "Today"}
                            {timeFilter === "yesterday" && "Yesterday"}
                            {timeFilter === "thisWeek" && "This Week"}
                            {timeFilter === "lastWeek" && "Last Week"}
                            {timeFilter === "last7Days" && "Last 7 Days"}
                            {timeFilter === "last30Days" && "Last 30 Days"}
                            {timeFilter === "thisMonth" && "This Month"}
                            {timeFilter === "lastMonth" && "Last Month"}
                            {timeFilter === "last3Months" && "Last 3 Months"}
                            {timeFilter === "last6Months" && "Last 6 Months"}
                            {timeFilter === "thisYear" && "This Year"}
                            {timeFilter === "lastYear" && "Last Year"}
                          </span>
                          {timeFilter !== "all" && (
                            <span className="text-xs text-purple-400 font-medium shrink-0">
                              {displayedProjects.length}
                            </span>
                          )}
                          <CaretDown className={cn(
                            "w-4 h-4 shrink-0 transition-colors",
                            timeFilter !== "all" ? "text-purple-400/60 group-hover:text-purple-400" : "text-white/40 group-hover:text-white/60"
                          )} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-64 bg-[#1a1a1a] border-white/10 max-h-[60vh] overflow-y-auto"
                      >
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("all")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "all" && "bg-white/10"
                          )}
                        >
                          <Calendar className="w-4 h-4" />
                          <span className="flex-1">All Time</span>
                          {timeFilter === "all" && (
                            <span className="text-xs text-white/40">{filteredProjects.length}</span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                          Recent
                        </div>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("today")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "today" && "bg-white/10"
                          )}
                        >
                          Today
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("yesterday")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "yesterday" && "bg-white/10"
                          )}
                        >
                          Yesterday
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("thisWeek")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "thisWeek" && "bg-white/10"
                          )}
                        >
                          This Week
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("lastWeek")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "lastWeek" && "bg-white/10"
                          )}
                        >
                          Last Week
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                          Days
                        </div>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("last7Days")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "last7Days" && "bg-white/10"
                          )}
                        >
                          Last 7 Days
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("last30Days")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "last30Days" && "bg-white/10"
                          )}
                        >
                          Last 30 Days
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                          Months
                        </div>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("thisMonth")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "thisMonth" && "bg-white/10"
                          )}
                        >
                          This Month
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("lastMonth")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "lastMonth" && "bg-white/10"
                          )}
                        >
                          Last Month
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("last3Months")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "last3Months" && "bg-white/10"
                          )}
                        >
                          Last 3 Months
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("last6Months")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "last6Months" && "bg-white/10"
                          )}
                        >
                          Last 6 Months
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                          Years
                        </div>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("thisYear")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "thisYear" && "bg-white/10"
                          )}
                        >
                          This Year
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTimeFilter("lastYear")}
                          className={cn(
                            "gap-2 cursor-pointer",
                            timeFilter === "lastYear" && "bg-white/10"
                          )}
                        >
                          Last Year
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <button
                    onClick={() => {
                      setOpenDropdownId(null);
                      // If filter is active, keep "all" view; otherwise toggle
                      if (timeFilter !== "all") {
                        setProjectView("all");
                      } else {
                        setProjectView(projectView === "all" ? "recent" : "all");
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      (projectView === "all" || timeFilter !== "all")
                        ? "bg-white/[0.08] text-white"
                        : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <Cardholder className="w-4 h-4" />
                    {timeFilter !== "all" ? "Filtered Projects" : "All Projects"}
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

              {/* Recent Projects - Only show when not viewing All or Starred and no filter is active */}
              {projectView === "recent" && timeFilter === "all" && (
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

              {/* All Projects - Show when selected or when filter is active */}
              {(projectView === "all" || timeFilter !== "all") && (
                <div className="pt-4">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1 flex items-center justify-between">
                    <span>
                      {timeFilter !== "all" ? "Filtered Projects" : "All Projects"}
                    </span>
                    {timeFilter !== "all" && (
                      <button
                        onClick={() => setTimeFilter("all")}
                        className="text-[9px] text-purple-400 hover:text-purple-300 transition-colors"
                        title="Clear filter"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <SpinnerGap className="w-4 h-4 animate-spin text-white/30" />
                      </div>
                    ) : displayedProjects.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-xs text-white/30 mb-1">
                          {timeFilter !== "all" 
                            ? `No projects found for this time period`
                            : "No projects yet"}
                        </p>
                        {timeFilter !== "all" && (
                          <button
                            onClick={() => setTimeFilter("all")}
                            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {projectsByMonth.sortedMonths.slice(0, visibleMonthsCount).map((monthKey) => {
                        const monthProjects = projectsByMonth.grouped[monthKey];
                        const isExpanded = expandedMonths.has(monthKey);
                        
                        return (
                          <div key={monthKey} className="space-y-0.5">
                            {/* Month Header with Expand/Collapse */}
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                toggleMonthExpansion(monthKey);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30 hover:text-white/50 transition-colors"
                            >
                              {isExpanded ? (
                                <CaretDown className="w-4 h-4" />
                              ) : (
                                <CaretRight className="w-4 h-4" />
                              )}
                              <span className="flex-1 text-left">
                                {formatMonthLabel(monthKey)}
                              </span>
                              <span className="text-white/20">
                                ({monthProjects.length})
                              </span>
                            </button>

                            {/* Projects under this month */}
                            {isExpanded && (
                              <div className="ml-2 space-y-0.5">
                                {monthProjects.map((project) => (
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
                                ))}
                              </div>
                            )}
                          </div>
                        );
                        })}
                        {/* Load More Button */}
                        {projectsByMonth.sortedMonths.length > visibleMonthsCount && (
                          <div className="mt-4 pt-3 border-t border-white/10">
                            <button
                              onClick={() => {
                                setVisibleMonthsCount(prev => prev + 2); // Load 2 more months at a time
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:text-white bg-purple-500/10 hover:bg-purple-500/20 transition-colors border border-purple-500/20 hover:border-purple-500/40"
                            >
                              <CaretDown className="w-4 h-4" />
                              <span>Load More Months</span>
                            </button>
                          </div>
                        )}
                      </>
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
                  <div className="space-y-1">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <SpinnerGap className="w-4 h-4 animate-spin text-white/30" />
                      </div>
                    ) : displayedProjects.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-xs text-white/30 mb-1">
                          {timeFilter !== "all" 
                            ? `No starred projects found for this time period`
                            : "No starred projects yet"}
                        </p>
                        {timeFilter !== "all" && (
                          <button
                            onClick={() => setTimeFilter("all")}
                            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {projectsByMonth.sortedMonths.slice(0, visibleMonthsCount).map((monthKey) => {
                        const monthProjects = projectsByMonth.grouped[monthKey];
                        const isExpanded = expandedMonths.has(monthKey);
                        
                        return (
                          <div key={monthKey} className="space-y-0.5">
                            {/* Month Header with Expand/Collapse */}
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                toggleMonthExpansion(monthKey);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30 hover:text-white/50 transition-colors"
                            >
                              {isExpanded ? (
                                <CaretDown className="w-4 h-4" />
                              ) : (
                                <CaretRight className="w-4 h-4" />
                              )}
                              <span className="flex-1 text-left">
                                {formatMonthLabel(monthKey)}
                              </span>
                              <span className="text-white/20">
                                ({monthProjects.length})
                              </span>
                            </button>

                            {/* Projects under this month */}
                            {isExpanded && (
                              <div className="ml-2 space-y-0.5">
                                {monthProjects.map((project) => (
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
                                ))}
                              </div>
                            )}
                          </div>
                        );
                        })}
                        {/* Load More Button */}
                        {projectsByMonth.sortedMonths.length > visibleMonthsCount && (
                          <div className="mt-4 pt-3 border-t border-white/10">
                            <button
                              onClick={() => {
                                setVisibleMonthsCount(prev => prev + 2); // Load 2 more months at a time
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:text-white bg-purple-500/10 hover:bg-purple-500/20 transition-colors border border-purple-500/20 hover:border-purple-500/40"
                            >
                              <CaretDown className="w-4 h-4" />
                              <span>Load More Months</span>
                            </button>
                          </div>
                        )}
                      </>
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

      {/* Search Dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="max-w-2xl p-0 bg-[#1a1a1a] border-white/10">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/10">
            <DialogTitle className="text-base font-semibold text-white">
              Search Projects
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 pt-4 pb-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                ref={searchInputRef}
                placeholder="Search projects by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 pr-4 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
              />
            </div>
          </div>
          <div className="border-t border-white/10 max-h-[50vh] overflow-y-auto">
            <div className="px-2 py-2">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <SpinnerGap className="w-5 h-5 animate-spin text-purple-400 mb-2" />
                  <div className="text-sm text-white/50">Loading projects...</div>
                </div>
              ) : searchQuery.trim() === "" ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MagnifyingGlass className="w-8 h-8 text-white/20 mb-3" />
                  <div className="text-sm text-white/50">Type to search across your projects</div>
                  <div className="text-xs text-white/30 mt-1">
                    {searchResults.length > 0 && `${searchResults.length} project${searchResults.length !== 1 ? 's' : ''} available`}
                  </div>
                </div>
              ) : filteredSearchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MagnifyingGlass className="w-8 h-8 text-white/20 mb-3" />
                  <div className="text-sm text-white/50">No projects found</div>
                  <div className="text-xs text-white/30 mt-1">
                    No matches for "{searchQuery}"
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-xs font-medium text-white/40 uppercase tracking-wider">
                    {filteredSearchResults.length} result{filteredSearchResults.length !== 1 ? 's' : ''}
                  </div>
                  {filteredSearchResults.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        setShowSearchDialog(false);
                        navigate(`/workspace?conversationId=${project.id}`);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 active:bg-white/8 transition-all group border border-transparent hover:border-white/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 rounded-md bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                          <ChatCircle className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white group-hover:text-purple-200 transition-colors break-words">
                            {highlightText(project.title || "Untitled Project", searchQuery)}
                          </div>
                          {project.updatedAt && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="text-xs text-white/40">
                                Updated {new Date(project.updatedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </div>
                              {project.starred && (
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              )}
                            </div>
                          )}
                        </div>
                        <CaretRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors shrink-0 mt-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const ProjectSidebar = memo(ProjectSidebarComponent);
export default ProjectSidebar;
