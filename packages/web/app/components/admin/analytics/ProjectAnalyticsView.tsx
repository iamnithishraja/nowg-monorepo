import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CurrencyDollar,
  Download,
  FolderSimple,
  Hash,
  ClockCounterClockwise,
  ChatCircle,
  ArrowClockwise,
  UserPlus,
  Users,
  Wallet,
  X,
} from "@phosphor-icons/react";
import { MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useToast } from "~/hooks/use-toast";
import { adminClient } from "~/lib/adminClient";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Skeleton } from "../../ui/skeleton";
import { AddMemberDialog } from "./AddMemberDialog";
import { AnalyticsCard } from "./AnalyticsCard";
import { DailyUsageChartCompact, ModelUsageChartCompact } from "./AnalyticsChart";
import { useProjectAnalytics } from "./hooks";
import { ManageCreditsDialog } from "./ManageCreditsDialog";
import { ProjectCreditsCompact } from "./ProjectCreditsSection";
import { RemoveMemberDialog } from "./RemoveMemberDialog";
import { TeamMembersTable, type TeamMemberRow } from "./TeamMembersTable";
import { TransactionHistoryDialog } from "./TransactionHistoryDialog";
import { UserCreditLimitDialog } from "./UserCreditLimitDialog";

interface Project {
  id: string;
  name: string;
  organizationId?: string;
}

interface AvailableUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface ProjectAnalyticsViewProps {
  projects?: Project[];
  defaultProjectId?: string;
  projectId?: string;
  isOrgAdmin?: boolean;
}

