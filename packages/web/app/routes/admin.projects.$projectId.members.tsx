import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    Building2,
    Check,
    Crown,
    Edit,
    FolderKanban,
    RotateCcw,
    Search,
    Shield,
    Trash2,
    UserMinus,
    UserPlus,
    Users,
    X,
} from "lucide-react";
import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useNavigate, useParams } from "react-router";
import { useCurrentUser } from "~/components/admin/users/hooks";
import { AdminLayout } from "~/components/AdminLayout";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { useToast } from "~/hooks/use-toast";
import { adminClient } from "~/lib/adminClient";
import { auth } from "~/lib/auth";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  return { user: session.user, projectId: params.projectId };
}

export function meta() {
  return [
    { title: "Project Members - Admin - Nowgai" },
    { name: "description", content: "Project members management" },
  ];
}

interface Member {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  role: string;
  status: string;
  assignedAt: string;
  walletLimit: number | null;
  currentSpending: number;
}

interface MembersResponse {
  members: Member[];
  project: {
    id: string;
    name: string;
  };
}

interface ProjectResponse {
  project: {
    id: string;
    name: string;
    description: string;
    organizationId: string;
    organization: {
      id: string;
      name: string;
    } | null;
    projectAdminId: string | null;
    projectAdmin: {
      id: string;
      email: string;
      name: string;
    } | null;
    status: string;
  };
}

