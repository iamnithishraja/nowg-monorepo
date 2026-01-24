import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "./ui/sidebar";
import { Button } from "./ui/button";
import {
  MessageCircle,
  Plus,
  Home as HomeIcon,
  MoreHorizontal,
  Trash2,
  Edit2,
  Calendar,
  X,
  Sparkles,
  Brain,
  AlertTriangle,
  Loader2,
  Filter,
  ChevronDown,
  ChevronRight,
  Users,
  Building2,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { cn } from "../lib/utils";

interface Conversation {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  teamId?: string | null;
  teamName?: string | null;
  projectType?: "personal" | "team" | "organization";
  organizationId?: string | null;
  organizationName?: string | null;
}

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const { open, setOpen } = useSidebar();
  const openedByEdgeRef = useRef(false);
  const [persistentOpen, setPersistentOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingConversation, setEditingConversation] =
    useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] =
    useState<Conversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const [userWithAccess, setUserWithAccess] = useState<any>(null);
  const [sidebarContext, setSidebarContext] = useState<"personal" | "organization">("personal");

  // Ensure sidebarContext is properly typed for TypeScript
  const context: "personal" | "organization" = sidebarContext;

  // Helper function to determine if separator should be shown
  const shouldShowSeparator = () => {
    const hasContextConversations = context === "personal"
      ? Object.keys(groupedPersonalConversations).length > 0
      : Object.keys(groupedOrganizationConversations).length > 0;
    const hasVisibleTeamConversations = context === "personal" && Object.keys(groupedTeamConversations).length > 0;
    return hasContextConversations && hasVisibleTeamConversations;
  };

  const location = useLocation();
  const currentConversationId = new URLSearchParams(location.search).get(
    "conversationId"
  );

  // Fetch user access info
  useEffect(() => {
    const fetchUserAccess = async () => {
      try {
        const res = await fetch("/api/admin/me", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUserWithAccess(data);
          // Default to organization context for org_admins
          const isOrgAdmin = data?.role === "ORG_ADMIN" || data?.hasOrgAdminAccess === true;
          const defaultContext = isOrgAdmin ? "organization" : "personal";
          console.log("AppSidebar: Setting initial context to", defaultContext);
          setSidebarContext(defaultContext);
        }
      } catch (error) {
        console.error("Error fetching user access:", error);
      }
    };
    fetchUserAccess();
  }, []);

  // Check if user is org_admin
  const isOrgAdmin =
    userWithAccess?.role === "ORG_ADMIN" ||
    userWithAccess?.hasOrgAdminAccess === true;

  // Save context to localStorage and notify other components when it changes
  useEffect(() => {
    console.log("AppSidebar: Context changed to", sidebarContext);
    localStorage.setItem("web-sidebar-context", sidebarContext);
    // Dispatch custom event to notify other components in the same tab
    window.dispatchEvent(new CustomEvent("sidebarContextChange", { detail: sidebarContext }));
  }, [sidebarContext]);

  // Listen for conversation creation events
  useEffect(() => {
    const handleConversationCreated = () => {
      // Refetch conversations when a new one is created
      fetchConversations();
    };

    window.addEventListener("conversationCreated", handleConversationCreated);
    return () => window.removeEventListener("conversationCreated", handleConversationCreated);
  }, []);

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      setIsLoading(true);

      // Fetch personal and team conversations
      const response = await fetch("/api/conversations");
      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status}`);
      }
      const data = await response.json();

      // Fetch organization conversations
      let orgConversations: Conversation[] = [];
      let orgs: Array<{ id: string; name: string }> = [];
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
          orgConversations = (orgData.conversations || []).map((conv: any) => ({
            id: conv.id,
            title: conv.title,
            model: conv.model,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            lastMessageAt: conv.updatedAt,
            projectType: "organization" as const,
            organizationId: conv.organization?.id || null,
            organizationName: conv.organization?.name || null,
            teamId: null,
            teamName: null,
          }));
          orgs = orgData.organizations || [];
        }
      } catch (orgErr) {
        console.error("Error fetching organization conversations:", orgErr);
        // Don't fail the whole fetch if org conversations fail
      }

      // Combine all conversations
      setConversations([...(data.conversations || []), ...orgConversations]);
      setTeams(data.teams || []);
      setOrganizations(orgs);
      setError(null);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load conversations"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Update conversation title
  const updateTitle = async (conversationId: string, title: string) => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateTitle",
          conversationId,
          title,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update title");
      }

      // Update local state
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? { ...conv, title, updatedAt: new Date().toISOString() }
            : conv
        )
      );

      setEditingConversation(null);
      setNewTitle("");
    } catch (err) {
      console.error("Error updating title:", err);
      setError(err instanceof Error ? err.message : "Failed to update title");
    }
  };

  // Delete conversation
  const deleteConversation = async (conversationId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete conversation");
      }

      // Remove from local state
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId)
      );
      setDeleteDialogOpen(false);
      setConversationToDelete(null);

      // If we deleted the current conversation, navigate to home
      if (conversationId === currentConversationId) {
        window.location.href = "/home";
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Format relative time
  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return "Unknown";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";

    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  };

  // Separate personal, team, and organization conversations
  // Organization conversations should NOT appear in personal conversations
  const organizationConversations = conversations.filter(
    (c) => c.organizationId && c.projectType === "organization"
  );
  const teamConversations = conversations.filter(
    (c) => c.teamId && c.projectType === "team"
  );
  // Personal conversations exclude both team and organization conversations
  // Also exclude any conversation that has organizationId, even if projectType is not set
  const personalConversations = conversations.filter(
    (c) =>
      !c.teamId &&
      !c.organizationId &&
      c.projectType !== "organization" &&
      (c.projectType === "personal" || !c.projectType)
  );

  // Filter conversations
  const filteredPersonal = filterQuery
    ? personalConversations.filter((c) =>
        (c.title || "").toLowerCase().includes(filterQuery.trim().toLowerCase())
      )
    : personalConversations;

  const filteredTeam = filterQuery
    ? teamConversations.filter((c) =>
        (c.title || "").toLowerCase().includes(filterQuery.trim().toLowerCase())
      )
    : teamConversations;

  const filteredOrganization = filterQuery
    ? organizationConversations.filter((c) =>
        (c.title || "").toLowerCase().includes(filterQuery.trim().toLowerCase())
      )
    : organizationConversations;

  // Group personal conversations by date
  const groupedPersonalConversations = filteredPersonal.reduce(
    (groups, conversation) => {
      if (!conversation.lastMessageAt) {
        if (!groups["Older"]) {
          groups["Older"] = [];
        }
        groups["Older"].push(conversation);
        return groups;
      }

      const date = new Date(conversation.lastMessageAt);
      if (isNaN(date.getTime())) {
        if (!groups["Older"]) {
          groups["Older"] = [];
        }
        groups["Older"].push(conversation);
        return groups;
      }

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let groupKey: string;
      if (date.toDateString() === today.toDateString()) {
        groupKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = "Yesterday";
      } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
        groupKey = "This week";
      } else {
        groupKey = "Older";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(conversation);
      return groups;
    },
    {} as Record<string, Conversation[]>
  );

  // Group team conversations by team
  const groupedTeamConversations = filteredTeam.reduce(
    (groups, conversation) => {
      const teamKey = conversation.teamName || "Unknown Team";
      if (!groups[teamKey]) {
        groups[teamKey] = [];
      }
      groups[teamKey].push(conversation);
      return groups;
    },
    {} as Record<string, Conversation[]>
  );

  // Group organization conversations by organization
  const groupedOrganizationConversations = filteredOrganization.reduce(
    (groups, conversation) => {
      const orgKey = conversation.organizationName || "Unknown Organization";
      if (!groups[orgKey]) {
        groups[orgKey] = [];
      }
      groups[orgKey].push(conversation);
      return groups;
    },
    {} as Record<string, Conversation[]>
  );

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleEditClick = (conversation: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingConversation(conversation);
    setNewTitle(conversation.title);
  };

  const handleDeleteClick = (
    conversation: Conversation,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setConversationToDelete(conversation);
    setDeleteDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConversation && newTitle.trim()) {
      updateTitle(editingConversation.id, newTitle.trim());
    }
  };

  // Open on cursor touching the left screen edge
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (e.clientX <= 2) {
        openedByEdgeRef.current = true;
        setPersistentOpen(false);
        setOpen(true);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", handleMove, {
        passive: true,
      } as any);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("mousemove", handleMove as any);
      }
    };
  }, [setOpen]);

  // If opened programmatically (not via edge), keep it persistent
  useEffect(() => {
    if (open) {
      if (!openedByEdgeRef.current) {
        setPersistentOpen(true);
      }
    } else {
      setPersistentOpen(false);
      openedByEdgeRef.current = false;
    }
  }, [open]);

  return (
    <>
      {/* Edge activator rail to open on hover/touch at the very left edge */}
      <div
        aria-hidden
        className={cn(
          "fixed left-0 top-0 h-screen w-[4px] z-30 bg-linear-to-r from-primary/20 via-primary/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300",
          open && "hidden"
        )}
        onMouseEnter={() => {
          openedByEdgeRef.current = true;
          setPersistentOpen(false);
          setOpen(true);
        }}
        onTouchStart={() => {
          openedByEdgeRef.current = true;
          setPersistentOpen(false);
          setOpen(true);
        }}
      />

      <Sidebar
        collapsible="offcanvas"
        variant="sidebar"
        className={cn(
          "z-40 transition-all duration-300 ease-out",
          "border-r border-border/30 backdrop-blur-sm bg-background/95 shadow-2xl shadow-black/10",
          className
        )}
        onMouseEnter={() => {
          if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
          }
        }}
        onMouseLeave={() => {
          if (!persistentOpen) {
            if (closeTimeoutRef.current)
              window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = window.setTimeout(() => {
              setOpen(false);
              openedByEdgeRef.current = false;
            }, 250);
          }
        }}
      >
        <div className="flex flex-col h-full">
          <SidebarHeader className="bg-linear-to-b from-background/80 to-background/60 backdrop-blur-sm border-b border-border/30">
            <div className="flex items-center justify-between h-14 px-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-foreground">
                    Chat History
                  </h2>
                  <p className="text-[10px] text-muted-foreground/70">
                    Your conversations
                  </p>
                </div>
              </div>

              {/* Context Switcher for Org Admins */}
              {isOrgAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs gap-2 border-border/30 hover:bg-primary/5"
                    >
                      {context === "personal" ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Building2 className="h-3 w-3" />
                      )}
                      <span className="hidden sm:inline">
                        {context === "personal" ? "Personal" : "Organization"}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem
                      onClick={() => {
                        console.log("Dropdown: Setting context to personal");
                        setSidebarContext("personal");
                      }}
                      className="flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      Personal Projects
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        console.log("Dropdown: Setting context to organization");
                        setSidebarContext("organization");
                      }}
                      className="flex items-center gap-2"
                    >
                      <Building2 className="h-4 w-4" />
                      Organization Projects
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <div className="flex items-center gap-1">
                {/* Filter button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-primary/10 transition-colors duration-200"
                      title="Filter"
                    >
                      <Filter className="h-4 w-4" />
                      <span className="sr-only">Filter conversations</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-64 rounded-lg border-border/50 bg-background/95 backdrop-blur-xl p-3"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="chat-filter" className="text-xs">
                        Filter by title
                      </Label>
                      <Input
                        id="chat-filter"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="Type to filter…"
                        className="h-8"
                      />
                      {filterQuery ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setFilterQuery("")}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 w-8 p-0 hover:bg-primary/10 transition-colors duration-200"
                  title="Home"
                >
                  <Link to="/home">
                    <HomeIcon className="h-4 w-4" />
                    <span className="sr-only">Home</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 w-8 p-0 hover:bg-primary/10 transition-colors duration-200"
                  title="New chat"
                >
                  <Link to="/home">
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">New chat</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-destructive/10 transition-colors duration-200"
                  title="Close sidebar"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close sidebar</span>
                </Button>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="flex-1 px-1 py-2 overflow-y-auto overflow-x-hidden">
            {/* Home navigation row */}
            <div className="mb-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link to="/home">
                    <SidebarMenuButton
                      className={cn(
                        "group rounded-xl h-10 hover:bg-muted/50 px-2 py-3 transition-all duration-200 ease-out hover:scale-[1.02] shadow-sm hover:shadow-md"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 transition-colors duration-200">
                          <HomeIcon className="h-4 w-4 text-primary/80 group-hover:text-primary transition-colors duration-200" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors duration-200">
                            Home
                          </div>
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center animate-pulse">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium">
                    Loading conversations...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-destructive text-sm bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </div>
                  <p>{error}</p>
                </div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-linear-to-br from-muted/30 to-muted/10 flex items-center justify-center border border-muted/20">
                    <MessageCircle className="h-6 w-6 opacity-50" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground/70">
                      No conversations yet
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground/60">
                      Start a new chat to see it here
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pb-4 min-h-0">
                {/* Organizations Section - Only show when in organization context */}
                {context === "organization" && Object.keys(groupedOrganizationConversations).length > 0 && (
                  <>
                    <SidebarGroup>
                      <SidebarGroupLabel className="px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold bg-linear-to-r from-transparent via-muted/20 to-transparent flex items-center gap-2">
                        <Building2 className="h-3 w-3" />
                        Organizations
                      </SidebarGroupLabel>
                      <SidebarGroupContent className="space-y-1 mt-2">
                        {Object.entries(groupedOrganizationConversations).map(
                          ([orgName, orgConversations]) => {
                            const orgId = orgConversations[0]?.organizationId;
                            const orgKey = `org-${orgId || orgName}`;
                            return (
                              <SidebarGroup key={orgKey}>
                                <SidebarGroupLabel className="px-1 py-1 text-[11px] font-medium text-muted-foreground/70 flex items-center justify-between">
                                  <button
                                    className="flex items-center gap-1.5 hover:text-foreground/80 transition-colors"
                                    onClick={() =>
                                      setCollapsedGroups((prev) => ({
                                        ...prev,
                                        [orgKey]: !prev[orgKey],
                                      }))
                                    }
                                    aria-label={`${
                                      collapsedGroups[orgKey]
                                        ? "Expand"
                                        : "Collapse"
                                    } ${orgName}`}
                                  >
                                    {collapsedGroups[orgKey] ? (
                                      <ChevronRight className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                    <span className="truncate">{orgName}</span>
                                  </button>
                                  <span className="text-[10px] text-muted-foreground/60">
                                    {orgConversations.length}
                                  </span>
                                </SidebarGroupLabel>
                                {!collapsedGroups[orgKey] ? (
                                  <SidebarGroupContent className="space-y-1 ml-2 pl-2 border-l border-border/30">
                                    <SidebarMenu>
                                      {orgConversations.map((conversation) => (
                                        <SidebarMenuItem key={conversation.id}>
                                          <Link
                                            to={`/workspace?conversationId=${conversation.id}`}
                                          >
                                            <SidebarMenuButton
                                              isActive={
                                                conversation.id ===
                                                currentConversationId
                                              }
                                              className={cn(
                                                "group rounded-lg h-9 data-[active=true]:bg-primary/10 data-[active=true]:border data-[active=true]:border-primary/20 hover:bg-muted/50 px-2 py-2 transition-all duration-200 ease-out hover:scale-[1.01] shadow-sm hover:shadow-md data-[active=true]:scale-[1.01]"
                                              )}
                                              title={
                                                conversation.title ||
                                                "Untitled Conversation"
                                              }
                                            >
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className="w-6 h-6 rounded-md bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 transition-colors duration-200">
                                                  <MessageCircle className="h-3 w-3 text-primary/80 group-hover:text-primary transition-colors duration-200" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="truncate text-xs font-medium text-foreground/90 group-hover:text-foreground transition-colors duration-200">
                                                    {conversation.title ||
                                                      "Untitled Conversation"}
                                                  </div>
                                                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                                    {formatTimeAgo(
                                                      conversation.lastMessageAt
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </SidebarMenuButton>
                                          </Link>
                                        </SidebarMenuItem>
                                      ))}
                                    </SidebarMenu>
                                  </SidebarGroupContent>
                                ) : null}
                              </SidebarGroup>
                            );
                          }
                        )}
                      </SidebarGroupContent>
                    </SidebarGroup>
                    {shouldShowSeparator() ? (
                      <SidebarSeparator className="my-2 opacity-50" />
                    ) : null}
                  </>
                )}

                {/* Personal Conversations - Only show when in personal context */}
                {context === "personal" && Object.keys(groupedPersonalConversations).length > 0 && (
                  <>
                    {Object.entries(groupedPersonalConversations).map(
                      ([groupName, groupConversations]) => (
                        <SidebarGroup key={groupName}>
                          <SidebarGroupLabel className="px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold bg-linear-to-r from-transparent via-muted/20 to-transparent flex items-center justify-between">
                            <button
                              className="flex items-center gap-1 hover:text-foreground/80 transition-colors"
                              onClick={() =>
                                setCollapsedGroups((prev) => ({
                                  ...prev,
                                  [groupName]: !prev[groupName],
                                }))
                              }
                              aria-label={`${
                                collapsedGroups[groupName]
                                  ? "Expand"
                                  : "Collapse"
                              } ${groupName}`}
                            >
                              {collapsedGroups[groupName] ? (
                                <ChevronRight className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              {groupName}
                            </button>
                            <span className="text-[10px] text-muted-foreground/60">
                              {groupConversations.length}
                            </span>
                          </SidebarGroupLabel>
                          {!collapsedGroups[groupName] ? (
                            <SidebarGroupContent className="space-y-2">
                              <SidebarMenu>
                                {groupConversations.map((conversation) => (
                                  <SidebarMenuItem key={conversation.id}>
                                    <Link
                                      to={`/workspace?conversationId=${conversation.id}`}
                                    >
                                      <SidebarMenuButton
                                        isActive={
                                          conversation.id ===
                                          currentConversationId
                                        }
                                        className={cn(
                                          "group rounded-xl h-10 data-[active=true]:bg-primary/10 data-[active=true]:border data-[active=true]:border-primary/20 hover:bg-muted/50 px-2 py-3 transition-all duration-200 ease-out hover:scale-[1.02] data-[active=true]:scale-[1.02] shadow-sm hover:shadow-md data-[active=true]:shadow-md"
                                        )}
                                        title={
                                          conversation.title ||
                                          "Untitled Conversation"
                                        }
                                      >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 transition-colors duration-200">
                                            <MessageCircle className="h-4 w-4 text-primary/80 group-hover:text-primary transition-colors duration-200" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="truncate text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors duration-200">
                                              {conversation.title ||
                                                "Untitled Conversation"}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                              {formatTimeAgo(
                                                conversation.lastMessageAt
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-background/80 rounded-lg transition-all duration-200 scale-95 group-hover:scale-100"
                                              onClick={(e) =>
                                                e.preventDefault()
                                              }
                                            >
                                              <MoreHorizontal className="h-3 w-3" />
                                              <span className="sr-only">
                                                More options
                                              </span>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent
                                            align="end"
                                            className="w-48 rounded-lg border-border/50 bg-background/95 backdrop-blur-xl shadow-lg shadow-black/10"
                                          >
                                            <DropdownMenuItem
                                              onClick={(e) =>
                                                handleEditClick(conversation, e)
                                              }
                                              className="rounded-md hover:bg-muted/50 transition-colors duration-150 focus:bg-muted/50 py-2 px-3 cursor-pointer"
                                            >
                                              <Edit2 className="h-4 w-4 mr-3 text-muted-foreground/60" />
                                              <span className="text-sm">
                                                Rename
                                              </span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={(e) =>
                                                handleDeleteClick(
                                                  conversation,
                                                  e
                                                )
                                              }
                                              className="text-destructive focus:text-destructive focus:bg-destructive/5 rounded-md transition-colors duration-150 py-2 px-3 cursor-pointer"
                                            >
                                              <Trash2 className="h-4 w-4 mr-3" />
                                              <span className="text-sm">
                                                Delete
                                              </span>
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </SidebarMenuButton>
                                    </Link>
                                  </SidebarMenuItem>
                                ))}
                              </SidebarMenu>
                            </SidebarGroupContent>
                          ) : null}
                        </SidebarGroup>
                      )
                    )}
                  </>
                )}

                {/* Teams Section - Only show when in personal context */}
                {context === "personal" && Object.keys(groupedTeamConversations).length > 0 && (
                  <>
                    {Object.keys(groupedPersonalConversations).length > 0 ? (
                      <SidebarSeparator className="my-2 opacity-50" />
                    ) : null}
                    <SidebarGroup>
                      <SidebarGroupLabel className="px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold bg-linear-to-r from-transparent via-muted/20 to-transparent flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        Teams
                      </SidebarGroupLabel>
                      <SidebarGroupContent className="space-y-1 mt-2">
                        {Object.entries(groupedTeamConversations).map(
                          ([teamName, teamConversations]) => {
                            const teamId = teamConversations[0]?.teamId;
                            const teamKey = `team-${teamId || teamName}`;
                            return (
                              <SidebarGroup key={teamKey}>
                                <SidebarGroupLabel className="px-1 py-1 text-[11px] font-medium text-muted-foreground/70 flex items-center justify-between">
                                  <button
                                    className="flex items-center gap-1.5 hover:text-foreground/80 transition-colors"
                                    onClick={() =>
                                      setCollapsedGroups((prev) => ({
                                        ...prev,
                                        [teamKey]: !prev[teamKey],
                                      }))
                                    }
                                    aria-label={`${
                                      collapsedGroups[teamKey]
                                        ? "Expand"
                                        : "Collapse"
                                    } ${teamName}`}
                                  >
                                    {collapsedGroups[teamKey] ? (
                                      <ChevronRight className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                    <span className="truncate">{teamName}</span>
                                  </button>
                                  <span className="text-[10px] text-muted-foreground/60">
                                    {teamConversations.length}
                                  </span>
                                </SidebarGroupLabel>
                                {!collapsedGroups[teamKey] ? (
                                  <SidebarGroupContent className="space-y-1 ml-2 pl-2 border-l border-border/30">
                                    <SidebarMenu>
                                      {teamConversations.map((conversation) => (
                                        <SidebarMenuItem key={conversation.id}>
                                          <Link
                                            to={`/workspace?conversationId=${conversation.id}`}
                                          >
                                            <SidebarMenuButton
                                              isActive={
                                                conversation.id ===
                                                currentConversationId
                                              }
                                              className={cn(
                                                "group rounded-lg h-9 data-[active=true]:bg-primary/10 data-[active=true]:border data-[active=true]:border-primary/20 hover:bg-muted/50 px-2 py-2 transition-all duration-200 ease-out hover:scale-[1.01] shadow-sm hover:shadow-md data-[active=true]:scale-[1.01]"
                                              )}
                                              title={
                                                conversation.title ||
                                                "Untitled Conversation"
                                              }
                                            >
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className="w-6 h-6 rounded-md bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 transition-colors duration-200">
                                                  <MessageCircle className="h-3 w-3 text-primary/80 group-hover:text-primary transition-colors duration-200" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="truncate text-xs font-medium text-foreground/90 group-hover:text-foreground transition-colors duration-200">
                                                    {conversation.title ||
                                                      "Untitled Conversation"}
                                                  </div>
                                                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                                    {formatTimeAgo(
                                                      conversation.lastMessageAt
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-background/80 rounded-lg transition-all duration-200 scale-95 group-hover:scale-100"
                                                    onClick={(e) =>
                                                      e.preventDefault()
                                                    }
                                                  >
                                                    <MoreHorizontal className="h-3 w-3" />
                                                    <span className="sr-only">
                                                      More options
                                                    </span>
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                  align="end"
                                                  className="w-48 rounded-lg border-border/50 bg-background/95 backdrop-blur-xl shadow-lg shadow-black/10"
                                                >
                                                  <DropdownMenuItem
                                                    onClick={(e) =>
                                                      handleEditClick(
                                                        conversation,
                                                        e
                                                      )
                                                    }
                                                    className="rounded-md transition-colors duration-150 py-2 px-3 cursor-pointer"
                                                  >
                                                    <Edit2 className="h-4 w-4 mr-3" />
                                                    <span className="text-sm">
                                                      Rename
                                                    </span>
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={(e) =>
                                                      handleDeleteClick(
                                                        conversation,
                                                        e
                                                      )
                                                    }
                                                    className="text-destructive focus:text-destructive focus:bg-destructive/5 rounded-md transition-colors duration-150 py-2 px-3 cursor-pointer"
                                                  >
                                                    <Trash2 className="h-4 w-4 mr-3" />
                                                    <span className="text-sm">
                                                      Delete
                                                    </span>
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </SidebarMenuButton>
                                          </Link>
                                        </SidebarMenuItem>
                                      ))}
                                    </SidebarMenu>
                                  </SidebarGroupContent>
                                ) : null}
                              </SidebarGroup>
                            );
                          }
                        )}
                      </SidebarGroupContent>
                    </SidebarGroup>
                  </>
                )}

                {/* Show message if no conversations match filter */}
                {((context === "personal" &&
                   Object.keys(groupedPersonalConversations).length === 0 &&
                   Object.keys(groupedTeamConversations).length === 0) ||
                  (context === "organization" &&
                   Object.keys(groupedOrganizationConversations).length === 0)) && (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {filterQuery
                        ? "No conversations match your filter."
                        : context === "personal"
                        ? "No personal conversations yet."
                        : "No organization conversations yet."}
                    </div>
                  )}
              </div>
            )}
          </SidebarContent>
        </div>
      </Sidebar>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingConversation}
        onOpenChange={(open) => {
          if (!open) {
            setEditingConversation(null);
            setNewTitle("");
          }
        }}
      >
        <DialogContent className="p-px rounded-2xl bg-linear-to-b from-white/15 via-white/5 to-transparent sm:max-w-[450px]">
          <div className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
            <form onSubmit={handleEditSubmit}>
              <DialogHeader className="space-y-3 pb-4 px-6 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                    <Edit2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-semibold">
                      Rename conversation
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground/80">
                      Enter a new name for this conversation.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 px-6 pb-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="title"
                    className="text-sm font-medium text-foreground/90"
                  >
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="border-border/50 focus:border-primary/50 bg-background/60 focus:bg-background/80 transition-colors duration-200"
                    placeholder="Enter new title..."
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 px-6 pb-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingConversation(null);
                    setNewTitle("");
                  }}
                  className="hover:bg-muted/50 border-border/50 transition-colors duration-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Save
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="p-px rounded-2xl bg-linear-to-b from-white/15 via-white/5 to-transparent max-w-md">
          <div className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
            <DialogHeader className="pb-4 px-6 pt-6">
              <DialogTitle className="text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Delete Conversation
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-4">
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  "{conversationToDelete?.title || "Untitled Conversation"}"
                </span>
                ? This action cannot be undone and will permanently remove the
                conversation and all its messages.
              </DialogDescription>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Warning: This action is irreversible
                </p>
              </div>
            </div>
            <DialogFooter className="px-6 pb-6 gap-3">
              <Button
                variant="outline"
                className="border-border/50 hover:bg-muted/50"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  conversationToDelete &&
                  deleteConversation(conversationToDelete.id)
                }
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-md hover:shadow-lg transition-all duration-200 px-3 py-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Conversation
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
