import {
  Bell,
  Buildings,
  Calendar,
  Cardholder,
  CaretDown,
  CaretRight,
  ChatCircle,
  ChatTeardropDots,
  CheckCircle,
  Compass,
  Cube,
  DotsThreeOutline,
  Envelope,
  Funnel,
  Globe,
  Headphones,
  House,
  KanbanIcon,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Robot,
  SidebarSimple,
  SortAscending,
  SpinnerGap,
  Star,
  Trash,
  User,
  Warning,
  X,
} from "@phosphor-icons/react";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useIsMobile } from "~/hooks/use-mobile";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ContactFormDialog } from "./ContactFormDialog";
import { Textarea } from "./ui/textarea";
import { countryCodes } from "~/lib/countryCodes";

// Phone digit length rules per country code (expected number of digits AFTER the country code)
const phoneDigitLengths: Record<string, { min: number; max: number }> = {
  "+1": { min: 10, max: 10 },    // USA/Canada
  "+7": { min: 10, max: 10 },    // Russia
  "+20": { min: 10, max: 10 },   // Egypt
  "+27": { min: 9, max: 9 },     // South Africa
  "+30": { min: 10, max: 10 },   // Greece
  "+31": { min: 9, max: 9 },     // Netherlands
  "+32": { min: 8, max: 9 },     // Belgium
  "+33": { min: 9, max: 9 },     // France
  "+34": { min: 9, max: 9 },     // Spain
  "+36": { min: 8, max: 9 },     // Hungary
  "+39": { min: 9, max: 10 },    // Italy
  "+40": { min: 9, max: 9 },     // Romania
  "+41": { min: 9, max: 9 },     // Switzerland
  "+43": { min: 10, max: 13 },   // Austria
  "+44": { min: 10, max: 10 },   // UK
  "+45": { min: 8, max: 8 },     // Denmark
  "+46": { min: 7, max: 13 },    // Sweden
  "+47": { min: 8, max: 8 },     // Norway
  "+48": { min: 9, max: 9 },     // Poland
  "+49": { min: 10, max: 11 },   // Germany
  "+51": { min: 9, max: 9 },     // Peru
  "+52": { min: 10, max: 10 },   // Mexico
  "+54": { min: 10, max: 10 },   // Argentina
  "+55": { min: 10, max: 11 },   // Brazil
  "+56": { min: 9, max: 9 },     // Chile
  "+57": { min: 10, max: 10 },   // Colombia
  "+60": { min: 9, max: 10 },    // Malaysia
  "+61": { min: 9, max: 9 },     // Australia
  "+62": { min: 9, max: 12 },    // Indonesia
  "+63": { min: 10, max: 10 },   // Philippines
  "+64": { min: 8, max: 10 },    // New Zealand
  "+65": { min: 8, max: 8 },     // Singapore
  "+66": { min: 9, max: 9 },     // Thailand
  "+81": { min: 10, max: 10 },   // Japan
  "+82": { min: 9, max: 10 },    // South Korea
  "+84": { min: 9, max: 10 },    // Vietnam
  "+86": { min: 11, max: 11 },   // China
  "+90": { min: 10, max: 10 },   // Turkey
  "+91": { min: 10, max: 10 },   // India
  "+92": { min: 10, max: 10 },   // Pakistan
  "+93": { min: 9, max: 9 },     // Afghanistan
  "+94": { min: 9, max: 9 },     // Sri Lanka
  "+95": { min: 8, max: 10 },    // Myanmar
  "+98": { min: 10, max: 10 },   // Iran
  "+212": { min: 9, max: 9 },    // Morocco
  "+213": { min: 9, max: 9 },    // Algeria
  "+234": { min: 10, max: 10 },  // Nigeria
  "+351": { min: 9, max: 9 },    // Portugal
  "+353": { min: 9, max: 9 },    // Ireland
  "+358": { min: 9, max: 10 },   // Finland
  "+380": { min: 9, max: 9 },    // Ukraine
  "+420": { min: 9, max: 9 },    // Czech Republic
  "+852": { min: 8, max: 8 },    // Hong Kong
  "+880": { min: 10, max: 10 },  // Bangladesh
  "+886": { min: 9, max: 9 },    // Taiwan
  "+960": { min: 7, max: 7 },    // Maldives
  "+961": { min: 7, max: 8 },    // Lebanon
  "+962": { min: 9, max: 9 },    // Jordan
  "+964": { min: 10, max: 10 },  // Iraq
  "+965": { min: 8, max: 8 },    // Kuwait
  "+966": { min: 9, max: 9 },    // Saudi Arabia
  "+968": { min: 8, max: 8 },    // Oman
  "+971": { min: 9, max: 9 },    // UAE
  "+972": { min: 9, max: 9 },    // Israel
  "+973": { min: 8, max: 8 },    // Bahrain
  "+974": { min: 8, max: 8 },    // Qatar
  "+977": { min: 10, max: 10 },  // Nepal
};

