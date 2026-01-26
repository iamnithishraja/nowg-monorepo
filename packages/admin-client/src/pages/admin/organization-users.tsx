import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { client } from "@/lib/client";
import { UserRole } from "@nowgai/shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    ArrowLeft,
    Building2,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Search,
    Trash2,
    UserPlus,
    Users
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";

interface OrganizationType {
  id: string;
  name: string;
  description: string;
  orgAdminId: string | null;
  orgAdmin: {
    id: string;
    email: string;
    name: string;
  } | null;
  allowedDomains: string[];
  status: string;
  invitationStatus: "pending" | "accepted" | "rejected" | null;
  invitedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}

interface OrgUsersResponse {
  users: OrgUser[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function OrganizationUsersPage() {
  const params = useParams();
  const organizationId = params.organizationId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeUserDialogOpen, setRemoveUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Invite user states
  const [inviteEmail, setInviteEmail] = useState("");
  const [searchedUser, setSearchedUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
  } | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const isOrgAdmin = userRole === UserRole.ORG_ADMIN;

  // Fetch organization details
  const { data: orgData, isLoading: orgLoading } = useQuery<{
    organization: OrganizationType;
  }>({
    queryKey: ["/api/admin/organizations", organizationId],
    queryFn: () =>
      client.get<{ organization: OrganizationType }>(
        `/api/admin/organizations/${organizationId}`
      ),
    enabled: !!organizationId,
  });

  // Fetch organization users
  const { data: usersData, isLoading: usersLoading } =
    useQuery<OrgUsersResponse>({
      queryKey: [
        "/api/admin/organizations/:organizationId/users",
        organizationId,
        currentPage,
        searchQuery,
      ],
      queryFn: () =>
        client.get<OrgUsersResponse>(
          `/api/admin/organizations/${organizationId}/users`,
          {
            params: {
              page: currentPage,
              limit: 10,
              ...(searchQuery && { search: searchQuery }),
            },
          }
        ),
      enabled: !!organizationId,
    });

  // Search user mutation
  const searchUserMutation = useMutation({
    mutationFn: async (email: string) => {
      return client.get<{
        user: {
          id: string;
          email: string;
          name: string;
          role: string;
        };
      }>("/api/admin/organizations/search-user", {
        params: { email },
      });
    },
    onSuccess: (data) => {
      setSearchedUser(data.user);
      setIsSearchingUser(false);
    },
    onError: (error: Error) => {
      setSearchedUser(null);
      setIsSearchingUser(false);
      toast({
        title: "User not found",
        description: error.message || "No user found with this email",
        variant: "destructive",
      });
    },
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (email: string) => {
      return client.post(
        `/api/admin/organizations/${organizationId}/invite-user`,
        {
          email,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations/:organizationId/users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations"],
      });
      toast({
        title: "Success",
        description: "User invited to organization successfully",
      });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setSearchedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to invite user",
        variant: "destructive",
      });
    },
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return client.delete(
        `/api/admin/organizations/${organizationId}/users/${userId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations/:organizationId/users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations"],
      });
      toast({
        title: "Success",
        description: "User removed from organization successfully",
      });
      setRemoveUserDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user",
        variant: "destructive",
      });
    },
  });

  const handleSearchUser = () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingUser(true);
    searchUserMutation.mutate(inviteEmail.trim());
  };

  const handleInviteUser = () => {
    if (!inviteEmail.trim()) {
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

    inviteUserMutation.mutate(inviteEmail.trim());
  };

  const handleRemoveUser = (orgUser: OrgUser) => {
    setSelectedUser(orgUser);
    setRemoveUserDialogOpen(true);
  };

  const confirmRemoveUser = () => {
    if (selectedUser) {
      removeUserMutation.mutate(selectedUser.id);
    }
  };

  // Helper to extract domain from email
  const getEmailDomain = (email: string): string => {
    const parts = email.toLowerCase().trim().split("@");
    return parts.length === 2 ? parts[1] : "";
  };

  // Check if email domain is allowed for an organization
  const isEmailDomainAllowed = (
    email: string,
    allowedDomains: string[]
  ): boolean => {
    if (!allowedDomains || allowedDomains.length === 0) {
      return true; // No restrictions if no domains are set
    }
    const emailDomain = getEmailDomain(email);
    if (!emailDomain) return false;
    return allowedDomains.some(
      (domain) => domain.toLowerCase() === emailDomain.toLowerCase()
    );
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "org_admin":
        return "default";
      case "org_user":
        return "secondary";
      case "project_admin":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatRoleName = (role: string) => {
    switch (role) {
      case "org_admin":
        return "Org Admin";
      case "org_user":
        return "Org User";
      case "project_admin":
        return "Project Admin";
      default:
        return role;
    }
  };

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Invalid organization ID</p>
      </div>
    );
  }

  const organization = orgData?.organization;
  const users = usersData?.users || [];
  const pagination = usersData?.pagination;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/admin/organizations")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Organization Users
          </h1>
          {organization && (
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Building2 className="h-4 w-4" />
              {organization.name}
            </p>
          )}
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Organization Details Card */}
      {organization && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Name</p>
                <p className="font-medium">{organization.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge
                  variant={
                    organization.status === "active" ? "default" : "secondary"
                  }
                >
                  {organization.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Allowed Domains
                </p>
                {organization.allowedDomains.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {organization.allowedDomains.map((domain, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {domain}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    All domains allowed
                  </span>
                )}
              </div>
              {organization.description && (
                <div className="md:col-span-3">
                  <p className="text-sm text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm">{organization.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organization Admin Card */}
      {organization?.orgAdmin && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Organization Admin
            </CardTitle>
            <CardDescription>
              The administrator of this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {organization.orgAdmin.name || "No name"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {organization.orgAdmin.email}
                </p>
              </div>
              <Badge variant="default" className="bg-primary">
                Admin
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Organization Members
              </CardTitle>
              <CardDescription>
                Manage users in this organization
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {orgLoading || usersLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : users.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((orgUser) => (
                      <TableRow key={orgUser.id}>
                        <TableCell className="font-medium">
                          {orgUser.name || "No name"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {orgUser.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(orgUser.role)}>
                            {formatRoleName(orgUser.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {orgUser.role !== "org_admin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveUser(orgUser)}
                              disabled={removeUserMutation.isPending}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * (pagination.limit || 10) + 1} to{" "}
                    {Math.min(
                      currentPage * (pagination.limit || 10),
                      pagination.total
                    )}{" "}
                    of {pagination.total} users
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(pagination.totalPages, p + 1)
                        )
                      }
                      disabled={currentPage === pagination.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No users found</p>
              <p className="text-sm">
                Invite users to this organization to get started
              </p>
              <Button
                className="mt-4"
                onClick={() => setInviteDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite First User
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite User Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onOpenChange={(open) => {
          setInviteDialogOpen(open);
          if (!open) {
            setInviteEmail("");
            setSearchedUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite User to Organization
            </DialogTitle>
            <DialogDescription>
              Enter the email address of the user you want to invite to this
              organization. The user will be assigned the ORG_USER role.
              {organization && organization.allowedDomains.length > 0 && (
                <span className="block mt-2 text-amber-600">
                  Note: Only users with emails from these domains are allowed:{" "}
                  {organization.allowedDomains.join(", ")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="invite-email">User Email</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setSearchedUser(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchUser();
                    }
                  }}
                  placeholder="user@example.com"
                  disabled={inviteUserMutation.isPending}
                />
                <Button
                  type="button"
                  onClick={handleSearchUser}
                  disabled={
                    isSearchingUser ||
                    searchUserMutation.isPending ||
                    !inviteEmail.trim() ||
                    inviteUserMutation.isPending
                  }
                >
                  {isSearchingUser || searchUserMutation.isPending ? (
                    "Searching..."
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
            {searchedUser && (
              <div className="space-y-3">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {searchedUser.name || "No name"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {searchedUser.email}
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {searchedUser.role}
                      </Badge>
                    </div>
                    {organization &&
                    isEmailDomainAllowed(
                      searchedUser.email,
                      organization.allowedDomains
                    ) ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                </div>
                {organization &&
                  organization.allowedDomains.length > 0 &&
                  !isEmailDomainAllowed(
                    searchedUser.email,
                    organization.allowedDomains
                  ) && (
                    <div className="p-4 border rounded-lg bg-amber-500/10 border-amber-500/50">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-600">
                            Domain not allowed
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            The user's email domain{" "}
                            <strong>
                              @{getEmailDomain(searchedUser.email)}
                            </strong>{" "}
                            is not in the organization's allowed domains.
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Allowed domains:{" "}
                            {organization.allowedDomains.map((d) => (
                              <Badge
                                key={d}
                                variant="outline"
                                className="mr-1 text-xs"
                              >
                                {d}
                              </Badge>
                            ))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}
            {searchUserMutation.isError && !searchedUser && (
              <div className="p-4 border rounded-lg bg-destructive/10 border-destructive/50">
                <p className="text-sm text-destructive">
                  User not found. Please check the email address and try again.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteDialogOpen(false);
                setInviteEmail("");
                setSearchedUser(null);
              }}
              disabled={inviteUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteUser}
              disabled={
                inviteUserMutation.isPending ||
                !searchedUser ||
                !inviteEmail.trim() ||
                (organization !== null &&
                  organization !== undefined &&
                  organization.allowedDomains.length > 0 &&
                  !isEmailDomainAllowed(
                    inviteEmail,
                    organization.allowedDomains
                  ))
              }
            >
              {inviteUserMutation.isPending ? "Inviting..." : "Invite User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove User Confirmation Dialog */}
      <AlertDialog
        open={removeUserDialogOpen}
        onOpenChange={setRemoveUserDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User from Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">
                {selectedUser?.name || selectedUser?.email}
              </span>{" "}
              from this organization? They will lose access to all organization
              resources and projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeUserMutation.isPending}
            >
              {removeUserMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