interface AvailableUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function ProjectMembersPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const projectId = params.projectId;

  // Get current user to check if they're trying to unassign/delete themselves
  const { data: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id;

  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [assignAdminDialogOpen, setAssignAdminDialogOpen] = useState(false);
  const [unassignAdminDialogOpen, setUnassignAdminDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [editingLimit, setEditingLimit] = useState<{
    userId: string;
    currentLimit: number | null;
  } | null>(null);
  const [limitValue, setLimitValue] = useState("");

  // Fetch project details
  const { data: projectData, isLoading: projectLoading } =
    useQuery<ProjectResponse>({
      queryKey: ["/api/admin/projects/:projectId", projectId],
      queryFn: async (): Promise<ProjectResponse> => {
        if (!projectId) {
          throw new Error("Project ID is required");
        }
        const data = await adminClient.get<ProjectResponse>(
          `/api/admin/projects/${projectId}`
        );
        return (
          data || {
            project: {
              id: projectId,
              name: "",
              description: "",
              organizationId: "",
              organization: null,
              projectAdminId: null,
              projectAdmin: null,
              status: "active",
            },
          }
        );
      },
      enabled: !!projectId,
    });

  // Fetch members
  const {
    data: membersData,
    isLoading: membersLoading,
    refetch: refetchMembers,
  } = useQuery<MembersResponse>({
    queryKey: ["/api/admin/projects/:projectId/members", projectId],
    queryFn: async (): Promise<MembersResponse> => {
      if (!projectId) {
        return { members: [], project: { id: "", name: "" } };
      }
      try {
        const data = await adminClient.get<MembersResponse>(
          `/api/admin/projects/${projectId}/members`
        );
        return data || { members: [], project: { id: projectId, name: "" } };
      } catch (err) {
        console.error("Error fetching project members:", err);
        return { members: [], project: { id: projectId, name: "" } };
      }
    },
    enabled: !!projectId,
  });

  // Fetch available users from organization (for adding members)
  const { data: availableUsersData, isLoading: isLoadingAvailableUsers } =
    useQuery<{
      users: AvailableUser[];
    }>({
      queryKey: [
        "/api/admin/organizations/:organizationId/available-users",
        projectData?.project?.organizationId,
        projectId,
      ],
      queryFn: async () => {
        if (!projectData?.project?.organizationId) {
          return { users: [] };
        }
        const data = await adminClient.get<{ users: AvailableUser[] }>(
          `/api/admin/organizations/${projectData.project.organizationId}/available-users`,
          {
            params: {
              ...(projectId && { projectId }),
            },
          }
        );
        return data || { users: [] };
      },
      enabled: !!(projectData?.project?.organizationId && addMemberDialogOpen),
    });

  // Fetch available users for admin assignment
  const { data: availableAdminUsersData, isLoading: isLoadingAdminUsers } =
    useQuery<{
      users: AvailableUser[];
    }>({
      queryKey: [
        "/api/admin/organizations/:organizationId/available-users-for-admin",
        projectData?.project?.organizationId,
        projectId,
      ],
      queryFn: async () => {
        if (!projectData?.project?.organizationId) {
          return { users: [] };
        }
        const data = await adminClient.get<{ users: AvailableUser[] }>(
          `/api/admin/organizations/${projectData.project.organizationId}/available-users`,
          {
            params: {
              forAdmin: "true",
              projectId: projectId || "",
            },
          }
        );
        return data || { users: [] };
      },
      enabled: !!(
        projectData?.project?.organizationId &&
        projectId &&
        assignAdminDialogOpen
      ),
    });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return adminClient.post(`/api/admin/projects/${projectId}/members`, {
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId/members", projectId],
      });
      toast({
        title: "Success",
        description: "Member added to project successfully",
      });
      setAddMemberDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add member",
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => {
      return adminClient.put(
        `/api/admin/projects/${projectId}/members/${memberId}`,
        {
          role,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId/members", projectId],
      });
      toast({
        title: "Success",
        description: "Member role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return adminClient.delete(
        `/api/admin/projects/${projectId}/members/${memberId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId/members", projectId],
      });
      toast({
        title: "Success",
        description: "Member removed from project successfully",
      });
      setRemoveMemberDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  // Assign project admin mutation
  const assignAdminMutation = useMutation({
    mutationFn: async (email: string) => {
      return adminClient.post(`/api/admin/projects/${projectId}/assign-admin`, {
        email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId", projectId],
      });
      toast({
        title: "Success",
        description: "Project admin assigned successfully",
      });
      setAssignAdminDialogOpen(false);
      setAdminSearchQuery("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign project admin",
        variant: "destructive",
      });
    },
  });

  // Unassign project admin mutation
  const unassignAdminMutation = useMutation({
    mutationFn: async () => {
      return adminClient.delete(`/api/admin/projects/${projectId}/admin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId", projectId],
      });
      toast({
        title: "Success",
        description: "Project admin unassigned successfully",
      });
      setUnassignAdminDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unassign project admin",
        variant: "destructive",
      });
    },
  });

  // Set wallet limit mutation
  const setLimitMutation = useMutation({
    mutationFn: async ({
      userId,
      limit,
    }: {
      userId: string;
      limit: number | null;
    }) => {
      return adminClient.put(
        `/api/admin/user-project-wallets/${projectId}/${userId}/set-limit`,
        { limit }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId/members", projectId],
      });
      toast({
        title: "Success",
        description: "Wallet limit updated successfully",
      });
      setEditingLimit(null);
      setLimitValue("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update limit",
        variant: "destructive",
      });
    },
  });

  // Reset spending mutation
  const resetSpendingMutation = useMutation({
    mutationFn: async (userId: string) => {
      return adminClient.post(
        `/api/admin/user-project-wallets/${projectId}/${userId}/reset-spending`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId/members", projectId],
      });
      toast({
        title: "Success",
        description: "Spending reset successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset spending",
        variant: "destructive",
      });
    },
  });

  const handleRemoveMember = (member: Member) => {
    setSelectedMember(member);
    setRemoveMemberDialogOpen(true);
  };

  const confirmRemoveMember = () => {
    if (selectedMember) {
      removeMemberMutation.mutate(selectedMember.id);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const handleEditLimit = (member: Member) => {
    setEditingLimit({
      userId: member.userId,
      currentLimit: member.walletLimit,
    });
    setLimitValue(member.walletLimit?.toString() || "");
  };

  const handleSaveLimit = () => {
    if (!editingLimit) return;

    const limit = limitValue.trim() === "" ? null : parseFloat(limitValue);
    if (limit !== null && (isNaN(limit) || limit < 0)) {
      toast({
        title: "Invalid Limit",
        description: "Limit must be a positive number or empty",
        variant: "destructive",
      });
      return;
    }

    setLimitMutation.mutate({
      userId: editingLimit.userId,
      limit,
    });
  };

  const handleCancelEditLimit = () => {
    setEditingLimit(null);
    setLimitValue("");
  };

  const handleRemoveLimit = (userId: string) => {
    setLimitMutation.mutate({
      userId,
      limit: null,
    });
  };

  const handleResetSpending = (userId: string) => {
    resetSpendingMutation.mutate(userId);
  };

  // Filter available users based on search
  const filteredAvailableUsers = availableUsersData?.users?.filter((u) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(query) ||
      (u.name && u.name.toLowerCase().includes(query))
    );
  });

  // Filter available admin users based on search
  const filteredAvailableAdminUsers = availableAdminUsersData?.users?.filter(
    (u) => {
      if (!adminSearchQuery) return true;
      const query = adminSearchQuery.toLowerCase();
      return (
        u.email.toLowerCase().includes(query) ||
        (u.name && u.name.toLowerCase().includes(query))
      );
    }
  );

  if (!projectId) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Invalid project ID</p>
        </div>
      </AdminLayout>
    );
  }

  const project = projectData?.project;
  const members = membersData?.members || [];

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/projects")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Project Members
            </h1>
            {project && (
              <div className="flex items-center gap-4 mt-1">
                <p className="text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  {project.name}
                </p>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {project.organization?.name || "No organization"}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setAddMemberDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Project Details Card */}
        {project && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Name</p>
                  <p className="font-medium">{project.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <Badge
                    variant={
                      project.status === "active" ? "default" : "secondary"
                    }
                  >
                    {project.status}
                  </Badge>
                </div>
                {project.description && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      Description
                    </p>
                    <p className="text-sm">{project.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Organization
                  </p>
                  <p className="font-medium">
                    {project.organization?.name || "No organization"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Admin Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Project Admin
              </span>
              {project?.projectAdmin ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnassignAdminDialogOpen(true)}
                  disabled={currentUserId === project.projectAdmin?.id}
                  className="text-destructive hover:text-destructive"
                  title={
                    currentUserId === project.projectAdmin?.id
                      ? "You cannot unassign yourself as project admin"
                      : "Unassign Project Admin"
                  }
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Unassign Admin
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setAssignAdminDialogOpen(true)}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Assign Admin
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              Each project can have only one admin who manages the project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {project?.projectAdmin ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {project.projectAdmin.name || "No name"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {project.projectAdmin.email}
                  </p>
                </div>
                <Badge variant="default" className="bg-primary">
                  Admin
                </Badge>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Crown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No project admin assigned</p>
                <p className="text-sm">
                  Assign an organization user as the project admin
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              Manage team members and their roles in this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectLoading || membersLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : members.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Wallet Limit</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const isProjectAdmin =
                        project?.projectAdminId === member.userId;
                      // const isCurrentUser = currentUserId === member.userId;
                      const canEditLimit =
                        project?.projectAdminId;
                      const limit = member.walletLimit;
                      const spending = member.currentSpending || 0;
                      const remaining =
                        limit !== null ? limit - spending : null;
                      const usagePercent =
                        limit !== null && limit > 0
                          ? (spending / limit) * 100
                          : null;

                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.user?.name || "No name"}
                            {isProjectAdmin && (
                              <Badge variant="default" className="ml-2">
                                Admin
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.user?.email || "-"}
                          </TableCell>
                          <TableCell>
                            {editingLimit?.userId === member.userId ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={limitValue}
                                  onChange={(e) =>
                                    setLimitValue(e.target.value)
                                  }
                                  placeholder="No limit (empty = remove)"
                                  className="w-32"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveLimit();
                                    } else if (e.key === "Escape") {
                                      handleCancelEditLimit();
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleSaveLimit}
                                  disabled={setLimitMutation.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEditLimit}
                                  disabled={setLimitMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">
                                  {limit !== null && limit !== undefined
                                    ? formatCurrency(limit)
                                    : isProjectAdmin
                                    ? "No limit"
                                    : "No limit"}
                                </span>
                                {canEditLimit && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditLimit(member)}
                                      disabled={setLimitMutation.isPending}
                                      title="Edit limit"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    {limit !== null && limit !== undefined && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          handleRemoveLimit(member.userId)
                                        }
                                        disabled={setLimitMutation.isPending}
                                        title="Remove limit"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {limit !== null && limit !== undefined ? (
                              <div className="flex flex-col gap-1">
                                <span className="font-mono text-sm">
                                  {formatCurrency(spending)} /{" "}
                                  {formatCurrency(limit)}
                                </span>
                                {usagePercent !== null && (
                                  <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        usagePercent >= 100
                                          ? "bg-destructive"
                                          : usagePercent >= 90
                                          ? "bg-orange-500"
                                          : "bg-primary"
                                      }`}
                                      style={{
                                        width: `${Math.min(
                                          usagePercent,
                                          100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                )}
                                <span
                                  className={`text-xs ${
                                    usagePercent !== null && usagePercent >= 100
                                      ? "text-destructive font-semibold"
                                      : usagePercent !== null &&
                                        usagePercent >= 90
                                      ? "text-orange-600"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {usagePercent !== null
                                    ? `${usagePercent.toFixed(1)}% used`
                                    : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                {formatCurrency(spending)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {limit !== null && limit !== undefined ? (
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`font-mono text-sm ${
                                    remaining !== null && remaining < 0
                                      ? "text-destructive font-semibold"
                                      : remaining !== null &&
                                        remaining < limit * 0.1
                                      ? "text-orange-600 font-semibold"
                                      : "text-green-600"
                                  }`}
                                >
                                  {remaining !== null
                                    ? formatCurrency(remaining)
                                    : "-"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                -
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                member.status === "active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(member.assignedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {limit !== null &&
                                limit !== undefined &&
                                canEditLimit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleResetSpending(member.userId)
                                    }
                                    disabled={resetSpendingMutation.isPending}
                                    title="Reset spending"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                )}
                              {currentUserId !== member.userId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMember(member)}
                                  disabled={removeMemberMutation.isPending}
                                  className="text-destructive hover:text-destructive"
                                  title="Remove Member"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No team members yet</p>
                <p className="text-sm">
                  Add members from your organization to start collaborating
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setAddMemberDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First Member
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Member Dialog */}
        <Dialog
          open={addMemberDialogOpen}
          onOpenChange={setAddMemberDialogOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add Member to Project
              </DialogTitle>
              <DialogDescription>
                Select a user from your organization to add to this project.
                They will be notified via email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  disabled={isLoadingAvailableUsers}
                />
              </div>
              {isLoadingAvailableUsers ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-9 w-20 ml-4" />
                    </div>
                  ))}
                </div>
              ) : filteredAvailableUsers &&
                filteredAvailableUsers.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredAvailableUsers.map((availableUser) => (
                    <div
                      key={availableUser.id}
                      className="p-4 border rounded-lg flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">
                          {availableUser.name || "No name"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {availableUser.email}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          addMemberMutation.mutate(availableUser.id)
                        }
                        disabled={addMemberMutation.isPending}
                      >
                        {addMemberMutation.isPending ? "Adding..." : "Add"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No available users found</p>
                  <p className="text-sm">
                    All organization users may already be members of this
                    project.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddMemberDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Member Confirmation Dialog */}
        <AlertDialog
          open={removeMemberDialogOpen}
          onOpenChange={setRemoveMemberDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove{" "}
                <span className="font-semibold">
                  {selectedMember?.user?.name || selectedMember?.user?.email}
                </span>{" "}
                from this project? They will lose access to all project
                resources.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveMember}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Assign Project Admin Dialog */}
        <Dialog
          open={assignAdminDialogOpen}
          onOpenChange={setAssignAdminDialogOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Assign Project Admin
              </DialogTitle>
              <DialogDescription>
                Select a user from your organization to assign as the project
                admin. Each project can have only one admin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  className="pl-10"
                  disabled={isLoadingAdminUsers}
                />
              </div>
              {isLoadingAdminUsers ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Loading users...</p>
                </div>
              ) : filteredAvailableAdminUsers &&
                filteredAvailableAdminUsers.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredAvailableAdminUsers.map((availableUser) => (
                    <div
                      key={availableUser.id}
                      className="p-4 border rounded-lg flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">
                          {availableUser.name || "No name"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {availableUser.email}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {availableUser.role === "org_admin"
                            ? "Org Admin"
                            : "Org User"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          assignAdminMutation.mutate(availableUser.email)
                        }
                        disabled={assignAdminMutation.isPending}
                      >
                        {assignAdminMutation.isPending
                          ? "Assigning..."
                          : "Assign as Admin"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No available users found</p>
                  <p className="text-sm">
                    All organization users may already be project admins.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAssignAdminDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unassign Project Admin Confirmation Dialog */}
        <AlertDialog
          open={unassignAdminDialogOpen}
          onOpenChange={setUnassignAdminDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unassign Project Admin</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to unassign{" "}
                <span className="font-semibold">
                  {project?.projectAdmin?.name || project?.projectAdmin?.email}
                </span>{" "}
                as the project admin? They will be converted to an organization
                user and lose project admin privileges.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => unassignAdminMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={unassignAdminMutation.isPending}
              >
                {unassignAdminMutation.isPending
                  ? "Unassigning..."
                  : "Unassign"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
