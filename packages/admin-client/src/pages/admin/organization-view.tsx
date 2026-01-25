import { RemoveUserFromOrgDialog } from "@/components/remove-user-from-org-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { client } from "@/lib/client";
import { UserRole } from "@nowgai/shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Plus,
    Search,
    Trash2,
    UserPlus,
    Wallet,
    XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

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

// Organization Users List Component
function OrgUsersList({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [removeUserDialogOpen, setRemoveUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const { data: orgUsersData, isLoading } = useQuery<{
    users: Array<{
      id: string;
      email: string;
      name: string;
      role: string;
    }>;
  }>({
    queryKey: [
      "/api/admin/organizations/:organizationId/users",
      organizationId,
    ],
    queryFn: () =>
      client.get<{
        users: Array<{
          id: string;
          email: string;
          name: string;
          role: string;
        }>;
      }>(`/api/admin/organizations/${organizationId}/users`),
    enabled: !!organizationId,
  });

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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemoveUser = (user: {
    id: string;
    name: string;
    email: string;
  }) => {
    setSelectedUser(user);
    setRemoveUserDialogOpen(true);
  };

  const handleConfirmRemoveUser = () => {
    if (!selectedUser) return;
    removeUserMutation.mutate(selectedUser.id);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading users...</div>;
  }

  if (!orgUsersData?.users || orgUsersData.users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No users found in this organization.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {orgUsersData.users.map((orgUser) => (
        <div
          key={orgUser.id}
          className="p-4 border rounded-lg flex items-center justify-between hover:bg-muted/50"
        >
          <div>
            <p className="font-medium">{orgUser.name || "No name"}</p>
            <p className="text-sm text-muted-foreground">{orgUser.email}</p>
            <Badge variant="secondary" className="mt-1">
              {orgUser.role}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveUser(orgUser)}
            disabled={removeUserMutation.isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <RemoveUserFromOrgDialog
        open={removeUserDialogOpen}
        onOpenChange={(open) => {
          setRemoveUserDialogOpen(open);
          if (!open) {
            setSelectedUser(null);
          }
        }}
        userName={selectedUser?.name || null}
        userEmail={selectedUser?.email || null}
        onConfirm={handleConfirmRemoveUser}
        isPending={removeUserMutation.isPending}
      />
    </div>
  );
}

export default function OrganizationView() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const isOrgAdmin = userRole === UserRole.ORG_ADMIN;
  const isFullAdmin =
    userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;
  const queryClient = useQueryClient();

  // Dialog states
  const [inviteUserDialogOpen, setInviteUserDialogOpen] = useState(false);
  const [addCreditsDialogOpen, setAddCreditsDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");
  const [searchedUser, setSearchedUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
  } | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  // Get organization ID from user's organizationId (for ORG_ADMIN)
  // For now, we'll fetch the first organization (which should be theirs)
  const { data: orgsData, isLoading } = useQuery<{
    organizations: OrganizationType[];
  }>({
    queryKey: ["/api/admin/organizations", 1],
    queryFn: () =>
      client.get<{ organizations: OrganizationType[] }>(
        "/api/admin/organizations",
        {
          params: {
            page: 1,
            limit: 1,
          },
        }
      ),
    enabled: userRole === UserRole.ORG_ADMIN,
  });

  const organization = orgsData?.organizations?.[0];

  // Fetch wallet data
  const { data: walletData } = useQuery<{
    wallet: {
      id: string;
      organizationId: string;
      balance: number;
    };
  }>({
    queryKey: ["/api/admin/org-wallets", organization?.id],
    queryFn: () =>
      client.get<{
        wallet: {
          id: string;
          organizationId: string;
          balance: number;
        };
      }>(`/api/admin/org-wallets/${organization?.id}`),
    enabled: !!organization?.id,
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
    mutationFn: async (data: { orgId: string; email: string }) => {
      return client.post(`/api/admin/organizations/${data.orgId}/invite-user`, {
        email: data.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "Success",
        description: "User invited to organization successfully",
      });
      setInviteUserDialogOpen(false);
      setInviteEmail("");
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

  // Add credits mutation (manual - for full admins only)
  const addCreditsMutation = useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return client.post(
        `/api/admin/org-wallets/${organization?.id}/add-credits`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organization?.id],
      });
      toast({
        title: "Credits Added",
        description: `Successfully added ${creditAmount} credits to the wallet`,
      });
      setAddCreditsDialogOpen(false);
      setCreditAmount("");
      setCreditDescription("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add credits",
        variant: "destructive",
      });
    },
  });

  // Stripe checkout mutation
  const stripeCheckoutMutation = useMutation({
    mutationFn: async (data: { amount: number }) => {
      // Get user's country code from browser location
      const { getCountryCodeForPayment } = await import("@/utils/payment");
      const countryCode = await getCountryCodeForPayment();
      console.log("🌍 Detected country code:", countryCode);

      const response = await client.post<{ 
        provider: string;
        url?: string; 
        sessionId: string;
        keyId?: string;
        formData?: Record<string, string>;
        formAction?: string;
      }>(
        `/api/admin/org-wallets/${organization?.id}/stripe-checkout`,
        { ...data, countryCode }
      );
      return { ...response, amount: data.amount };
    },
    onSuccess: async (data) => {
      if (data) {
        const { handlePaymentResponse } = await import("@/utils/payment");
        await handlePaymentResponse(data, data.amount);
      }
    },
    onError: (error: any) => {
      console.error("Stripe checkout error:", error);
      toast({
        title: "Error",
        description:
          error?.message ||
          "Failed to create checkout session. Please check your Stripe configuration.",
        variant: "destructive",
      });
    },
  });

  // Stripe verify mutation
  const stripeVerifyMutation = useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      return client.post(
        `/api/admin/org-wallets/${organization?.id}/stripe-verify`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organization?.id],
      });
      toast({
        title: "Payment Successful",
        description: "Credits have been added to your wallet",
      });
      setAddCreditsDialogOpen(false);
      setCreditAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to verify payment",
        variant: "destructive",
      });
    },
  });

  // Check for payment success in URL and verify payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    // Use organization from state or wait for it to load
    if (payment === "success" && sessionId && organization?.id) {
      // Verify the payment
      stripeVerifyMutation.mutate({ sessionId });
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [organization?.id]);

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
    if (!organization || !inviteEmail.trim()) {
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

    inviteUserMutation.mutate({
      orgId: organization.id,
      email: inviteEmail.trim(),
    });
  };

  const handleAddCredits = () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (!organization) return;

    addCreditsMutation.mutate({
      amount,
      description: creditDescription.trim(),
    });
  };

  const handleStripeCheckout = () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (!organization) return;

    stripeCheckoutMutation.mutate({ amount });
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

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center py-8">Loading organization...</div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <p>No organization found.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation("/admin/organizations")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Organizations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/admin/organizations")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">My Organization</h1>
            <p className="text-muted-foreground">{organization.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAddCreditsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Credits
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setLocation(`/admin/organizations/${organization.id}/wallet`)
            }
          >
            <Wallet className="h-4 w-4 mr-2" />
            Manage Wallet
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Details */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>
              Basic information about your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              <p className="text-base font-medium mt-1">{organization.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Description
              </label>
              <p className="text-base mt-1">
                {organization.description || "No description provided"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Status
              </label>
              <div className="mt-1">
                <Badge
                  variant={
                    organization.status === "active" ? "default" : "secondary"
                  }
                >
                  {organization.status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Created At
              </label>
              <p className="text-base mt-1">
                {new Date(organization.createdAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Organization Admin */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Admin</CardTitle>
            <CardDescription>
              Current organization administrator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {organization.orgAdmin ? (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Name
                  </label>
                  <p className="text-base font-medium mt-1">
                    {organization.orgAdmin.name || organization.orgAdmin.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Email
                  </label>
                  <p className="text-base mt-1">
                    {organization.orgAdmin.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Invitation Status
                  </label>
                  <div className="mt-1">
                    {getInvitationStatusBadge(organization.invitationStatus)}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No admin assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Allowed Domains */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Allowed Domains</CardTitle>
            <CardDescription>
              Email domains allowed for this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {organization.allowedDomains.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {organization.allowedDomains.map((domain, idx) => (
                  <Badge key={idx} variant="secondary" className="text-sm">
                    {domain}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No domain restrictions (all domains allowed)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Wallet Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Wallet Balance</CardTitle>
                <CardDescription>
                  Current credits available for your organization
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLocation(`/admin/organizations/${organization.id}/wallet`)
                }
              >
                <Wallet className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-3xl font-bold text-primary">
                  ${walletData?.wallet?.balance?.toFixed(2) || "0.00"}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {walletData?.wallet?.balance || 0} credits available
                </p>
              </div>
              <Button onClick={() => setAddCreditsDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Credits
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Organization Users */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Organization Users</CardTitle>
                <CardDescription>
                  Manage users in your organization
                </CardDescription>
              </div>
              <Button onClick={() => setInviteUserDialogOpen(true)} size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <OrgUsersList organizationId={organization.id} />
          </CardContent>
        </Card>
      </div>

      {/* Invite User Dialog */}
      <Dialog
        open={inviteUserDialogOpen}
        onOpenChange={(open) => {
          setInviteUserDialogOpen(open);
          if (!open) {
            setInviteEmail("");
            setSearchedUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User to Organization</DialogTitle>
            <DialogDescription>
              Enter the email address of the user you want to invite to your
              organization.
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
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
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
                setInviteUserDialogOpen(false);
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
                !inviteEmail.trim()
              }
            >
              {inviteUserMutation.isPending ? "Inviting..." : "Invite User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Credits Dialog */}
      <Dialog
        open={addCreditsDialogOpen}
        onOpenChange={(open) => {
          setAddCreditsDialogOpen(open);
          if (!open) {
            setCreditAmount("");
            setCreditDescription("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Credits
            </DialogTitle>
            <DialogDescription>
              {isOrgAdmin
                ? "Add credits to your organization's wallet. Payment method will be selected based on your location. 1 credit = $1 (1:1 ratio)"
                : "Add credits to your organization's wallet. 1 credit = $1"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="relative mt-2">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isOrgAdmin
                  ? "Enter the amount you want to pay. You'll receive the same amount in credits (1:1 ratio)."
                  : "Enter the number of credits to add"}
              </p>
            </div>

            {/* Description field only for full admins */}
            {isFullAdmin && (
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={creditDescription}
                  onChange={(e) => setCreditDescription(e.target.value)}
                  placeholder="e.g., Initial credit allocation, Bonus credits..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            )}

            {/* Payment Summary - Only show for org_admin */}
            {isOrgAdmin && creditAmount && parseFloat(creditAmount) > 0 && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span className="font-medium">Secure Payment</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount to Pay:</span>
                  <span className="font-medium">
                    ${parseFloat(creditAmount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Credits You'll Receive:
                  </span>
                  <span className="font-medium text-green-600">
                    ${parseFloat(creditAmount).toFixed(2)} credits
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total:</span>
                    <span>${parseFloat(creditAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAddCreditsDialogOpen(false);
                setCreditAmount("");
                setCreditDescription("");
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            {isOrgAdmin ? (
              <Button
                onClick={handleStripeCheckout}
                disabled={stripeCheckoutMutation.isPending || !creditAmount}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90"
              >
                {stripeCheckoutMutation.isPending ? (
                  "Processing..."
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Proceed to Payment
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleAddCredits}
                disabled={addCreditsMutation.isPending || !creditAmount}
                className="w-full sm:w-auto"
              >
                {addCreditsMutation.isPending ? "Adding..." : "Add Credits"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
