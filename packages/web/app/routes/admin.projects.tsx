import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { toast } from "sonner";
import { UserRole } from "~/lib/types/roles";
import {
  AssignAdminDialog,
  CreateProjectDialog,
  DeleteProjectDialog,
  EditProjectDialog,
  ManageTeamMembersDialog,
  ProjectsGrid,
  ProjectsHeader,
  TransferFundsDialog,
  UnassignProjectAdminDialog,
  type ProjectType,
} from "../components/admin/projects";
import {
  useAssignProjectAdmin,
  useAvailableAdminUsers,
  useCreateProject,
  useDeleteProject,
  useOrgAdminOrganization,
  useOrganizations,
  useOrgWallet,
  useProjects,
  useTransferFunds,
  useUnassignProjectAdmin,
  useUpdateProject,
} from "../components/admin/projects/hooks";
import { useCurrentUser } from "../components/admin/users/hooks";
import { AdminLayout } from "../components/AdminLayout";
import { Card, CardContent } from "../components/ui/card";
import { adminClient } from "../lib/adminClient";
import { auth } from "../lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  return { user: session.user };
}

export function meta() {
  return [
    { title: "Projects - Admin - Nowgai" },
    { name: "description", content: "Project management" },
  ];
}

export default function AdminProjects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignAdminDialogOpen, setAssignAdminDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [unassignAdminDialogOpen, setUnassignAdminDialogOpen] = useState(false);
  const [manageTeamMembersDialogOpen, setManageTeamMembersDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectType | null>(
    null
  );

  // Form states
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");

  // Fetch current user with org admin flags
  const { data: currentUserData } = useCurrentUser();
  const user = currentUserData;
  const userRole = user?.role;
  const hasOrgAdminAccess = user?.hasOrgAdminAccess;
  const hasProjectAdminAccess = user?.hasProjectAdminAccess;
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;
  const userOrganizationId = user?.organizationId;
  const currentUserId = user?.id;

  // Fetch organizations
  const { data: orgsData, error: orgsError } = useOrganizations(!isOrgAdmin);
  const { data: orgAdminOrgData, error: orgAdminOrgError } =
    useOrgAdminOrganization(isOrgAdmin);

  // Get organizations list
  const organizations = isOrgAdmin
    ? orgAdminOrgData?.organizations || []
    : orgsData?.organizations || [];

  // Auto-set organizationId for org_admin
  const orgAdminOrganizationId = isOrgAdmin
    ? orgAdminOrgData?.organizations?.[0]?.id || userOrganizationId
    : null;

  // Auto-set organizationId for org_admin when organization data loads
  useEffect(() => {
    if (isOrgAdmin && orgAdminOrganizationId && !organizationId) {
      setOrganizationId(orgAdminOrganizationId);
    }
  }, [isOrgAdmin, orgAdminOrganizationId, organizationId]);

  // Fetch projects
  const {
    data: projectsData,
    isLoading,
    error: projectsError,
  } = useProjects(currentPage, searchQuery, selectedOrgId);

  // Filter archived projects
  const filteredProjectsData = projectsData
    ? {
        ...projectsData,
        projects: projectsData.projects.filter(
          (project) => showArchived || project.status !== "archived"
        ),
      }
    : projectsData;

  // Fetch available users for assigning project admin
  const { data: availableAdminUsersData, isLoading: isLoadingAdminUsers } =
    useAvailableAdminUsers(
      selectedProject?.organizationId,
      selectedProject?.id,
      assignAdminDialogOpen
    );

  // Fetch org wallet for transfer
  const { data: orgWalletData } = useOrgWallet(
    selectedProject?.organizationId,
    transferDialogOpen && isOrgAdmin
  );

  // Fetch project members for team members dialog
  const queryClient = useQueryClient();
  const { data: projectMembersData, isLoading: isLoadingProjectMembers } =
    useQuery({
      queryKey: ["/api/admin/projects/:projectId/members", selectedProject?.id],
      queryFn: async () => {
        if (!selectedProject?.id) return { members: [], project: { id: "", name: "" } };
        try {
          const data = await adminClient.get<{
            members: Array<{
              id: string;
              userId: string;
              user: { id: string; email: string; name: string } | null;
              role: string;
              status: string;
              assignedAt: string;
              walletLimit: number | null;
              currentSpending: number;
            }>;
            project: { id: string; name: string };
          }>(`/api/admin/projects/${selectedProject.id}/members`);
          return data || { members: [], project: { id: selectedProject.id, name: "" } };
        } catch (err) {
          console.error("Error fetching project members:", err);
          return { members: [], project: { id: selectedProject?.id, name: "" } };
        }
      },
      enabled: !!(selectedProject?.id && manageTeamMembersDialogOpen),
    });

  // Fetch available users for adding to project
  const { data: availableUsersForProjectData, isLoading: isLoadingAvailableUsersForProject } =
    useQuery({
      queryKey: [
        "/api/admin/organizations/:organizationId/available-users",
        selectedProject?.organizationId,
      ],
      queryFn: async () => {
        if (!selectedProject?.organizationId) return { users: [] };
        try {
          const data = await adminClient.get<{
            users: Array<{ id: string; email: string; name: string; role: string }>;
          }>(
            `/api/admin/organizations/${selectedProject.organizationId}/available-users`,
            {
              params: {
                projectId: selectedProject?.id,
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
        selectedProject?.organizationId &&
        selectedProject?.id &&
        manageTeamMembersDialogOpen
      ),
    });

  // Mutations
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const assignAdminMutation = useAssignProjectAdmin();
  const unassignAdminMutation = useUnassignProjectAdmin();
  const deleteMutation = useDeleteProject();
  const transferMutation = useTransferFunds(selectedProject?.organizationId);

  // Mutations for managing team members
  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!selectedProject?.id) throw new Error("Project ID is required");
      return adminClient.post(`/api/admin/projects/${selectedProject.id}/members`, {
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId/members", selectedProject?.id],
      });
      toast.success("Member added to project successfully");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to add member");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!selectedProject?.id) throw new Error("Project ID is required");
      return adminClient.delete(
        `/api/admin/projects/${selectedProject.id}/members/${memberId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId/members", selectedProject?.id],
      });
      toast.success("Member removed from project successfully");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to remove member");
    },
  });

  const resetForm = () => {
    setProjectName("");
    setProjectDescription("");
    if (!isOrgAdmin) {
      setOrganizationId("");
    }
    setSelectedAdminUserId("");
    setTransferAmount("");
    setTransferDescription("");
  };

  const handleOpenCreateDialog = () => {
    if (isOrgAdmin && orgAdminOrganizationId) {
      setOrganizationId(orgAdminOrganizationId);
    }
    setCreateDialogOpen(true);
  };

  const handleCreate = (data: {
    imageData?: string;
    imageName?: string;
    imageType?: string;
    projectAdminId: string;
    initialFunding: number;
  }) => {
    if (!projectName.trim()) {
      toast.error("Project name is required");
      return;
    }
    const orgIdToUse = isOrgAdmin ? orgAdminOrganizationId : organizationId;
    if (!orgIdToUse) {
      toast.error("Organization is required");
      return;
    }
    if (!data.projectAdminId) {
      toast.error("Project admin is required");
      return;
    }
    createMutation.mutate(
      {
        name: projectName,
        description: projectDescription,
        organizationId: orgIdToUse,
        projectAdminId: data.projectAdminId,
        initialFunding: data.initialFunding,
        imageData: data.imageData,
        imageName: data.imageName,
        imageType: data.imageType,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          resetForm();
          toast.success("Project created successfully");
        },
        onError: (error: any) => {
          toast.error(error?.message || "Failed to create project");
        },
      }
    );
  };

  const handleEdit = (project: ProjectType) => {
    setSelectedProject(project);
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setEditDialogOpen(true);
  };

  const handleUpdate = (imageData?: {
    imageData: string;
    imageName: string;
    imageType: string;
  }) => {
    if (!selectedProject || !projectName.trim()) {
      toast.error("Project name is required");
      return;
    }
    updateMutation.mutate(
      {
        id: selectedProject.id,
        name: projectName,
        description: projectDescription,
        ...(imageData && {
          imageData: imageData.imageData,
          imageName: imageData.imageName,
          imageType: imageData.imageType,
        }),
      },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          setSelectedProject(null);
          resetForm();
          toast.success("Project updated successfully");
        },
        onError: (error: any) => {
          toast.error(error?.message || "Failed to update project");
        },
      }
    );
  };

  const handleAssignAdmin = (project: ProjectType) => {
    setSelectedProject(project);
    setSelectedAdminUserId("");
    setAssignAdminDialogOpen(true);
  };

  const handleManageTeamMembers = (project: ProjectType) => {
    setSelectedProject(project);
    setManageTeamMembersDialogOpen(true);
  };

  const handleConfirmAssignAdmin = () => {
    if (!selectedProject || !selectedAdminUserId) {
      toast.error("Please select a user");
      return;
    }

    const selectedUser = availableAdminUsersData?.users?.find(
      (u) => u.id === selectedAdminUserId
    );

    if (!selectedUser) {
      toast.error("Selected user not found");
      return;
    }

    assignAdminMutation.mutate(
      {
        projectId: selectedProject.id,
        email: selectedUser.email,
      },
      {
        onSuccess: () => {
          setAssignAdminDialogOpen(false);
          setSelectedProject(null);
          setSelectedAdminUserId("");
        },
      }
    );
  };

  const handleTransferFunds = (project: ProjectType) => {
    setSelectedProject(project);
    setTransferDialogOpen(true);
  };

  const handleConfirmTransfer = () => {
    if (!selectedProject) return;

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive number");
      return;
    }

    if (orgWalletData?.wallet && orgWalletData.wallet.balance < amount) {
      toast.error(
        `Organization wallet has insufficient balance. Current balance: ${orgWalletData.wallet.balance}`
      );
      return;
    }

    transferMutation.mutate(
      {
        projectId: selectedProject.id,
        amount,
        description: transferDescription.trim(),
      },
      {
        onSuccess: () => {
          setTransferDialogOpen(false);
          setTransferAmount("");
          setTransferDescription("");
          setSelectedProject(null);
          toast.success("Funds transferred successfully");
        },
        onError: (error: any) => {
          toast.error(error?.message || "Failed to transfer funds");
        },
      }
    );
  };

  const handleUnassignAdmin = (project: ProjectType) => {
    setSelectedProject(project);
    setUnassignAdminDialogOpen(true);
  };

  const handleConfirmUnassignAdmin = () => {
    if (!selectedProject) return;
    unassignAdminMutation.mutate(selectedProject.id, {
      onSuccess: () => {
        setUnassignAdminDialogOpen(false);
        setSelectedProject(null);
        toast.success("Project admin unassigned successfully");
      },
      onError: (error: any) => {
        toast.error(error?.message || "Failed to unassign project admin");
      },
    });
  };

  const handleDelete = (project: ProjectType) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedProject) return;
    deleteMutation.mutate(selectedProject.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setSelectedProject(null);
        toast.success("Project deleted successfully");
      },
      onError: (error: any) => {
        toast.error(error?.message || "Failed to delete project");
      },
    });
  };

  // Show error if organizations fail to load for org_admin
  if (isOrgAdmin && orgAdminOrgError) {
    return (
      <AdminLayout>
        <div className="flex-1 px-12 py-8">
          <div className="space-y-6">
            <ProjectsHeader isProjectAdmin={isProjectAdmin} />
            <div className="rounded-[12px] bg-surface-1 border border-subtle">
              <Card className="bg-transparent border-0 shadow-none">
                <CardContent className="py-8">
                  <div className="text-center text-[#ef4444]">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
                    <p className="font-semibold mb-2">
                      Error loading organization
                    </p>
                    <p className="text-sm text-secondary">
                      {(orgAdminOrgError as Error)?.message ||
                        "Failed to load your organization. Please refresh the page."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex-1 px-12 py-8">
        <div className="space-y-6">
          <ProjectsHeader isProjectAdmin={isProjectAdmin} showArchived={showArchived} onShowArchivedChange={setShowArchived} />

          <ProjectsGrid
            data={filteredProjectsData}
            isLoading={isLoading}
            error={projectsError}
            searchQuery={searchQuery}
            selectedOrgId={selectedOrgId}
            organizations={organizations}
            isProjectAdmin={isProjectAdmin}
            isOrgAdmin={isOrgAdmin}
            onSearchChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
            onOrgFilterChange={(orgId) => {
              setSelectedOrgId(orgId);
              setCurrentPage(1);
            }}
            onEdit={handleEdit}
            onAssignAdmin={handleAssignAdmin}
            onUnassignAdmin={handleUnassignAdmin}
            onDelete={handleDelete}
            onManageMembers={handleManageTeamMembers}
            onCreateClick={handleOpenCreateDialog}
            canCreate={isOrgAdmin ? !!orgAdminOrganizationId : true}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            isUnassigning={unassignAdminMutation.isPending}
          />

          {/* Dialogs */}
          <CreateProjectDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            projectName={projectName}
            projectDescription={projectDescription}
            organizationId={organizationId}
            organizations={organizations}
            isOrgAdmin={isOrgAdmin}
            onProjectNameChange={setProjectName}
            onProjectDescriptionChange={setProjectDescription}
            onOrganizationIdChange={setOrganizationId}
            onSubmit={handleCreate}
            onReset={resetForm}
            isLoading={createMutation.isPending}
          />

          <EditProjectDialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                setSelectedProject(null);
                resetForm();
              }
            }}
            project={selectedProject}
            projectName={projectName}
            projectDescription={projectDescription}
            onProjectNameChange={setProjectName}
            onProjectDescriptionChange={setProjectDescription}
            onStatusChange={(status) => {
              if (selectedProject) {
                updateMutation.mutate({
                  id: selectedProject.id,
                  status,
                });
              }
            }}
            onSubmit={handleUpdate}
            onReset={resetForm}
            isLoading={updateMutation.isPending}
          />

          <AssignAdminDialog
            open={assignAdminDialogOpen}
            onOpenChange={(open) => {
              setAssignAdminDialogOpen(open);
              if (!open) {
                setSelectedProject(null);
                setSelectedAdminUserId("");
              }
            }}
            users={availableAdminUsersData?.users || []}
            isLoading={isLoadingAdminUsers}
            selectedUserId={selectedAdminUserId}
            onUserSelect={setSelectedAdminUserId}
            onSubmit={handleConfirmAssignAdmin}
            onReset={() => setSelectedAdminUserId("")}
            isSubmitting={assignAdminMutation.isPending}
            currentUserId={currentUserId}
          />

          {isOrgAdmin && (
            <TransferFundsDialog
              open={transferDialogOpen}
              onOpenChange={(open) => {
                setTransferDialogOpen(open);
                if (!open) {
                  setTransferAmount("");
                  setTransferDescription("");
                  setSelectedProject(null);
                }
              }}
              project={selectedProject}
              amount={transferAmount}
              description={transferDescription}
              orgBalance={orgWalletData?.wallet?.balance}
              onAmountChange={setTransferAmount}
              onDescriptionChange={setTransferDescription}
              onSubmit={handleConfirmTransfer}
              onReset={() => {
                setTransferAmount("");
                setTransferDescription("");
              }}
              isLoading={transferMutation.isPending}
            />
          )}

          <UnassignProjectAdminDialog
            open={unassignAdminDialogOpen}
            onOpenChange={(open) => {
              setUnassignAdminDialogOpen(open);
              if (!open) {
                setSelectedProject(null);
              }
            }}
            projectName={selectedProject?.name || null}
            adminName={
              selectedProject?.projectAdmin?.name ||
              selectedProject?.projectAdmin?.email ||
              null
            }
            onConfirm={handleConfirmUnassignAdmin}
            isPending={unassignAdminMutation.isPending}
          />

          <DeleteProjectDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                setSelectedProject(null);
              }
            }}
            project={selectedProject}
            onConfirm={handleConfirmDelete}
            isLoading={deleteMutation.isPending}
          />

          <ManageTeamMembersDialog
            open={manageTeamMembersDialogOpen}
            onOpenChange={(open) => {
              setManageTeamMembersDialogOpen(open);
              if (!open) {
                setSelectedProject(null);
              }
            }}
            project={selectedProject}
            currentMembers={projectMembersData?.members || []}
            availableUsers={availableUsersForProjectData?.users || []}
            isLoadingMembers={isLoadingProjectMembers}
            isLoadingAvailableUsers={isLoadingAvailableUsersForProject}
            onAddMember={(userId: string) => {
              addMemberMutation.mutate(userId);
            }}
            onRemoveMember={(memberId: string) => {
              removeMemberMutation.mutate(memberId);
            }}
            isSubmitting={addMemberMutation.isPending || removeMemberMutation.isPending}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
