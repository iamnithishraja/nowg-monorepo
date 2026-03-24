import { UserRole } from "@nowgai/shared/types";
import { Building2, FolderKanban } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { toast } from "sonner";
import { RemoveUserFromOrgDialog } from "~/components/admin/RemoveUserFromOrgDialog";
import type { TeamMember, UserType } from "~/components/admin/users";
import {
    AddTeammateDialog,
    AllUsersTable,
    InviteAdminDialog,
    InviteToProjectDialog,
    ManageCreditsDialog,
    ManageRoleDialog,
    ProjectMembersTable,
    RoleChangeDialog,
    TeamMembersTable,
    UserDetailDialog,
    UsersHeader,
} from "~/components/admin/users";
import {
    useAddToProject,
    useAvailableOrgUsers,
    useCurrentUser,
    useInviteAdmin,
    useInviteOrgUser,
    useOrganizations,
    useOrgUsers,
    useProjectAdminUsers,
    useRemoveOrgUser,
    useSearchUser,
    useUpdateOrganizationRole,
    useUpdateProjectRole,
    useUpdateRole,
    useUpdateUserProjectWalletLimit,
    useUserDetail,
    useUserProjectWallets,
    useUsers,
} from "~/components/admin/users/hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AdminLayout } from "../components/AdminLayout";
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
    { title: "Team - Admin - Nowgai" },
    { name: "description", content: "Team management" },
  ];
}

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [inviteToProjectDialogOpen, setInviteToProjectDialogOpen] =
    useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "org" | "project">("all");

  // New state for Team management (Org Admins)
  const [addTeammateDialogOpen, setAddTeammateDialogOpen] = useState(false);
  const [manageRoleDialogOpen, setManageRoleDialogOpen] = useState(false);
  const [manageCreditsDialogOpen, setManageCreditsDialogOpen] = useState(false);
  const [removeUserDialogOpen, setRemoveUserDialogOpen] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] =
    useState<TeamMember | null>(null);
  const [inviteOrgUserEmail, setInviteOrgUserEmail] = useState("");
  const [searchedUser, setSearchedUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
    image?: string;
  } | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

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
  const isFullAdmin =
    userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;
  const userProjectId = user?.projectId;
  const userOrganizationId = user?.organizationId;

  // Get organization for org_admin
  const { data: orgsData, isLoading: orgsLoading } =
    useOrganizations(isOrgAdmin);

  // Use organizationId from user object if available, otherwise use fetched orgs
  const organization = useMemo(() => {
    if (userOrganizationId && orgsData?.organizations) {
      const matchedOrg = orgsData.organizations.find(
        (org: { id: string; name: string }) => org.id === userOrganizationId
      );
      if (matchedOrg) {
        return matchedOrg;
      }
    }
    if (orgsData?.organizations?.[0]) {
      return orgsData.organizations[0];
    }
    if (userOrganizationId) {
      return {
        id: userOrganizationId,
        name: "Your Organization",
      };
    }
    return null;
  }, [userOrganizationId, orgsData?.organizations]);

  const finalOrganization = organization;

  // Fetch users
  const {
    data: usersData,
    isLoading,
    isFetching,
  } = useUsers(currentPage, searchQuery);

  // Fetch org users for team management
  const {
    data: orgUsersData,
    isLoading: orgUsersLoading,
    refetch: refetchOrgUsers,
  } = useOrgUsers(finalOrganization?.id);

  // Fetch project admin users for team management
  const {
    data: projectAdminUsersData,
    isLoading: projectAdminUsersLoading,
    refetch: refetchProjectAdminUsers,
  } = useProjectAdminUsers(isProjectAdmin && !isFullAdmin);

  // Remove user from org mutation
  const removeUserMutation = useRemoveOrgUser(finalOrganization?.id);

  // Fetch user project wallets when manage credits dialog is open
  // For project admin, only fetch wallets for projects where they are admin
  const { data: userWalletsData, isLoading: isLoadingUserWallets } =
    useUserProjectWallets(
      selectedTeamMember?.id || undefined,
      manageCreditsDialogOpen && !!selectedTeamMember
    );

  // Mutation to update user project wallet limits
  const updateWalletLimitMutation = useUpdateUserProjectWalletLimit();

  // Mutations to update roles
  const updateOrganizationRoleMutation = useUpdateOrganizationRole();
  const updateProjectRoleMutation = useUpdateProjectRole();

  // Fetch available users from organization for PROJECT_ADMIN to invite to project
  const {
    data: availableOrgUsersData,
    refetch: refetchAvailableOrgUsers,
    isLoading: isLoadingAvailableUsers,
    isFetching: isFetchingAvailableUsers,
  } = useAvailableOrgUsers(
    userOrganizationId,
    userProjectId,
    inviteToProjectDialogOpen && isProjectAdmin
  );

  // Mutations
  const inviteAdminMutation = useInviteAdmin();
  const updateRoleMutation = useUpdateRole();
  const searchUserMutation = useSearchUser();
  const inviteOrgUserMutation = useInviteOrgUser();
  const addToProjectMutation = useAddToProject(userProjectId);

  // Fetch user detail
  const { data: userDetail, isLoading: isLoadingDetail } = useUserDetail(
    selectedUserId,
    detailDialogOpen
  );

  // Transform org users to TeamMember format
  const teamMembers: TeamMember[] = useMemo(() => {
    if (!orgUsersData?.users) return [];
    return orgUsersData.users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name || "",
      role: user.role,
      status: "active" as const,
      joinedAt: user.joinedAt || user.createdAt,
      image: user.image,
      projects: user.projects || [],
      creditsUsed: user.creditsUsed ?? undefined,
      creditsAvailable: user.creditsAvailable ?? undefined,
    }));
  }, [orgUsersData?.users]);

  // Transform project admin users to TeamMember format
  const projectAdminTeamMembers: TeamMember[] = useMemo(() => {
    if (!projectAdminUsersData?.users) return [];
    return projectAdminUsersData.users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name || "",
      role: user.role,
      status: "active" as const,
      joinedAt: user.joinedAt || user.createdAt,
      image: user.image,
      projects: user.projects || [],
      creditsUsed: user.creditsUsed ?? undefined,
      creditsAvailable: user.creditsAvailable ?? undefined,
    }));
  }, [projectAdminUsersData?.users]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleViewDetail = (user: UserType) => {
    setSelectedUserId(user.id);
    setDetailDialogOpen(true);
  };

  const handleToggleRole = (user: UserType) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const confirmRoleChange = () => {
    if (!selectedUser) return;
    const newRole =
      selectedUser.role === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN;
    updateRoleMutation.mutate(
      { userId: selectedUser.id, role: newRole },
      {
        onSuccess: () => {
          setRoleDialogOpen(false);
          setSelectedUser(null);
          toast.success(`User role updated to ${newRole}`);
        },
        onError: (error: any) => {
          toast.error(error?.message || "Failed to update user role");
        },
      }
    );
  };

  const handleSendInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    inviteAdminMutation.mutate(inviteEmail, {
      onSuccess: () => {
        setInviteDialogOpen(false);
        setInviteEmail("");
        toast.success("Admin invitation sent successfully");
      },
      onError: (error: any) => {
        toast.error(error?.message || "Failed to send invitation");
      },
    });
  };

  // Team management handlers for Org Admins
  const handleAddTeammate = () => {
    setAddTeammateDialogOpen(true);
  };

  const handleSearchUser = () => {
    if (!inviteOrgUserEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteOrgUserEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSearchingUser(true);
    searchUserMutation.mutate(inviteOrgUserEmail.trim(), {
      onSuccess: (data: { user: any }) => {
        setSearchedUser(data.user);
        setIsSearchingUser(false);
      },
      onError: () => {
        setSearchedUser(null);
        setIsSearchingUser(false);
      },
    });
  };

  const handleInviteOrgUser = () => {
    const orgId = finalOrganization?.id || userOrganizationId;
    setInviteError(null);

    if (!orgId || !inviteOrgUserEmail.trim()) {
      const errorMsg = "Please enter an email address";
      setInviteError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteOrgUserEmail.trim())) {
      const errorMsg = "Please enter a valid email address";
      setInviteError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    inviteOrgUserMutation.mutate(
      {
        orgId: orgId,
        email: inviteOrgUserEmail.trim(),
      },
      {
        onSuccess: () => {
          setAddTeammateDialogOpen(false);
          setInviteOrgUserEmail("");
          setSearchedUser(null);
          setInviteError(null);
          refetchOrgUsers();
          toast.success("User invited to organization successfully");
        },
        onError: (error: any) => {
          let errorMessage = "Failed to invite user to organization";

          if (error?.data) {
            errorMessage =
              error.data.message || error.data.error || errorMessage;
          } else if (error instanceof Error) {
            const message = error.message;
            try {
              const jsonMatch = message.match(/\{.*\}/);
              if (jsonMatch) {
                const errorData = JSON.parse(jsonMatch[0]);
                errorMessage = errorData.message || errorData.error || message;
              } else {
                errorMessage = message;
              }
            } catch {
              errorMessage = message;
            }
          } else if (error?.message) {
            errorMessage = error.message;
          }

          setInviteError(errorMessage);
        },
      }
    );
  };

  const handleManageCredits = (member: TeamMember) => {
    setSelectedTeamMember(member);
    setTimeout(() => setManageCreditsDialogOpen(true), 0);
  };

  const handleManageRole = (member: TeamMember) => {
    setSelectedTeamMember(member);
    setTimeout(() => setManageRoleDialogOpen(true), 0);
  };

  const handleRemoveUser = (member: TeamMember) => {
    setSelectedTeamMember(member);
    setTimeout(() => setRemoveUserDialogOpen(true), 0);
  };

  const confirmRemoveUser = () => {
    if (!selectedTeamMember) return;
    removeUserMutation.mutate(selectedTeamMember.id, {
      onSuccess: () => {
        setRemoveUserDialogOpen(false);
        setSelectedTeamMember(null);
        refetchOrgUsers();
        toast.success("User removed from organization");
      },
      onError: (error: any) => {
        toast.error(error?.message || "Failed to remove user");
      },
    });
  };

  const handleSaveRole = async (data: {
    memberId: string;
    orgRole: string;
    projectRoles: Array<{ projectId: string; role: string }>;
  }) => {
    // For project admin, only update project roles
    if (isProjectAdmin && !isOrgAdmin) {
      try {
        const updatePromises: Promise<any>[] = [];

        // Update project roles only
        if (data.projectRoles && data.projectRoles.length > 0) {
          data.projectRoles.forEach(({ projectId, role }) => {
            updatePromises.push(
              updateProjectRoleMutation.mutateAsync({
                projectId,
                userId: data.memberId,
                role,
              })
            );
          });
        }

        await Promise.all(updatePromises);

        toast.success("Roles updated successfully");
        setManageRoleDialogOpen(false);
        setSelectedTeamMember(null);
        refetchProjectAdminUsers();
      } catch (error: any) {
        // Error is already handled by the mutation hooks
        console.error("Error updating roles:", error);
      }
      return;
    }

    // For org admin, update both org and project roles
    if (!finalOrganization?.id) {
      toast.error("Organization not found");
      return;
    }

    try {
      const updatePromises: Promise<any>[] = [];

      // Update organization role
      updatePromises.push(
        updateOrganizationRoleMutation.mutateAsync({
          organizationId: finalOrganization.id,
          userId: data.memberId,
          role: data.orgRole,
        })
      );

      // Update project roles
      if (data.projectRoles && data.projectRoles.length > 0) {
        data.projectRoles.forEach(({ projectId, role }) => {
          updatePromises.push(
            updateProjectRoleMutation.mutateAsync({
              projectId,
              userId: data.memberId,
              role,
            })
          );
        });
      }

      await Promise.all(updatePromises);

      toast.success("Roles updated successfully");
      setManageRoleDialogOpen(false);
      setSelectedTeamMember(null);
      refetchOrgUsers();
    } catch (error: any) {
      // Error is already handled by the mutation hooks
      console.error("Error updating roles:", error);
    }
  };

  const handleSaveCredits = async (data: {
    memberId: string;
    projectCredits: Array<{ projectId: string; creditLimit: number }>;
  }) => {
    if (!data.projectCredits || data.projectCredits.length === 0) {
      toast.error("No credit limits to update");
      return;
    }

    try {
      // Update limits for each project
      const updatePromises = data.projectCredits.map(({ projectId, creditLimit }) =>
        updateWalletLimitMutation.mutateAsync({
          projectId,
          userId: data.memberId,
          limit: creditLimit,
        })
      );

      await Promise.all(updatePromises);

      toast.success("Credits updated successfully");
      setManageCreditsDialogOpen(false);
      setSelectedTeamMember(null);
      if (isOrgAdmin) {
        refetchOrgUsers();
      } else if (isProjectAdmin) {
        refetchProjectAdminUsers();
      }
    } catch (error: any) {
      // Error is already handled by the mutation hook
      console.error("Error updating credits:", error);
    }
  };

  // Set default tab based on role
  useEffect(() => {
    if (isOrgAdmin && activeTab === "all") {
      setActiveTab("org");
    }
  }, [isOrgAdmin, activeTab]);

  // Compute project credits data for ManageCreditsDialog
  // Filter out archived projects - users shouldn't be able to manage credits for archived projects
  const projectCreditsData = useMemo(() => {
    if (!selectedTeamMember?.projects) return [];
    
    // Filter out archived projects
    const activeProjects = selectedTeamMember.projects.filter(
      (p) => p.status !== "archived" && p.status !== "Archived"
    );
    
    // Create a map of projectId -> wallet data for quick lookup
    const walletMap = new Map();
    userWalletsData?.wallets?.forEach((wallet) => {
      walletMap.set(wallet.projectId, wallet);
    });

    // Map projects to credit data, using real wallet data when available
    return activeProjects.map((p) => {
      const wallet = walletMap.get(p.id);
      if (wallet) {
        // Use real wallet data
        return {
          projectId: p.id,
          projectName: p.name,
          currentLimit: wallet.limit ?? 0,
          creditsUsed: wallet.currentSpending || 0,
          creditsAvailable: wallet.limit !== null 
            ? Math.max(0, (wallet.limit || 0) - (wallet.currentSpending || 0))
            : null,
        };
      } else {
        // No wallet exists yet, show 0 values
        return {
          projectId: p.id,
          projectName: p.name,
          currentLimit: 0,
          creditsUsed: 0,
          creditsAvailable: 0,
        };
      }
    });
  }, [selectedTeamMember?.projects, userWalletsData?.wallets]);

  // For project admins, render the new Team management UI (similar to org admins but without add/remove/role management)
  if (isProjectAdmin && !isFullAdmin && !isOrgAdmin) {
    const projectAdminOrganization = projectAdminUsersData?.organization;
    
    return (
      <AdminLayout>
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <TeamMembersTable
              members={projectAdminTeamMembers}
              isLoading={projectAdminUsersLoading}
              organizationName={projectAdminOrganization?.name}
              onManageCredits={handleManageCredits}
              showAddMember={false}
              showRemoveUser={false}
              showManageRole={false}
            />

            {/* Manage Credits Dialog */}
            <ManageCreditsDialog
              open={manageCreditsDialogOpen}
              onOpenChange={setManageCreditsDialogOpen}
              member={selectedTeamMember}
              projectCredits={projectCreditsData}
              isLoading={isLoadingUserWallets}
              isSaving={updateWalletLimitMutation.isPending}
              onSave={handleSaveCredits}
            />
          </div>
        </div>
      </AdminLayout>
    );
  }

  // For org admins, render the new Team management UI
  if (isOrgAdmin && !isFullAdmin) {
    return (
      <AdminLayout>
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <TeamMembersTable
              members={teamMembers}
              isLoading={orgsLoading || orgUsersLoading}
              organizationName={finalOrganization?.name}
              onAddMember={handleAddTeammate}
              onManageCredits={handleManageCredits}
              onManageRole={handleManageRole}
              onRemoveUser={handleRemoveUser}
            />

            {/* Add Teammate Dialog */}
            <AddTeammateDialog
              open={addTeammateDialogOpen}
              onOpenChange={(open) => {
                setAddTeammateDialogOpen(open);
                if (!open) {
                  setInviteOrgUserEmail("");
                  setSearchedUser(null);
                  setInviteError(null);
                }
              }}
              email={inviteOrgUserEmail}
              onEmailChange={(value) => {
                setInviteOrgUserEmail(value);
                setInviteError(null);
              }}
              onInvite={handleInviteOrgUser}
              isLoading={inviteOrgUserMutation.isPending}
              error={inviteError}
            />

            {/* Manage Role Dialog */}
            <ManageRoleDialog
              open={manageRoleDialogOpen}
              onOpenChange={setManageRoleDialogOpen}
              member={selectedTeamMember}
              projects={selectedTeamMember?.projects || []}
              isSaving={
                updateOrganizationRoleMutation.isPending ||
                updateProjectRoleMutation.isPending
              }
              onSave={handleSaveRole}
            />

            {/* Manage Credits Dialog */}
            <ManageCreditsDialog
              open={manageCreditsDialogOpen}
              onOpenChange={setManageCreditsDialogOpen}
              member={selectedTeamMember}
              projectCredits={projectCreditsData}
              isLoading={isLoadingUserWallets}
              isSaving={updateWalletLimitMutation.isPending}
              onSave={handleSaveCredits}
            />

            {/* Remove User Dialog */}
            <RemoveUserFromOrgDialog
              open={removeUserDialogOpen}
              onOpenChange={(open) => {
                setRemoveUserDialogOpen(open);
                if (!open) {
                  setSelectedTeamMember(null);
                }
              }}
              userName={selectedTeamMember?.name || null}
              userEmail={selectedTeamMember?.email || null}
              onConfirm={confirmRemoveUser}
              isPending={removeUserMutation.isPending}
            />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <UsersHeader isProjectAdmin={isProjectAdmin} />

          <Tabs
            value={
              isProjectAdmin
                ? "project"
                : isOrgAdmin
                  ? activeTab || "org"
                  : "all"
            }
            onValueChange={(v) => setActiveTab(v as "all" | "org" | "project")}
          >
            <TabsList className="mb-4">
              {isFullAdmin && <TabsTrigger value="all">All Users</TabsTrigger>}
              {isOrgAdmin && (
                <TabsTrigger value="org">
                  <Building2 className="h-4 w-4 mr-2" />
                  Organization Users
                </TabsTrigger>
              )}
              {isProjectAdmin && (
                <TabsTrigger value="project">
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Project Members
                </TabsTrigger>
              )}
            </TabsList>

            {/* All Users Tab (Full Admins only) */}
            {isFullAdmin && (
              <TabsContent value="all">
                <AllUsersTable
                  data={usersData}
                  isLoading={isLoading}
                  isFetching={isFetching}
                  searchQuery={searchQuery}
                  currentPage={currentPage}
                  onSearchChange={handleSearchChange}
                  onPageChange={setCurrentPage}
                  onViewDetail={handleViewDetail}
                  onToggleRole={handleToggleRole}
                  onInviteAdmin={() => setInviteDialogOpen(true)}
                  onRefresh={() => {
                    // Refetch will happen automatically due to query invalidation
                    setSearchQuery(searchQuery);
                  }}
                />
              </TabsContent>
            )}

            {/* Project Members Tab (Project Admins only) */}
            {isProjectAdmin && (
              <TabsContent value="project">
                <ProjectMembersTable
                  data={usersData}
                  isLoading={isLoading}
                  isFetching={isFetching}
                  searchQuery={searchQuery}
                  currentPage={currentPage}
                  onSearchChange={handleSearchChange}
                  onPageChange={setCurrentPage}
                  onInviteToProject={() => {
                    setInviteToProjectDialogOpen(true);
                    refetchAvailableOrgUsers();
                  }}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Dialogs */}
        <UserDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          userDetail={userDetail}
          isLoading={isLoadingDetail}
        />

        <InviteAdminDialog
          open={inviteDialogOpen}
          onOpenChange={(open) => {
            setInviteDialogOpen(open);
            if (!open) setInviteEmail("");
          }}
          email={inviteEmail}
          onEmailChange={setInviteEmail}
          isLoading={inviteAdminMutation.isPending}
          onSubmit={handleSendInvite}
        />

        <RoleChangeDialog
          open={roleDialogOpen}
          onOpenChange={(open) => {
            setRoleDialogOpen(open);
            if (!open) setSelectedUser(null);
          }}
          user={selectedUser}
          isLoading={updateRoleMutation.isPending}
          onConfirm={confirmRoleChange}
          onCancel={() => setSelectedUser(null)}
        />

        {isProjectAdmin && userOrganizationId && userProjectId && (
          <InviteToProjectDialog
            open={inviteToProjectDialogOpen}
            onOpenChange={setInviteToProjectDialogOpen}
            users={availableOrgUsersData?.users || []}
            onAddUser={(userId) => {
              addToProjectMutation.mutate(userId, {
                onSuccess: () => {
                  setInviteToProjectDialogOpen(false);
                  refetchAvailableOrgUsers();
                  toast.success("User added to project successfully");
                },
                onError: (error: any) => {
                  toast.error(
                    error?.message || "Failed to add user to project"
                  );
                },
              });
            }}
            isLoading={addToProjectMutation.isPending}
            isFetching={isLoadingAvailableUsers || isFetchingAvailableUsers}
          />
        )}
      </div>
    </AdminLayout>
  );
}