export function ProjectAnalyticsView({
  projects = [],
  defaultProjectId,
  projectId: propProjectId,
  isOrgAdmin = false,
}: ProjectAnalyticsViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const initialProjectId =
    propProjectId || defaultProjectId || projects?.[0]?.id || "";

  const [selectedProjectId, setSelectedProjectId] =
    useState<string>(initialProjectId);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!!initialProjectId);
  const [error, setError] = useState<any>(null);

  // Filter states for team table
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [manageCreditsDialogOpen, setManageCreditsDialogOpen] = useState(false);
  const [userCreditLimitDialogOpen, setUserCreditLimitDialogOpen] = useState(false);
  const [transactionHistoryDialogOpen, setTransactionHistoryDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMemberRow | null>(null);
  const [transactionPage, setTransactionPage] = useState(1);

  // Function to refetch analytics data
  const refetchAnalytics = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const result = await useProjectAnalytics(selectedProjectId);
      setData(result);
    } catch (err) {
      console.error("Error refetching analytics:", err);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (propProjectId && propProjectId !== selectedProjectId) {
      setSelectedProjectId(propProjectId);
    } else if (defaultProjectId && !selectedProjectId) {
      setSelectedProjectId(defaultProjectId);
    }
  }, [propProjectId, defaultProjectId, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await useProjectAnalytics(selectedProjectId);
        setData(result);
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedProjectId]);

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  // Fallback: Fetch project data directly if not in projects array
  const { data: projectDetailData } = useQuery({
    queryKey: ["/api/admin/projects/:projectId", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      try {
        const data = await adminClient.get<{ project: Project }>(
          `/api/admin/projects/${selectedProjectId}`
        );
        return data?.project || null;
      } catch (err) {
        console.error("Error fetching project details:", err);
        return null;
      }
    },
    enabled: !!(selectedProjectId && !selectedProject),
  });

  // Use selectedProject from props, or fallback to fetched project detail
  const effectiveSelectedProject = selectedProject || projectDetailData;

  // Fetch available users for adding to project
  const { data: availableUsersData, isLoading: isLoadingAvailableUsers } =
    useQuery({
      queryKey: [
        "/api/admin/organizations/:organizationId/available-users",
        effectiveSelectedProject?.organizationId,
      ],
      queryFn: async () => {
        if (!effectiveSelectedProject?.organizationId) {
          return { users: [] };
        }
        try {
          const data = await adminClient.get<{
            users: Array<{ id: string; email: string; name: string; role: string }>;
            organization?: { id: string; name: string };
          }>(
            `/api/admin/organizations/${effectiveSelectedProject.organizationId}/available-users`,
            {
              params: {
                projectId: effectiveSelectedProject?.id,
              },
            }
          );
          return data || { users: [] };
        } catch (err) {
          console.error("Error fetching available users:", err);
          return { users: [] };
        }
      },
      enabled: !!(
        effectiveSelectedProject?.organizationId &&
        effectiveSelectedProject?.id &&
        addMemberDialogOpen
      ),
    });

  const organizationId = effectiveSelectedProject?.organizationId || data?.organizationId;

  // Fetch organization wallet for transfers
  const { data: orgWalletData } = useQuery<{ wallet: { balance: number } }>({
    queryKey: ["/api/admin/org-wallets", organizationId],
    queryFn: async () => {
      if (!organizationId) return { wallet: { balance: 0 } };
      const data = await adminClient.get<{ wallet: { balance: number } }>(
        `/api/admin/org-wallets/${organizationId}`
      );
      return data || { wallet: { balance: 0 } };
    },
    enabled: !!(organizationId && manageCreditsDialogOpen),
  });

  // Fetch user-specific credit limits for the project
  const { data: userWalletsData, refetch: refetchUserWallets } = useQuery<{
    wallets: Array<{
      userId: string;
      limit: number | null;
      currentSpending: number;
    }>;
  }>({
    queryKey: ["/api/admin/user-project-wallets/project", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return { wallets: [] };
      const data = await adminClient.get<{
        wallets: Array<{
          userId: string;
          limit: number | null;
          currentSpending: number;
        }>;
      }>(`/api/admin/user-project-wallets/project/${selectedProjectId}`);
      return data || { wallets: [] };
    },
    enabled: !!selectedProjectId,
  });

  // Fetch transaction history
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery<{
    transactions: Transaction[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>({
    queryKey: ["/api/admin/project-wallets/:projectId/transactions", selectedProjectId, transactionPage],
    queryFn: async () => {
      if (!selectedProjectId) return { transactions: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } };
      const data = await adminClient.get<{
        transactions: Transaction[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/api/admin/project-wallets/${selectedProjectId}/transactions`, {
        params: { page: transactionPage, limit: 10 },
      });
      return data || { transactions: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } };
    },
    enabled: !!(selectedProjectId && transactionHistoryDialogOpen),
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return adminClient.post(`/api/admin/projects/${selectedProjectId}/members`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/project", selectedProjectId] });
      toast({ title: "Success", description: "Member added to project successfully" });
      setAddMemberDialogOpen(false);
      refetchAnalytics();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add member", variant: "destructive" });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const membersData = await adminClient.get<{ members: { id: string; userId: string }[] }>(
        `/api/admin/projects/${selectedProjectId}/members`
      );
      const memberDoc = membersData.members.find((m) => m.userId === memberId);
      if (!memberDoc) throw new Error("Member not found");
      return adminClient.delete(`/api/admin/projects/${selectedProjectId}/members/${memberDoc.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/project", selectedProjectId] });
      toast({ title: "Success", description: "Member removed from project successfully" });
      setRemoveMemberDialogOpen(false);
      setSelectedMember(null);
      refetchAnalytics();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to remove member", variant: "destructive" });
    },
  });

  // Transfer credits mutation
  const transferCreditsMutation = useMutation({
    mutationFn: async ({ amount, description }: { amount: number; description?: string }) => {
      return adminClient.post(`/api/admin/project-wallets/${selectedProjectId}/transfer-from-org`, {
        amount,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/project-wallets", selectedProjectId] });
      toast({ title: "Success", description: "Credits transferred successfully" });
      setManageCreditsDialogOpen(false);
      refetchAnalytics();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to transfer credits", variant: "destructive" });
    },
  });

  // Request credits mutation
  const requestCreditsMutation = useMutation({
    mutationFn: async ({ amount, description }: { amount: number; description?: string }) => {
      return adminClient.post(`/api/admin/fund-requests`, {
        projectId: selectedProjectId,
        amount,
        description,
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Credit request submitted successfully" });
      setManageCreditsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to submit request", variant: "destructive" });
    },
  });

  // Credit back to org mutation
  const creditBackToOrgMutation = useMutation({
    mutationFn: async ({ amount, description }: { amount: number; description?: string }) => {
      return adminClient.post(`/api/admin/project-wallets/${selectedProjectId}/credit-back-to-org`, {
        amount,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/project-wallets", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/org-wallets", organizationId] });
      toast({ title: "Success", description: "Credits returned to organization successfully" });
      setManageCreditsDialogOpen(false);
      refetchAnalytics();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to credit back to organization", variant: "destructive" });
    },
  });

  // Set user credit limit mutation
  const setUserLimitMutation = useMutation({
    mutationFn: async ({ userId, limit }: { userId: string; limit: number | null }) => {
      return adminClient.put(`/api/admin/user-project-wallets/${selectedProjectId}/${userId}/set-limit`, { limit });
    },
    onSuccess: async () => {
      // Immediately refetch user wallets and analytics data
      await Promise.all([
        refetchUserWallets(),
        refetchAnalytics()
      ]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/project", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-project-wallets/project", selectedProjectId] });
      toast({ title: "Success", description: "Credit limit updated successfully" });
      setUserCreditLimitDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to set credit limit", variant: "destructive" });
    },
  });

  // Reset user spending mutation
  const resetUserSpendingMutation = useMutation({
    mutationFn: async (userId: string) => {
      return adminClient.post(`/api/admin/user-project-wallets/${selectedProjectId}/${userId}/reset-spending`);
    },
    onSuccess: async () => {
      await Promise.all([
        refetchUserWallets(),
        refetchAnalytics()
      ]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/project", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-project-wallets/project", selectedProjectId] });
      toast({ title: "Success", description: "User spending reset successfully" });
      setUserCreditLimitDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to reset spending", variant: "destructive" });
    },
  });

  // Transform user breakdown to TeamMemberRow format
  const teamMembers: TeamMemberRow[] = useMemo(() => {
    if (!data?.userBreakdown) return [];

    const roleDisplayMap: Record<string, "Org Admin" | "Project Admin" | "User"> = {
      org_admin: "Org Admin",
      project_admin: "Project Admin",
      member: "User",
      developer: "User",
      contributor: "User",
    };

    const userLimitsMap = new Map<string, { limit: number | null; currentSpending: number }>();
    userWalletsData?.wallets?.forEach((wallet: any) => {
      userLimitsMap.set(wallet.userId, {
        limit: wallet.limit,
        currentSpending: wallet.currentSpending,
      });
    });

    return data.userBreakdown.map((user: any) => {
      const userLimit = userLimitsMap.get(user.userId);
      const creditsUsed = parseFloat(user.cost) || 0;
      const creditsMax = userLimit?.limit ?? (data?.wallet?.creditLimit || 0);

      return {
        id: user.userId,
        name: user.name || user.email || "Unknown User",
        email: user.email || "",
        avatar: user.avatar || "",
        role: roleDisplayMap[user.role] || "User",
        creditsUsed: creditsUsed,
        creditsMax: creditsMax,
        tokens: user.tokens || 0,
        tokensUsed: parseFloat(user.cost) || 0,
        lastAction: user.conversations > 0 ? "Edited" : "Viewed",
        lastActionDate: new Date().toISOString(),
      };
    });
  }, [data?.userBreakdown, userWalletsData?.wallets, data?.wallet?.creditLimit]);

  // Filter team members based on search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return teamMembers;
    const query = searchQuery.toLowerCase();
    return teamMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [teamMembers, searchQuery]);

  // Prepare credits section data
  const creditsData = useMemo(() => {
    if (!data) {
      return {
        available: 0,
        used: 0,
        categories: [],
      };
    }

    const totalCost = parseFloat(data.totalCost) || 0;
    const totalPrimaryCost = data.modelUsage?.reduce((sum: number, model: any) => sum + model.cost, 0) || 0;
    const colors = ["#3b82f6", "#22c55e", "#f97316"];
    const categories = [
      {
        name: "Primary Tokens",
        percentage: 100,
        amount: totalPrimaryCost,
        color: colors[0],
      },
      {
        name: "Database Tokens",
        percentage: 0,
        amount: 0,
        color: colors[1],
      },
      {
        name: "Deployment Tokens",
        percentage: 0,
        amount: 0,
        color: colors[2],
      },
    ];

    return {
      available: data?.wallet?.creditLimit || data?.wallet?.balance || 0,
      used: totalCost,
      categories,
    };
  }, [data]);

  const handleMemberClick = (member: TeamMemberRow) => {
    console.log("Member clicked:", member);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    const member = teamMembers.find((m) => m.id === memberId);
    if (member) {
      setSelectedMember(member);
      setRemoveMemberDialogOpen(true);
    }
  };

  const handleManageCredits = (member: TeamMemberRow) => {
    setSelectedMember(member);
    setUserCreditLimitDialogOpen(true);
  };

  const handleRefill = (member: TeamMemberRow) => {
    setSelectedMember(member);
    setUserCreditLimitDialogOpen(true);
  };

  const handleExport = () => {
    const headers = ["Name", "Email", "Role", "Credits Used", "Credits Max", "Tokens", "Last Action"];
    const rows = filteredMembers.map((m) => [
      m.name,
      m.email,
      m.role,
      m.creditsUsed.toFixed(2),
      m.creditsMax.toFixed(2),
      m.tokens,
      m.lastAction,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `project-team-${selectedProjectId}-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[280px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <Card className="bg-surface-1 border-subtle">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4">
            <X className="size-12 text-[#ef4444]" weight="bold" />
            <p className="text-center text-secondary">
              Failed to load analytics. Please try again.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/projects")}
              className="gap-2"
            >
              <ArrowLeft className="size-4" weight="bold" />
              Back to Projects
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header with Back Button */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/projects")}
            className="h-9 w-9 rounded-lg bg-surface-2 border border-subtle hover:bg-surface-3 hover:border-accent-primary/30 transition-all"
          >
            <ArrowLeft className="h-4 w-4 text-secondary" weight="bold" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-primary tracking-tight">
              {data?.projectName || effectiveSelectedProject?.name || "Project Analytics"}
            </h1>
            <p className="text-sm text-tertiary mt-0.5">
              Track team activity, usage patterns, and deployment metrics
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {projects.length > 1 && (
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger className="w-[200px] bg-surface-2 border-subtle text-primary h-9">
                <FolderSimple className="h-4 w-4 mr-2 text-accent-primary" weight="fill" />
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent className="bg-surface-1 border-subtle">
                {projects.map((project) => (
                  <SelectItem
                    key={project.id}
                    value={project.id}
                    className="text-primary focus:bg-surface-2 focus:text-primary"
                  >
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={refetchAnalytics}
            className="h-9 w-9 rounded-lg hover:bg-surface-2"
          >
            <ArrowClockwise className="h-4 w-4 text-secondary" />
          </Button>
        </div>
      </div>

      {/* Key Metrics - 5 columns */}
      <div className="grid gap-4 grid-cols-5">
        <AnalyticsCard
          title="Total Cost"
          value={`$${data.totalCost}`}
          icon={CurrencyDollar}
          description="Total spending"
          bgColor="bg-rose-500/10"
          iconColor="text-rose-400"
        />
        <AnalyticsCard
          title="Total Tokens"
          value={data.totalTokens.toLocaleString()}
          icon={Hash}
          description="Tokens consumed"
          bgColor="bg-sky-500/10"
          iconColor="text-sky-400"
        />
        <AnalyticsCard
          title="Total Messages"
          value={data.totalMessages.toLocaleString()}
          icon={ChatCircle}
          description="Messages sent"
          bgColor="bg-emerald-500/10"
          iconColor="text-emerald-400"
        />
        <AnalyticsCard
          title="Conversations"
          value={data.totalConversations.toLocaleString()}
          icon={FolderSimple}
          description="Total conversations"
          bgColor="bg-violet-500/10"
          iconColor="text-violet-400"
        />
        <AnalyticsCard
          title="Team Members"
          value={data.totalUsers.toLocaleString()}
          icon={Users}
          description="Active users"
          bgColor="bg-amber-500/10"
          iconColor="text-amber-400"
        />
      </div>

      {/* Credits + Charts Row - 3 columns */}
      <div className="grid gap-4 grid-cols-3">
        {/* Project Credits Card */}
        <Card className="bg-gradient-to-br from-surface-1 to-surface-2/50 border-subtle overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-accent-primary" />
                </div>
                <span className="text-sm font-medium text-primary">Project Credits</span>
              </div>
            </div>
            
            <ProjectCreditsCompact
              creditsAvailable={creditsData.available}
              creditsUsed={creditsData.used}
              tokenCategories={creditsData.categories}
            />

            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-subtle">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManageCreditsDialogOpen(true)}
                className="w-full h-8 text-xs border-subtle hover:bg-surface-3 hover:border-accent-primary/30"
              >
                <Wallet className="h-3.5 w-3.5 mr-1.5" />
                Manage Credits
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTransactionHistoryDialogOpen(true)}
                className="w-full h-8 text-xs border-subtle hover:bg-surface-3 hover:border-accent-primary/30"
              >
                <ClockCounterClockwise className="h-3.5 w-3.5 mr-1.5" weight="fill" />
                Transactions
              </Button>
            </div>
          </div>
        </Card>

        {/* Daily Usage Chart - Compact */}
        <Card className="bg-surface-1 border-subtle overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-sky-400" />
              </div>
              <span className="text-sm font-medium text-primary">Daily Activity</span>
            </div>
            {data.dailyUsage && data.dailyUsage.length > 0 ? (
              <DailyUsageChartCompact data={data.dailyUsage} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-center">
                <MessageSquare className="h-10 w-10 text-tertiary mb-3 opacity-40" />
                <p className="text-sm text-secondary">No activity yet</p>
                <p className="text-xs text-tertiary mt-1">Start using to see analytics</p>
              </div>
            )}
          </div>
        </Card>

        {/* Model Usage Chart - Compact */}
        <Card className="bg-surface-1 border-subtle overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Hash className="h-4 w-4 text-violet-400" />
              </div>
              <span className="text-sm font-medium text-primary">Model Usage</span>
            </div>
            {data.modelUsage && data.modelUsage.length > 0 ? (
              <ModelUsageChartCompact data={data.modelUsage} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-center">
                <Hash className="h-10 w-10 text-tertiary mb-3 opacity-40" />
                <p className="text-sm text-secondary">No model usage yet</p>
                <p className="text-xs text-tertiary mt-1">AI usage will appear here</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Team Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-sm font-medium text-primary">Team Members</span>
            <span className="text-xs text-tertiary ml-1">({teamMembers.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              className="h-8 text-xs text-secondary hover:text-primary"
            >
              <Download className="size-3.5 mr-1.5" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => setAddMemberDialogOpen(true)}
              className="h-8 text-xs bg-accent-primary hover:bg-accent-primary/90"
            >
              <UserPlus className="size-3.5 mr-1.5" />
              Add Member
            </Button>
          </div>
        </div>

        <TeamMembersTable
          members={filteredMembers}
          onMemberClick={handleMemberClick}
          onRefill={handleRefill}
          onRemoveMember={handleRemoveMember}
          onManageCredits={handleManageCredits}
        />
      </div>

      {/* Dialogs */}
      <AddMemberDialog
        open={addMemberDialogOpen}
        onOpenChange={setAddMemberDialogOpen}
        availableUsers={availableUsersData?.users || []}
        isLoading={isLoadingAvailableUsers}
        onAddMember={(userId) => addMemberMutation.mutate(userId)}
        isAddingMember={addMemberMutation.isPending}
      />

      <RemoveMemberDialog
        open={removeMemberDialogOpen}
        onOpenChange={(open) => {
          setRemoveMemberDialogOpen(open);
          if (!open) setSelectedMember(null);
        }}
        memberName={selectedMember?.name || ""}
        onConfirm={() => {
          if (selectedMember) {
            removeMemberMutation.mutate(selectedMember.id);
          }
        }}
        isRemoving={removeMemberMutation.isPending}
      />

      <ManageCreditsDialog
        open={manageCreditsDialogOpen}
        onOpenChange={setManageCreditsDialogOpen}
        projectName={data?.projectName || effectiveSelectedProject?.name || "Project"}
        projectId={selectedProjectId}
        projectBalance={data?.wallet?.balance || 0}
        orgBalance={orgWalletData?.wallet?.balance || 0}
        isOrgAdmin={isOrgAdmin}
        onTransfer={(amount, description) =>
          transferCreditsMutation.mutate({ amount, description })
        }
        onRequestCredits={(amount, description) =>
          requestCreditsMutation.mutate({ amount, description })
        }
        onCreditBackToOrg={(amount, description) =>
          creditBackToOrgMutation.mutate({ amount, description })
        }
        isTransferring={transferCreditsMutation.isPending}
        isRequesting={requestCreditsMutation.isPending}
        isCreditingBack={creditBackToOrgMutation.isPending}
      />

      <TransactionHistoryDialog
        open={transactionHistoryDialogOpen}
        onOpenChange={setTransactionHistoryDialogOpen}
        projectName={data?.projectName || selectedProject?.name || "Project"}
        transactions={transactionsData?.transactions || []}
        isLoading={isLoadingTransactions}
        pagination={transactionsData?.pagination ? {
          page: transactionsData.pagination.page,
          limit: transactionsData.pagination.limit,
          total: transactionsData.pagination.total,
          totalPages: transactionsData.pagination.pages,
          hasMore: transactionsData.pagination.page < transactionsData.pagination.pages,
        } : undefined}
        onPageChange={setTransactionPage}
      />

      <UserCreditLimitDialog
        open={userCreditLimitDialogOpen}
        onOpenChange={(open) => {
          setUserCreditLimitDialogOpen(open);
          if (!open) setSelectedMember(null);
        }}
        memberName={selectedMember?.name || ""}
        memberEmail={selectedMember?.email || ""}
        currentLimit={selectedMember?.creditsMax || null}
        currentSpending={selectedMember?.creditsUsed || 0}
        projectBalance={data?.wallet?.balance || 0}
        onSetLimit={(limit) => {
          if (selectedMember) {
            setUserLimitMutation.mutate({ userId: selectedMember.id, limit });
          }
        }}
        onResetSpending={() => {
          if (selectedMember) {
            resetUserSpendingMutation.mutate(selectedMember.id);
          }
        }}
        isSettingLimit={setUserLimitMutation.isPending}
        isResettingSpending={resetUserSpendingMutation.isPending}
      />
    </div>
  );
}