/** Validate a phone number given the country code. Returns an error string or empty string if valid. */
function validatePhoneForCountry(phone: string, countryCode: string): string {
  if (!phone) return ""; // phone is optional, no error if empty
  const rule = phoneDigitLengths[countryCode];
  if (!rule) {
    // Fallback: accept 4-15 digits for unknown countries
    if (phone.length < 4) return "Phone number is too short";
    if (phone.length > 15) return "Phone number is too long";
    return "";
  }
  const countryEntry = countryCodes.find((c) => c.code === countryCode);
  const countryName = countryEntry?.country || countryCode;
  if (rule.min === rule.max) {
    if (phone.length !== rule.min) {
      return `${countryName} numbers must be exactly ${rule.min} digits (currently ${phone.length})`;
    }
  } else {
    if (phone.length < rule.min) {
      return `${countryName} numbers must be at least ${rule.min} digits (currently ${phone.length})`;
    }
    if (phone.length > rule.max) {
      return `${countryName} numbers must be at most ${rule.max} digits (currently ${phone.length})`;
    }
  }
  return "";
}

interface Project {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  type: "personal" | "organization";
  organizationId?: string;
  organizationName?: string;
  starred?: boolean;
  model?: string;
  deploymentUrl?: string | null;
}

interface Organization {
  id: string;
  name: string;
  role?: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: "open" | "resolved";
  adminNotes?: string;
  createdAt: string;
  resolvedAt?: string | null;
}

const WORKSPACE_STORAGE_KEY = "nowgai:selectedWorkspace";
const SIDEBAR_CONTEXT_STORAGE_KEY = "web-sidebar-context";
const FILTERS_STORAGE_KEY = "nowgai:projectFilters";

// Simplified time filter
type TimeFilter = "all" | "today" | "thisWeek" | "thisMonth" | "thisYear";

// Sort order
type SortOrder =
  | "updatedDesc"
  | "updatedAsc"
  | "createdDesc"
  | "createdAsc"
  | "alphabetical";

// Deployment filter
type DeploymentFilter = "all" | "deployed" | "notDeployed";

// Model filter - will be dynamically populated
type ModelFilter = "all" | string;

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

