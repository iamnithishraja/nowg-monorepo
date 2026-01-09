import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  AlertTriangle,
  Users,
  BarChart3,
  Percent,
  Globe,
  Server,
  Database,
  Save,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { client } from "@/lib/client";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/roles";

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

type OrganizationsResponse = {
  organizations: OrganizationType[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export default function Organizations() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignAdminDialogOpen, setAssignAdminDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [markupDialogOpen, setMarkupDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationType | null>(null);

  // Form states
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [searchedUser, setSearchedUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
  } | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  
  // Markup states
  const [markupValues, setMarkupValues] = useState<{
    openrouter: string;
    deployment: string;
    managed_database: string;
  }>({
    openrouter: "20", // Default 20% for openrouter
    deployment: "",
    managed_database: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const isOrgAdmin = userRole === UserRole.ORG_ADMIN;

  const { data: orgsData, isLoading } = useQuery<OrganizationsResponse>({
    queryKey: ["/api/admin/organizations", currentPage, searchQuery],
    queryFn: () =>
      client.get<OrganizationsResponse>("/api/admin/organizations", {
        params: {
          page: currentPage,
          limit: 10,
          ...(searchQuery && { search: searchQuery }),
        },
      }),
  });

  // Search user by email mutation
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

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      allowedDomains: string[];
    }) => {
      return client.post("/api/admin/organizations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "Success",
        description: "Organization created successfully",
      });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      description?: string;
      allowedDomains?: string[];
      status?: string;
    }) => {
      return client.put(`/api/admin/organizations/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "Success",
        description: "Organization updated successfully",
      });
      setEditDialogOpen(false);
      setSelectedOrg(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignAdminMutation = useMutation({
    mutationFn: async (data: { orgId: string; email: string }) => {
      return client.post(
        `/api/admin/organizations/${data.orgId}/assign-admin`,
        {
          email: data.email,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "Success",
        description: "Invitation sent to user successfully",
      });
      setAssignAdminDialogOpen(false);
      setSelectedOrg(null);
      setAdminEmail("");
      setSearchedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return client.delete(`/api/admin/organizations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "Success",
        description: "Organization suspended successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedOrg(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const organizations = orgsData?.organizations || [];
  const pagination = orgsData?.pagination;

  const resetForm = () => {
    setOrgName("");
    setOrgDescription("");
    setAllowedDomains([]);
    setDomainInput("");
    setAdminEmail("");
    setSearchedUser(null);
  };

  const handleCreate = () => {
    if (!orgName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      name: orgName,
      description: orgDescription,
      allowedDomains,
    });
  };

  const handleEdit = (org: OrganizationType) => {
    setSelectedOrg(org);
    setOrgName(org.name);
    setOrgDescription(org.description || "");
    setAllowedDomains(org.allowedDomains || []);
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedOrg || !orgName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      id: selectedOrg.id,
      name: orgName,
      description: orgDescription,
      allowedDomains,
    });
  };

  const handleAssignAdmin = (org: OrganizationType) => {
    setSelectedOrg(org);
    setAssignAdminDialogOpen(true);
  };

  const handleManageUsers = (org: OrganizationType) => {
    setLocation(`/admin/organizations/${org.id}/users`);
  };

  const handleSearchUser = () => {
    if (!adminEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail.trim())) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingUser(true);
    searchUserMutation.mutate(adminEmail.trim());
  };

  const handleConfirmAssignAdmin = () => {
    if (!selectedOrg || !adminEmail.trim()) {
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

    assignAdminMutation.mutate({
      orgId: selectedOrg.id,
      email: adminEmail.trim(),
    });
  };

  const handleDelete = (org: OrganizationType) => {
    setSelectedOrg(org);
    setDeleteDialogOpen(true);
  };

  const handleWallet = (org: OrganizationType) => {
    setLocation(`/admin/organizations/${org.id}/wallet`);
  };

  const handleMarkup = (org: OrganizationType) => {
    setSelectedOrg(org);
    setMarkupDialogOpen(true);
    // Reset markup values with default 20% for openrouter
    setMarkupValues({
      openrouter: "20",
      deployment: "",
      managed_database: "",
    });
  };

  // Fetch markups when dialog opens for selected org
  const { data: markupsData } = useQuery<{
    success: boolean;
    markups: Array<{
      id: string;
      organizationId: string;
      provider: "openrouter" | "deployment" | "managed_database";
      value: number;
    }>;
  }>({
    queryKey: ["/api/admin/markup/getMarkup"],
    queryFn: () => client.get("/api/admin/markup/getMarkup"),
    enabled: markupDialogOpen && !!selectedOrg,
  });

  // Update markup values when data is fetched
  useEffect(() => {
    if (markupsData?.markups && selectedOrg) {
      const orgMarkups = markupsData.markups.filter(
        (m) => m.organizationId === selectedOrg.id
      );
      const values: any = {
        openrouter: "20", // Default
        deployment: "",
        managed_database: "",
      };
      orgMarkups.forEach((markup) => {
        values[markup.provider] = markup.value.toString();
      });
      setMarkupValues(values);
    }
  }, [markupsData, selectedOrg]);

  const updateMarkupMutation = useMutation({
    mutationFn: async (data: {
      organizationId: string;
      provider: string;
      value: number;
    }) => {
      return client.post("/api/admin/markup/createMarkup", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/markup"] });
      toast({
        title: "Success",
        description: "Markup updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update markup",
        variant: "destructive",
      });
    },
  });

  const handleSaveMarkup = (
    provider: "openrouter" | "deployment" | "managed_database"
  ) => {
    if (!selectedOrg) return;

    const value = parseFloat(markupValues[provider]);
    if (isNaN(value) || value < 0 || value > 100) {
      toast({
        variant: "destructive",
        title: "Invalid Value",
        description: "Markup percentage must be between 0 and 100",
      });
      return;
    }

    updateMarkupMutation.mutate({
      organizationId: selectedOrg.id,
      provider,
      value,
    });
  };

  const handleConfirmDelete = () => {
    if (!selectedOrg) return;
    deleteMutation.mutate(selectedOrg.id);
  };

  const addDomain = () => {
    if (domainInput.trim() && !allowedDomains.includes(domainInput.trim())) {
      setAllowedDomains([...allowedDomains, domainInput.trim()]);
      setDomainInput("");
    }
  };

  const removeDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter((d) => d !== domain));
  };

  const getInvitationStatusBadge = (status: string | null) => {
    if (!status) return null;
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return null;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">
            Manage organizations and assign organization admins
          </p>
        </div>
        {!isOrgAdmin && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Organizations</CardTitle>
              <CardDescription>
                View and manage all organizations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No organizations found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Allowed Domains</TableHead>
                    <TableHead>Org Admin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {org.description || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {org.allowedDomains.length > 0 ? (
                            org.allowedDomains.map((domain, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs"
                              >
                                {domain}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              None
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {org.orgAdmin ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {org.orgAdmin.name || org.orgAdmin.email}
                            </span>
                            {getInvitationStatusBadge(org.invitationStatus)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Not assigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            org.status === "active" ? "default" : "secondary"
                          }
                        >
                          {org.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setLocation(
                                `/admin/analytics/organization/${org.id}`
                              )
                            }
                            title="View Analytics"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleWallet(org)}
                            title="Manage Wallet"
                          >
                            <Wallet className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkup(org)}
                            title="Manage Markup"
                          >
                            <Percent className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(org)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!org.orgAdmin ||
                          org.invitationStatus !== "accepted" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAssignAdmin(org)}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleManageUsers(org)}
                            title="Manage Organization Users"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(org)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * (pagination.limit || 10) + 1}{" "}
                    to{" "}
                    {Math.min(
                      currentPage * (pagination.limit || 10),
                      pagination.total
                    )}{" "}
                    of {pagination.total} organizations
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
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      {!isOrgAdmin && (
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>
                Create a new organization with allowed domains
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organization name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Organization description"
                  rows={3}
                />
              </div>
              <div>
                <Label>Allowed Domains</Label>
                <p className="text-sm text-muted-foreground mt-1 mb-2">
                  Only users with email addresses from these domains can be
                  invited as org admin or team members. Leave empty to allow all
                  domains.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDomain();
                      }
                    }}
                    placeholder="e.g., abc.com"
                  />
                  <Button type="button" onClick={addDomain}>
                    Add
                  </Button>
                </div>
                {allowedDomains.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {allowedDomains.map((domain, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="gap-1 cursor-pointer"
                        onClick={() => removeDomain(domain)}
                      >
                        {domain}
                        <XCircle className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update organization details and allowed domains
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organization name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={orgDescription}
                onChange={(e) => setOrgDescription(e.target.value)}
                placeholder="Organization description"
                rows={3}
              />
            </div>
            <div>
              <Label>Allowed Domains</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Only users with email addresses from these domains can be
                invited as org admin or team members. Leave empty to allow all
                domains.
              </p>
              <div className="flex gap-2">
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDomain();
                    }
                  }}
                  placeholder="e.g., abc.com"
                />
                <Button type="button" onClick={addDomain}>
                  Add
                </Button>
              </div>
              {allowedDomains.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {allowedDomains.map((domain, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="gap-1 cursor-pointer"
                      onClick={() => removeDomain(domain)}
                    >
                      {domain}
                      <XCircle className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={selectedOrg?.status || "active"}
                onValueChange={(value) => {
                  if (selectedOrg) {
                    updateMutation.mutate({
                      id: selectedOrg.id,
                      status: value,
                    });
                  }
                }}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedOrg(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Admin Dialog */}
      <Dialog
        open={assignAdminDialogOpen}
        onOpenChange={(open) => {
          setAssignAdminDialogOpen(open);
          if (!open) {
            setAdminEmail("");
            setSearchedUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Organization Admin</DialogTitle>
            <DialogDescription>
              Enter the email address of the user you want to invite as
              organization admin. An email will be sent to the user with
              accept/reject options.
              {selectedOrg && selectedOrg.allowedDomains.length > 0 && (
                <span className="block mt-2 text-amber-600">
                  Note: Only users with emails from these domains are allowed:{" "}
                  {selectedOrg.allowedDomains.join(", ")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="admin-email">User Email</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    setSearchedUser(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchUser();
                    }
                  }}
                  placeholder="user@example.com"
                  disabled={assignAdminMutation.isPending}
                />
                <Button
                  type="button"
                  onClick={handleSearchUser}
                  disabled={
                    isSearchingUser ||
                    searchUserMutation.isPending ||
                    !adminEmail.trim() ||
                    assignAdminMutation.isPending
                  }
                >
                  {isSearchingUser || searchUserMutation.isPending
                    ? "Searching..."
                    : "Search"}
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
                    {selectedOrg &&
                    isEmailDomainAllowed(
                      searchedUser.email,
                      selectedOrg.allowedDomains
                    ) ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                </div>
                {selectedOrg &&
                  selectedOrg.allowedDomains.length > 0 &&
                  !isEmailDomainAllowed(
                    searchedUser.email,
                    selectedOrg.allowedDomains
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
                            {selectedOrg.allowedDomains.map((d) => (
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
                setAssignAdminDialogOpen(false);
                setAdminEmail("");
                setSearchedUser(null);
              }}
              disabled={assignAdminMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAssignAdmin}
              disabled={
                assignAdminMutation.isPending ||
                !searchedUser ||
                !adminEmail.trim() ||
                !!(
                  selectedOrg &&
                  selectedOrg.allowedDomains.length > 0 &&
                  !isEmailDomainAllowed(adminEmail, selectedOrg.allowedDomains)
                )
              }
            >
              {assignAdminMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to suspend "{selectedOrg?.name}"? This
              action can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Markup Dialog */}
      <Dialog open={markupDialogOpen} onOpenChange={setMarkupDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Markup Settings</DialogTitle>
            <DialogDescription>
              Configure markup percentages for {selectedOrg?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* OpenRouter Markup */}
            <div className="space-y-2">
              <Label htmlFor="openrouter-markup" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                OpenRouter Markup (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="openrouter-markup"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={markupValues.openrouter}
                  onChange={(e) =>
                    setMarkupValues({
                      ...markupValues,
                      openrouter: e.target.value,
                    })
                  }
                  placeholder="20"
                  className="flex-1"
                />
                <span className="text-muted-foreground">%</span>
                <Button
                  onClick={() => handleSaveMarkup("openrouter")}
                  disabled={updateMarkupMutation.isPending || !markupValues.openrouter}
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Default: 20%. This markup will be applied to OpenRouter API usage costs.
              </p>
            </div>

            {/* Deployment Markup */}
            <div className="space-y-2">
              <Label htmlFor="deployment-markup" className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                Deployment Markup (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="deployment-markup"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={markupValues.deployment}
                  onChange={(e) =>
                    setMarkupValues({
                      ...markupValues,
                      deployment: e.target.value,
                    })
                  }
                  placeholder="0"
                  className="flex-1"
                />
                <span className="text-muted-foreground">%</span>
                <Button
                  onClick={() => handleSaveMarkup("deployment")}
                  disabled={updateMarkupMutation.isPending || !markupValues.deployment}
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Markup percentage for deployment services.
              </p>
            </div>

            {/* Managed Database Markup */}
            <div className="space-y-2">
              <Label htmlFor="managed-database-markup" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Managed Database Markup (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="managed-database-markup"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={markupValues.managed_database}
                  onChange={(e) =>
                    setMarkupValues({
                      ...markupValues,
                      managed_database: e.target.value,
                    })
                  }
                  placeholder="0"
                  className="flex-1"
                />
                <span className="text-muted-foreground">%</span>
                <Button
                  onClick={() => handleSaveMarkup("managed_database")}
                  disabled={updateMarkupMutation.isPending || !markupValues.managed_database}
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Markup percentage for managed database services.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMarkupDialogOpen(false);
                setSelectedOrg(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
