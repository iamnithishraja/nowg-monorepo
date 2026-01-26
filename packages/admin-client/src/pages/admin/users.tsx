import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AllUsersTable,
    InviteAdminDialog,
    InviteOrgUserDialog,
    InviteToProjectDialog,
    OrgUsersList,
    ProjectMembersTable,
    RoleChangeDialog,
    UserDetailDialog,
    UsersHeader,
    UserType,
} from "@/components/users";
import {
    useAddToProject,
    useAvailableOrgUsers,
    useInviteAdmin,
    useInviteOrgUser,
    useOrganizations,
    useSearchUser,
    useUpdateRole,
    useUserDetail,
    useUsers,
} from "@/components/users/hooks";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@nowgai/shared/types";
import { Building2, FolderKanban, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [inviteOrgUserDialogOpen, setInviteOrgUserDialogOpen] = useState(false);
  const [inviteOrgUserEmail, setInviteOrgUserEmail] = useState("");
  const [inviteToProjectDialogOpen, setInviteToProjectDialogOpen] =
    useState(false);
  const [searchedUser, setSearchedUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
  } | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "org" | "project">("all");

  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess;
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;
  const isFullAdmin =
    userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;
  const userProjectId = (user as any)?.projectId;
  const userOrganizationId = (user as any)?.organizationId;

  // Get organization for org_admin
  const { data: orgsData, isLoading: orgsLoading } =
    useOrganizations(isOrgAdmin);

  // Use organizationId from user object if available, otherwise use fetched orgs
  const organization = useMemo(() => {
    if (userOrganizationId && orgsData?.organizations) {
      const matchedOrg = orgsData.organizations.find(
        (org) => org.id === userOrganizationId
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

  // Fetch available users from organization for PROJECT_ADMIN to invite to project
  const { data: availableOrgUsersData, refetch: refetchAvailableOrgUsers } =
    useAvailableOrgUsers(
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
        },
      }
    );
  };

  const handleSendInvite = () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }
    inviteAdminMutation.mutate(inviteEmail, {
      onSuccess: () => {
        setInviteDialogOpen(false);
        setInviteEmail("");
      },
    });
  };

  const handleSearchUser = () => {
    if (!inviteOrgUserEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteOrgUserEmail.trim())) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingUser(true);
    searchUserMutation.mutate(inviteOrgUserEmail.trim(), {
      onSuccess: (data) => {
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
    if (!orgId || !inviteOrgUserEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter and search for a user email",
        variant: "destructive",
      });
      return;
    }

    if (!searchedUser) {
      toast({
        title: "Error",
        description: "Please search for a user first",
        variant: "destructive",
      });
      return;
    }

    inviteOrgUserMutation.mutate(
      {
        orgId: orgId,
        email: inviteOrgUserEmail.trim(),
      },
      {
        onSuccess: () => {
          setInviteOrgUserDialogOpen(false);
          setInviteOrgUserEmail("");
          setSearchedUser(null);
        },
      }
    );
  };

  // Set default tab based on role
  useEffect(() => {
    if (isOrgAdmin && activeTab === "all") {
      setActiveTab("org");
    }
  }, [isOrgAdmin, activeTab]);

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <UsersHeader isProjectAdmin={isProjectAdmin} />

        <Tabs
          value={
            isProjectAdmin ? "project" : isOrgAdmin ? activeTab || "org" : "all"
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
              />
            </TabsContent>
          )}

          {/* Organization Users Tab (Org Admins only) */}
          {isOrgAdmin && (
            <TabsContent value="org">
              <Card className="shadow-sm">
                <CardHeader className="border-b">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Organization Users
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Manage users in{" "}
                        {finalOrganization?.name || "your organization"}
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => setInviteOrgUserDialogOpen(true)}
                      size="sm"
                      className="flex items-center gap-2"
                      disabled={!finalOrganization}
                    >
                      <UserPlus className="h-4 w-4" />
                      Invite User
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {orgsLoading ? (
                    <div className="text-center py-4">
                      Loading organization...
                    </div>
                  ) : finalOrganization ? (
                    <OrgUsersList organizationId={finalOrganization.id} />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No organization found. Please contact support.
                    </div>
                  )}
                </CardContent>
              </Card>
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

      {isOrgAdmin && finalOrganization && (
        <InviteOrgUserDialog
          open={inviteOrgUserDialogOpen}
          onOpenChange={(open) => {
            setInviteOrgUserDialogOpen(open);
            if (!open) {
              setInviteOrgUserEmail("");
              setSearchedUser(null);
            }
          }}
          email={inviteOrgUserEmail}
          searchedUser={searchedUser}
          isSearching={isSearchingUser}
          onEmailChange={setInviteOrgUserEmail}
          onSearch={handleSearchUser}
          onInvite={handleInviteOrgUser}
          isLoading={inviteOrgUserMutation.isPending}
        />
      )}

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
              },
            });
          }}
          isLoading={addToProjectMutation.isPending}
        />
      )}
    </div>
  );
}