function ProjectSidebarComponent({ className, user }: ProjectSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isWorkspace = location.pathname === "/workspace";
  // Collapse sidebar by default on workspace pages to maximize editing space.
  // Keep it expanded on the home/dashboard so users can browse projects easily.
  const [isCollapsed, setIsCollapsed] = useState(() => isWorkspace);
  // On mobile: drawer closed by default so header and main content are accessible.
  const [mobileOpen, setMobileOpen] = useState(false);
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
    "recent",
  );

  // Filter states
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("updatedDesc");
  const [deploymentFilter, setDeploymentFilter] =
    useState<DeploymentFilter>("all");
  const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

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

  // Contact dialog state
  const [showContactDialog, setShowContactDialog] = useState(false);

  // Support tickets panel state
  const [showSupportPanel, setShowSupportPanel] = useState(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [supportTab, setSupportTab] = useState<"history" | "new">("new");
  // New ticket form — matches original ContactFormDialog fields
  const [ticketFullName, setTicketFullName] = useState("");
  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketPhone, setTicketPhone] = useState("");
  const [ticketCountryCode, setTicketCountryCode] = useState("+91");
  const [ticketCompany, setTicketCompany] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({});
  const [ticketCountryDropdownOpen, setTicketCountryDropdownOpen] = useState(false);
  const [ticketCountrySearch, setTicketCountrySearch] = useState("");
  const ticketCountryDropdownRef = useRef<HTMLDivElement>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const currentProjectId = useMemo(
    () => new URLSearchParams(location.search).get("conversationId"),
    [location.search],
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

  // Listen for toggle event from workspace header (on mobile this opens the drawer)
  useEffect(() => {
    const handleToggle = () => {
      if (isMobile) {
        setMobileOpen(true);
      } else {
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("toggleProjectSidebar", handleToggle);
    return () =>
      window.removeEventListener("toggleProjectSidebar", handleToggle);
  }, [isMobile]);

  // Listen for open event from mobile header menu (Capacitor / small screens)
  useEffect(() => {
    const handleOpen = () => setMobileOpen(true);
    window.addEventListener("openProjectSidebar", handleOpen);
    return () => window.removeEventListener("openProjectSidebar", handleOpen);
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
    const query = searchQuery.toLowerCase();
    const filtered = searchResults.filter((project) => {
      // If no search query, show all projects
      if (!query.trim()) return true;
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
    const parts = text.split(
      new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
    );
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark
          key={i}
          className="bg-purple-500/30 text-purple-200 px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  // Load persisted workspace selection and filters
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (stored) {
        setSelectedWorkspace(stored);
      }
      // Load all filters from single storage key
      const storedFilters = window.localStorage.getItem(FILTERS_STORAGE_KEY);
      if (storedFilters) {
        const filters = JSON.parse(storedFilters);
        if (
          filters.timeFilter &&
          ["all", "today", "thisWeek", "thisMonth", "thisYear"].includes(
            filters.timeFilter,
          )
        ) {
          setTimeFilter(filters.timeFilter);
        }
        if (
          filters.sortOrder &&
          [
            "updatedDesc",
            "updatedAsc",
            "createdDesc",
            "createdAsc",
            "alphabetical",
          ].includes(filters.sortOrder)
        ) {
          setSortOrder(filters.sortOrder);
        }
        if (
          filters.deploymentFilter &&
          ["all", "deployed", "notDeployed"].includes(filters.deploymentFilter)
        ) {
          setDeploymentFilter(filters.deploymentFilter);
        }
        if (filters.modelFilter) {
          setModelFilter(filters.modelFilter);
        }
      }
    } catch (err) {
      console.error("Error reading from localStorage:", err);
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

  // Persist all filters
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          timeFilter,
          sortOrder,
          deploymentFilter,
          modelFilter,
        }),
      );
    } catch (err) {
      console.error("Error saving filters to localStorage:", err);
    }
  }, [timeFilter, sortOrder, deploymentFilter, modelFilter]);

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
      new CustomEvent("sidebarContextChange", { detail: nextContext }),
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
                model: conv.model || null,
                deploymentUrl: conv.deploymentUrl || null,
              }),
            );
            orgs = orgData.organizations || [];
          }
        } catch { }

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
            model: conv.model || null,
            deploymentUrl: conv.deploymentUrl || null,
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
    [projects, selectedWorkspace],
  );

  // Helper to check if project is starred
  const isProjectStarred = useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      return project?.starred || false;
    },
    [projects],
  );

  // Get unique models from projects for the filter dropdown
  const availableModels = useMemo(() => {
    const models = new Set<string>();
    filteredProjects.forEach((p) => {
      if (p.model) models.add(p.model);
    });
    return Array.from(models).sort();
  }, [filteredProjects]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      timeFilter !== "all" ||
      sortOrder !== "updatedDesc" ||
      deploymentFilter !== "all" ||
      modelFilter !== "all"
    );
  }, [timeFilter, sortOrder, deploymentFilter, modelFilter]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setTimeFilter("all");
    setSortOrder("updatedDesc");
    setDeploymentFilter("all");
    setModelFilter("all");
  }, []);

  // Filter projects by time frame - MEMOIZED (simplified)
  const filterProjectsByTime = useCallback(
    (projects: Project[], filter: TimeFilter): Project[] => {
      if (filter === "all") return projects;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      return projects.filter((project) => {
        const projectDate = new Date(project.updatedAt);
        const projectDateOnly = new Date(
          projectDate.getFullYear(),
          projectDate.getMonth(),
          projectDate.getDate(),
        );

        switch (filter) {
          case "today": {
            return projectDateOnly.getTime() === today.getTime();
          }
          case "thisWeek": {
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - dayOfWeek);
            return projectDateOnly >= startOfWeek;
          }
          case "thisMonth": {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return projectDateOnly >= startOfMonth;
          }
          case "thisYear": {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            return projectDateOnly >= startOfYear;
          }
          default:
            return true;
        }
      });
    },
    [],
  );

  // Filter projects by deployment status
  const filterByDeployment = useCallback(
    (projects: Project[], filter: DeploymentFilter): Project[] => {
      if (filter === "all") return projects;
      return projects.filter((p) => {
        if (filter === "deployed") return !!p.deploymentUrl;
        if (filter === "notDeployed") return !p.deploymentUrl;
        return true;
      });
    },
    [],
  );

  // Filter projects by model
  const filterByModel = useCallback(
    (projects: Project[], filter: ModelFilter): Project[] => {
      if (filter === "all") return projects;
      return projects.filter((p) => p.model === filter);
    },
    [],
  );

  // Sort projects
  const sortProjects = useCallback(
    (projects: Project[], order: SortOrder): Project[] => {
      const sorted = [...projects];
      switch (order) {
        case "updatedDesc":
          return sorted.sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
        case "updatedAsc":
          return sorted.sort(
            (a, b) =>
              new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
          );
        case "createdDesc":
          return sorted.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        case "createdAsc":
          return sorted.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        case "alphabetical":
          return sorted.sort((a, b) =>
            (a.title || "").localeCompare(b.title || ""),
          );
        default:
          return sorted;
      }
    },
    [],
  );

  // Get recent projects (last 5) - MEMOIZED (for display in recent section)
  const recentProjects = useMemo(() => {
    let recent = [...filteredProjects];

    // Apply all filters
    recent = filterProjectsByTime(recent, timeFilter);
    recent = filterByDeployment(recent, deploymentFilter);
    recent = filterByModel(recent, modelFilter);
    recent = sortProjects(recent, sortOrder);

    return recent.slice(0, 5);
  }, [
    filteredProjects,
    timeFilter,
    deploymentFilter,
    modelFilter,
    sortOrder,
    filterProjectsByTime,
    filterByDeployment,
    filterByModel,
    sortProjects,
  ]);

  // Get projects based on view and all filters - MEMOIZED
  const displayedProjects = useMemo(() => {
    let projectsToShow = [...filteredProjects];

    // Apply all filters
    projectsToShow = filterProjectsByTime(projectsToShow, timeFilter);
    projectsToShow = filterByDeployment(projectsToShow, deploymentFilter);
    projectsToShow = filterByModel(projectsToShow, modelFilter);

    if (projectView === "starred") {
      projectsToShow = projectsToShow.filter((p) => p.starred === true);
    }

    // Apply sort order
    projectsToShow = sortProjects(projectsToShow, sortOrder);

    return projectsToShow;
  }, [
    filteredProjects,
    projectView,
    timeFilter,
    deploymentFilter,
    modelFilter,
    sortOrder,
    filterProjectsByTime,
    filterByDeployment,
    filterByModel,
    sortProjects,
  ]);

  // Auto-switch to "all" view when any filter is applied
  useEffect(() => {
    if (hasActiveFilters && projectView === "recent") {
      setProjectView("all");
    }
  }, [hasActiveFilters, projectView]);

  // Group projects by month - MEMOIZED
  const projectsByMonth = useMemo(() => {
    const grouped: Record<string, Project[]> = {};

    displayedProjects.forEach((project) => {
      const date = new Date(project.updatedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

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
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
          prev.map((p) => (p.id === projectId ? { ...p, title } : p)),
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
    [currentProjectId, navigate],
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
          p.id === projectId ? { ...p, starred: data.starred } : p,
        ),
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
    [user?.name, user?.email, user?.image],
  );

  // Fetch user's support tickets
  const fetchSupportTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/support-tickets");
      if (res.ok) {
        const data = await res.json();
        setSupportTickets(data.tickets || []);
      }
    } catch (err) {
      console.error("Error fetching support tickets:", err);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  // Submit a new support ticket
  const submitTicket = useCallback(async () => {
    if (!ticketFullName.trim() || !ticketEmail.trim() || !ticketSubject.trim() || !ticketMessage.trim()) return;
    // Block submit if phone is provided but invalid
    const phoneErr = validatePhoneForCountry(ticketPhone.trim(), ticketCountryCode);
    if (phoneErr) {
      setTicketErrors((prev) => ({ ...prev, phone: phoneErr }));
      return;
    }
    setIsSubmittingTicket(true);
    try {
      // 1. Persist the ticket in DB and capture the returned ticket ID
      const ticketRes = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: ticketSubject.trim(),
          message: ticketMessage.trim(),
          phone: ticketPhone.trim(),
          countryCode: ticketCountryCode,
          company: ticketCompany.trim(),
        }),
      });
      const ticketData = ticketRes.ok ? await ticketRes.json() : {};
      const ticketId = ticketData?.ticket?._id || ticketData?.ticket?.id || null;

      // 2. Also send email notification with ticket ID in subject
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: ticketFullName.trim(),
          email: ticketEmail.trim(),
          phone: ticketPhone.trim(),
          countryCode: ticketCountryCode,
          company: ticketCompany.trim(),
          subject: ticketSubject.trim(),
          message: ticketMessage.trim(),
          ticketId,
        }),
      });

      setTicketSuccess(true);
      setTicketFullName("");
      setTicketEmail("");
      setTicketPhone("");
      setTicketCountryCode("+91");
      setTicketCompany("");
      setTicketSubject("");
      setTicketMessage("");
      setTicketErrors({});
      await fetchSupportTickets();
      setTimeout(() => {
        setTicketSuccess(false);
        setSupportTab("history");
      }, 2000);
    } catch (err) {
      console.error("Error submitting ticket:", err);
    } finally {
      setIsSubmittingTicket(false);
    }
  }, [ticketFullName, ticketEmail, ticketPhone, ticketCountryCode, ticketCompany, ticketSubject, ticketMessage, fetchSupportTickets]);

  // On mobile drawer always show full (expanded) content
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  const asideContent = (
    <aside
      className={cn(
        "flex flex-col h-full bg-surface-1 border-r border-subtle transition-all duration-300 relative",
        isMobile
          ? "fixed left-0 top-0 z-40 h-full w-72 overflow-hidden shadow-xl"
          : isWorkspace && isCollapsed
            ? "w-0 overflow-hidden border-r-0"
            : isCollapsed
              ? "w-16 overflow-hidden"
              : "w-60 overflow-hidden",
        isMobile && !mobileOpen && "-translate-x-full",
        isMobile && mobileOpen && "translate-x-0",
        className,
      )}
      style={isMobile ? { transitionProperty: "transform" } : undefined}
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
          effectiveCollapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {!isWorkspace && !effectiveCollapsed && (
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
        {isMobile ? (
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-md hover:bg-white/5 text-white/50 hover:text-white transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-md hover:bg-white/5 text-white/50 hover:text-white transition-colors shrink-0"
          >
            <SidebarSimple className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Workspace Selector */}
      {!effectiveCollapsed && (
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
              : "text-white/60 hover:text-white hover:bg-white/[0.04]",
          )}
          onClick={() => {
            setOpenDropdownId(null);
            if (isMobile) setMobileOpen(false);
          }}
        >
          <House className="w-4 h-4" />
          {!effectiveCollapsed && "Home"}
        </Link>

        <button
          onClick={() => {
            setOpenDropdownId(null);
            setShowSearchDialog(true);
          }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            "text-white/60 hover:text-white hover:bg-white/[0.04]",
          )}
        >
          <MagnifyingGlass className="w-4 h-4" />
          {!effectiveCollapsed && "Search"}
        </button>

        {/* Projects Section */}
        {!effectiveCollapsed && (
          <>
            <div className="pt-4 pb-2 flex items-center justify-between px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Projects
              </span>
              <button
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                  hasActiveFilters
                    ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                    : "text-white/40 hover:text-white/60 hover:bg-white/5",
                )}
              >
                <Funnel className="w-3 h-3" />
                {hasActiveFilters && (
                  <span className="text-[10px]">
                    {displayedProjects.length}
                  </span>
                )}
              </button>
            </div>

            {/* Filters Panel */}
            {showFiltersPanel && (
              <div className="px-3 mb-3 space-y-2">
                {/* Clear All Button */}
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="w-full text-xs text-purple-400 hover:text-purple-300 py-1 transition-colors"
                  >
                    Clear all filters
                  </button>
                )}

                {/* Time Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Time
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { value: "today", label: "Today" },
                      { value: "thisWeek", label: "Week" },
                      { value: "thisMonth", label: "Month" },
                      { value: "thisYear", label: "Year" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          // Toggle: if already selected, reset to all
                          if (timeFilter === option.value) {
                            setTimeFilter("all");
                          } else {
                            setTimeFilter(option.value as TimeFilter);
                          }
                        }}
                        className={cn(
                          "px-2 py-1 text-xs rounded transition-colors",
                          timeFilter === option.value
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-white/5 text-white/60 hover:bg-white/10",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort Order - only show non-default options, clicking toggles */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
                    <SortAscending className="w-3 h-3" />
                    Sort
                    <span className="text-white/20 font-normal normal-case">
                      (default: recent)
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { value: "createdDesc", label: "Newest" },
                      { value: "createdAsc", label: "Oldest" },
                      { value: "alphabetical", label: "A-Z" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          // Toggle: if already selected, reset to default
                          if (sortOrder === option.value) {
                            setSortOrder("updatedDesc");
                          } else {
                            setSortOrder(option.value as SortOrder);
                          }
                        }}
                        className={cn(
                          "px-2 py-1 text-xs rounded transition-colors",
                          sortOrder === option.value
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-white/5 text-white/60 hover:bg-white/10",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deployment Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Deployment
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { value: "deployed", label: "Deployed" },
                      { value: "notDeployed", label: "Not Deployed" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          // Toggle: if already selected, reset to all
                          if (deploymentFilter === option.value) {
                            setDeploymentFilter("all");
                          } else {
                            setDeploymentFilter(
                              option.value as DeploymentFilter,
                            );
                          }
                        }}
                        className={cn(
                          "px-2 py-1 text-xs rounded transition-colors",
                          deploymentFilter === option.value
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-white/5 text-white/60 hover:bg-white/10",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Filter */}
                {availableModels.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
                      <Robot className="w-3 h-3" />
                      Model
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {availableModels.map((model) => (
                        <button
                          key={model}
                          onClick={() => {
                            // Toggle: if already selected, deselect (reset to all)
                            if (modelFilter === model) {
                              setModelFilter("all");
                            } else {
                              setModelFilter(model);
                            }
                          }}
                          className={cn(
                            "px-2 py-1 text-xs rounded transition-colors truncate max-w-[80px]",
                            modelFilter === model
                              ? "bg-purple-500/20 text-purple-400"
                              : "bg-white/5 text-white/60 hover:bg-white/10",
                          )}
                          title={model}
                        >
                          {model.split("/").pop()?.split("-")[0] || model}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setOpenDropdownId(null);
                // If filter is active, keep "all" view; otherwise toggle
                if (hasActiveFilters) {
                  setProjectView("all");
                } else {
                  setProjectView(projectView === "all" ? "recent" : "all");
                }
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                projectView === "all" || hasActiveFilters
                  ? "bg-white/[0.08] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]",
              )}
            >
              <Cardholder className="w-4 h-4" />
              <span className="flex-1 text-left">
                {hasActiveFilters ? "Filtered" : "All Projects"}
              </span>
              {hasActiveFilters && (
                <span className="text-xs text-purple-400">
                  {displayedProjects.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setOpenDropdownId(null);
                // Toggle: if already "starred", go back to "recent", otherwise set to "starred"
                setProjectView(
                  projectView === "starred" ? "recent" : "starred",
                );
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                projectView === "starred"
                  ? "bg-white/[0.08] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]",
              )}
            >
              <Star
                className={cn(
                  "w-4 h-4",
                  projectView === "starred" && "fill-current",
                )}
              />
              Starred Projects
            </button>

            {/* Recent Projects - Only show when not viewing All or Starred and no filter is active */}
            {projectView === "recent" && !hasActiveFilters && (
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
                                : "text-white/60 hover:text-white hover:bg-white/[0.04]",
                            )}
                            onClick={() => {
                              setOpenDropdownId(null);
                              if (isMobile) setMobileOpen(false);
                            }}
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
                                    project.starred && "fill-current",
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
            {(projectView === "all" || hasActiveFilters) && (
              <div className="pt-4">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1 flex items-center justify-between">
                  <span>
                    {hasActiveFilters ? "Filtered Projects" : "All Projects"}
                  </span>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-[9px] text-purple-400 hover:text-purple-300 transition-colors"
                      title="Clear all filters"
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
                        {hasActiveFilters
                          ? `No projects match your filters`
                          : "No projects yet"}
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={clearAllFilters}
                          className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {projectsByMonth.sortedMonths
                        .slice(0, visibleMonthsCount)
                        .map((monthKey) => {
                          const monthProjects =
                            projectsByMonth.grouped[monthKey];
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
                                            : "text-white/60 hover:text-white hover:bg-white/[0.04]",
                                        )}
                                        onClick={() => {
                                          setOpenDropdownId(null);
                                          if (isMobile) setMobileOpen(false);
                                        }}
                                      >
                                        <ChatTeardropDots className="w-5 h-5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="truncate font-medium text-sm block">
                                              {project.title ||
                                                "Untitled Project"}
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
                                          setOpenDropdownId(
                                            open ? project.id : null,
                                          )
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
                                                project.starred &&
                                                "fill-current",
                                              )}
                                            />
                                            {project.starred
                                              ? "Unstar"
                                              : "Star"}
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
                      {projectsByMonth.sortedMonths.length >
                        visibleMonthsCount && (
                          <div className="mt-4 pt-3 border-t border-white/10">
                            <button
                              onClick={() => {
                                setVisibleMonthsCount((prev) => prev + 2); // Load 2 more months at a time
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
                        {hasActiveFilters
                          ? `No starred projects match your filters`
                          : "No starred projects yet"}
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={clearAllFilters}
                          className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {projectsByMonth.sortedMonths
                        .slice(0, visibleMonthsCount)
                        .map((monthKey) => {
                          const monthProjects =
                            projectsByMonth.grouped[monthKey];
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
                                            : "text-white/60 hover:text-white hover:bg-white/[0.04]",
                                        )}
                                        onClick={() => {
                                          setOpenDropdownId(null);
                                          if (isMobile) setMobileOpen(false);
                                        }}
                                      >
                                        <ChatTeardropDots className="w-5 h-5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="truncate font-medium text-sm block">
                                              {project.title ||
                                                "Untitled Project"}
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
                                          setOpenDropdownId(
                                            open ? project.id : null,
                                          )
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
                                                project.starred &&
                                                "fill-current",
                                              )}
                                            />
                                            {project.starred
                                              ? "Unstar"
                                              : "Star"}
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
                      {projectsByMonth.sortedMonths.length >
                        visibleMonthsCount && (
                          <div className="mt-4 pt-3 border-t border-white/10">
                            <button
                              onClick={() => {
                                setVisibleMonthsCount((prev) => prev + 2); // Load 2 more months at a time
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

            {/* Contact Section */}
            <div className="pt-6">
              <button
                onClick={() => {
                  setOpenDropdownId(null);
                  setShowSupportPanel(true);
                  fetchSupportTickets();
                  // setSupportTab("history");
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-white/60 hover:text-white hover:bg-white/[0.04]"
              >
                <Headphones className="w-4 h-4" />
                Contact Support
              </button>

              {/* Switch to Enterprise Plan - only shown when user has no org */}
              {organizations.length === 0 && !isLoading && (
                <button
                  onClick={() => {
                    setOpenDropdownId(null);
                    navigate("/manage-org/convo");
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-[#a78bfa] hover:text-white hover:bg-[#7b4cff]/10 mt-1"
                >
                  <Buildings className="w-4 h-4" />
                  Switch to Enterprise Plan
                </button>
              )}
            </div>
          </>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              navigate("/profile");
              if (isMobile) setMobileOpen(false);
            }}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/4 transition-colors"
          >
            <UserAvatar
              displayName={avatarProps.displayName}
              imageUrl={avatarProps.imageUrl}
            />
            {!effectiveCollapsed && (
              <span className="text-sm text-white/70 truncate max-w-30">
                {user?.name || user?.email || "User"}
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      {isMobile ? (
        <div className="w-0 flex-shrink-0 overflow-visible">{asideContent}</div>
      ) : (
        asideContent
      )}

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
                  <div className="text-sm text-white/50">
                    Loading projects...
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
                    {filteredSearchResults.length} result
                    {filteredSearchResults.length !== 1 ? "s" : ""}
                  </div>
                  {filteredSearchResults.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        setShowSearchDialog(false);
                        if (isMobile) setMobileOpen(false);
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
                            {highlightText(
                              project.title || "Untitled Project",
                              searchQuery,
                            )}
                          </div>
                          {project.updatedAt && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="text-xs text-white/40">
                                Updated{" "}
                                {new Date(project.updatedAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
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

      {/* Contact Dialog (legacy - kept for compatibility, no longer triggered) */}
      <ContactFormDialog open={showContactDialog} onOpenChange={setShowContactDialog} />

      {/* Support Tickets Panel */}
      <Dialog open={showSupportPanel} onOpenChange={(open) => {
        if (!open) {
          setShowSupportPanel(false);
          setTicketSuccess(false);
          setTicketFullName("");
          setTicketEmail("");
          setTicketPhone("");
          setTicketCountryCode("+91");
          setTicketCompany("");
          setTicketSubject("");
          setTicketMessage("");
          setTicketErrors({});
          setTicketCountryDropdownOpen(false);
        }
      }}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 sm:max-w-xl max-h-[90vh] flex flex-col p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-purple-400" />
              <DialogTitle className="text-white text-lg font-semibold m-0">Support Tickets</DialogTitle>
            </div>
            {/* Tab switcher */}
            <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
              <button
                onClick={() => setSupportTab("history")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  supportTab === "history"
                    ? "bg-purple-500 text-white"
                    : "text-white/50 hover:text-white",
                )}
              >
                History
              </button>
              <button
                onClick={() => setSupportTab("new")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
                  supportTab === "new"
                    ? "bg-purple-500 text-white"
                    : "text-white/50 hover:text-white",
                )}
              >
                <Plus className="w-3 h-3" />
                New Ticket
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* History tab */}
            {supportTab === "history" && (
              <div className="p-5">
                {ticketsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <SpinnerGap className="w-5 h-5 animate-spin text-purple-400" />
                  </div>
                ) : supportTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Headphones className="w-12 h-12 text-white/10 mb-3" />
                    <p className="text-white/50 text-sm">No support tickets yet</p>
                    <button
                      onClick={() => setSupportTab("new")}
                      className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Submit your first ticket →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {supportTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-white leading-tight">{ticket.subject}</p>
                          <span
                            className={cn(
                              "shrink-0 text-xs px-2 py-0.5 rounded-full font-medium",
                              ticket.status === "open"
                                ? "bg-orange-500/20 text-orange-400"
                                : "bg-green-500/20 text-green-400",
                            )}
                          >
                            {ticket.status === "open" ? "Open" : "Resolved"}
                          </span>
                        </div>
                        {/* Ticket ID */}
                        <p className="text-xs font-mono text-white/30">
                          #{String((ticket as any)._id || ticket.id || "").slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-white/50 line-clamp-2">{ticket.message}</p>
                        {ticket.adminNotes && (
                          <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2">
                            <p className="text-xs text-purple-300 font-medium mb-0.5">Admin Response</p>
                            <p className="text-xs text-white/70">{ticket.adminNotes}</p>
                          </div>
                        )}
                        <p className="text-xs text-white/30">
                          {new Date(ticket.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {ticket.status === "resolved" && ticket.resolvedAt && (
                            <span className="ml-2 text-green-400/60">
                              · Resolved {new Date(ticket.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* New ticket tab — full form matching original ContactFormDialog */}
            {supportTab === "new" && (
              <div className="p-5">
                {ticketSuccess ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-white font-semibold text-xl">Message Sent!</p>
                    <p className="text-white/50 text-sm mt-1">We'll get back to you as soon as possible.</p>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); submitTicket(); }}
                    className="space-y-4"
                  >
                    {/* Full Name */}
                    <div>
                      <Label htmlFor="ticket-fullname" className="text-white/70">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="ticket-fullname"
                        value={ticketFullName}
                        onChange={(e) => setTicketFullName(e.target.value)}
                        placeholder="John Doe"
                        className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                        autoFocus
                      />
                      {ticketErrors.fullName && <p className="text-xs text-red-500 mt-1">{ticketErrors.fullName}</p>}
                    </div>

                    {/* Email */}
                    <div>
                      <Label htmlFor="ticket-email" className="text-white/70">
                        Email Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="ticket-email"
                        type="email"
                        value={ticketEmail}
                        onChange={(e) => setTicketEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                      />
                    </div>

                    {/* Phone with country selector */}
                    <div>
                      <Label htmlFor="ticket-phone" className="text-white/70">Phone Number</Label>
                      <div className="mt-2 flex gap-2">
                        {/* Country dropdown */}
                        <div className="relative" ref={ticketCountryDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setTicketCountryDropdownOpen((prev) => !prev)}
                            className="flex items-center justify-between w-[140px] h-9 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 hover:bg-white/10 transition-colors"
                          >
                            <span className="truncate">
                              {(() => {
                                const sel = countryCodes.find((c) => c.code === ticketCountryCode);
                                return sel ? `${sel.flag} ${sel.code}` : ticketCountryCode;
                              })()}
                            </span>
                            <CaretDown className="w-3 h-3 text-white/50 shrink-0 ml-1" />
                          </button>
                          {ticketCountryDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-[280px] bg-[#222] border border-white/10 rounded-lg shadow-2xl z-[200] overflow-hidden">
                              <div className="p-2 border-b border-white/10 relative">
                                <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                <input
                                  className="w-full bg-white/5 border border-white/10 rounded-md py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                  placeholder="Search countries..."
                                  value={ticketCountrySearch}
                                  onChange={(e) => setTicketCountrySearch(e.target.value)}
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="max-h-[200px] overflow-y-auto p-1">
                                {countryCodes
                                  .filter(
                                    (c) =>
                                      !ticketCountrySearch.trim() ||
                                      c.country.toLowerCase().includes(ticketCountrySearch.toLowerCase()) ||
                                      c.code.includes(ticketCountrySearch),
                                  )
                                  .map((country) => (
                                    <button
                                      key={`${country.code}-${country.country}`}
                                      type="button"
                                      onClick={() => {
                                        setTicketCountryCode(country.code);
                                        setTicketCountryDropdownOpen(false);
                                        setTicketCountrySearch("");
                                        // Re-validate phone when country changes
                                        const err = validatePhoneForCountry(ticketPhone, country.code);
                                        setTicketErrors((prev) => err ? { ...prev, phone: err } : (() => { const { phone: _, ...rest } = prev; return rest; })());
                                      }}
                                      className={cn(
                                        "flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm text-white/90 hover:bg-white/10 transition-colors cursor-pointer text-left",
                                        country.code === ticketCountryCode && "bg-purple-500/20 text-white",
                                      )}
                                    >
                                      <span>{country.flag}</span>
                                      <span className="flex-1 truncate">{country.country}</span>
                                      <span className="text-white/50 text-xs">{country.code}</span>
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <Input
                          id="ticket-phone"
                          type="tel"
                          value={ticketPhone}
                          onChange={(e) => {
                            const rule = phoneDigitLengths[ticketCountryCode];
                            const maxLen = rule ? rule.max : 15;
                            const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, maxLen);
                            setTicketPhone(digitsOnly);
                            // Real-time validation
                            const err = validatePhoneForCountry(digitsOnly, ticketCountryCode);
                            setTicketErrors((prev) => err ? { ...prev, phone: err } : (() => { const { phone: _, ...rest } = prev; return rest; })());
                          }}
                          placeholder={(() => {
                            const rule = phoneDigitLengths[ticketCountryCode];
                            if (!rule) return "e.g. 501234567";
                            return rule.min === rule.max ? `${rule.min} digits required` : `${rule.min}-${rule.max} digits`;
                          })()}
                          className={cn(
                            "flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40",
                            ticketErrors.phone && "border-red-500/50 focus-visible:ring-red-500/30",
                          )}
                        />
                      </div>
                      {ticketErrors.phone && (
                        <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                          <Warning className="w-3 h-3 shrink-0" />
                          {ticketErrors.phone}
                        </p>
                      )}
                      {ticketPhone && !ticketErrors.phone && (
                        <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 shrink-0" />
                          Valid phone number
                        </p>
                      )}
                    </div>

                    {/* Company */}
                    <div>
                      <Label htmlFor="ticket-company" className="text-white/70">Company / Organization</Label>
                      <Input
                        id="ticket-company"
                        value={ticketCompany}
                        onChange={(e) => setTicketCompany(e.target.value)}
                        placeholder="Your Company"
                        className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                      />
                    </div>

                    {/* Subject */}
                    <div>
                      <Label htmlFor="ticket-subject" className="text-white/70">
                        Subject <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="ticket-subject"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="e.g., Technical Support, Billing Question, Feature Request"
                        className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <Label htmlFor="ticket-message" className="text-white/70">
                        Message <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="ticket-message"
                        value={ticketMessage}
                        onChange={(e) => setTicketMessage(e.target.value)}
                        placeholder="Tell us about your inquiry..."
                        className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40 min-h-[120px]"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowSupportPanel(false)}
                        disabled={isSubmittingTicket}
                        className="flex-1 border-white/10 text-white hover:bg-white/5"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          !ticketFullName.trim() ||
                          !ticketEmail.trim() ||
                          !ticketSubject.trim() ||
                          !ticketMessage.trim() ||
                          isSubmittingTicket ||
                          !!ticketErrors.phone
                        }
                        className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
                      >
                        {isSubmittingTicket ? (
                          <><SpinnerGap className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                        ) : (
                          <><PaperPlaneTilt className="w-4 h-4 mr-2" />Send Message</>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const ProjectSidebar = memo(ProjectSidebarComponent);
export default ProjectSidebar;
