import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/roles";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { UnassignProjectAdminDialog } from "@/components/unassign-project-admin-dialog";
import {
  ProjectsHeader,
  ProjectsTable,
  CreateProjectDialog,
  EditProjectDialog,
  AssignAdminDialog,
  TransferFundsDialog,
  DeleteProjectDialog,
  ProjectType,
} from "@/components/projects";
import {
  useProjects,
  useOrganizations,
  useOrgAdminOrganization,
  useAvailableAdminUsers,
  useOrgWallet,
  useCreateProject,
  useUpdateProject,
  useAssignProjectAdmin,
  useUnassignProjectAdmin,
  useDeleteProject,
  useTransferFunds,
} from "@/components/projects/hooks";

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignAdminDialogOpen, setAssignAdminDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [unassignAdminDialogOpen, setUnassignAdminDialogOpen] = useState(false);
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

  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess;
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;
  const userOrganizationId = (user as any)?.organizationId;
  const currentUserId = (user as any)?.id || (user as any)?._id;

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

  // Mutations
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const assignAdminMutation = useAssignProjectAdmin();
  const unassignAdminMutation = useUnassignProjectAdmin();
  const deleteMutation = useDeleteProject();
  const transferMutation = useTransferFunds(selectedProject?.organizationId);

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

  const handleCreate = () => {
    if (!projectName.trim()) {
      toast({
        title: "Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }
    const orgIdToUse = isOrgAdmin ? orgAdminOrganizationId : organizationId;
    if (!orgIdToUse) {
      toast({
        title: "Error",
        description: "Organization is required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(
      {
        name: projectName,
        description: projectDescription,
        organizationId: orgIdToUse,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          resetForm();
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

  const handleUpdate = () => {
    if (!selectedProject || !projectName.trim()) {
      toast({
        title: "Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate(
      {
        id: selectedProject.id,
        name: projectName,
        description: projectDescription,
      },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          setSelectedProject(null);
          resetForm();
        },
      }
    );
  };

  const handleAssignAdmin = (project: ProjectType) => {
    setSelectedProject(project);
    setSelectedAdminUserId("");
    setAssignAdminDialogOpen(true);
  };

  const handleConfirmAssignAdmin = () => {
    if (!selectedProject || !selectedAdminUserId) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    const selectedUser = availableAdminUsersData?.users?.find(
      (u) => u.id === selectedAdminUserId
    );

    if (!selectedUser) {
      toast({
        title: "Error",
        description: "Selected user not found",
        variant: "destructive",
      });
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
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (orgWalletData?.wallet && orgWalletData.wallet.balance < amount) {
      toast({
        title: "Insufficient Balance",
        description: `Organization wallet has insufficient balance. Current balance: ${orgWalletData.wallet.balance}`,
        variant: "destructive",
      });
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
      },
    });
  };

  // Show error if organizations fail to load for org_admin
  if (isOrgAdmin && orgAdminOrgError) {
    return (
      <div className="space-y-6">
        <ProjectsHeader
          isProjectAdmin={isProjectAdmin}
          onCreateClick={handleOpenCreateDialog}
          canCreate={false}
        />
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-destructive">
              <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
              <p className="font-semibold mb-2">Error loading organization</p>
              <p className="text-sm text-muted-foreground">
                {(orgAdminOrgError as Error)?.message ||
                  "Failed to load your organization. Please refresh the page."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectsHeader
        isProjectAdmin={isProjectAdmin}
        onCreateClick={handleOpenCreateDialog}
        canCreate={isOrgAdmin ? !!orgAdminOrganizationId : true}
      />

      <ProjectsTable
        data={projectsData}
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
    </div>
  );
}
