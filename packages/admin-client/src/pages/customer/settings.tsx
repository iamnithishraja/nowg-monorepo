import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  User,
  Users,
  CreditCard,
  Plus,
  Trash2,
  UserPlus,
  Building,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Team, Subscription, Plan } from "@shared/schema";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Sync profile form with user data when it loads
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  // Disabled - backend API not implemented
  const { data: teams = [], isLoading: isLoadingTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: false, // Disabled until backend is implemented
  });

  // Disabled - backend APIs not implemented
  const { data: subscriptions = [], isLoading: isLoadingSubscriptions } =
    useQuery<Subscription[]>({
      queryKey: ["/api/subscriptions"],
      enabled: false, // Disabled until backend is implemented
    });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    enabled: false, // Disabled until backend is implemented
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      if (!user) throw new Error("User not found");
      await apiRequest("PATCH", `/api/users/${user.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", "/api/teams", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setIsCreateTeamDialogOpen(false);
      setTeamName("");
      toast({
        title: "Team created",
        description: "Your team has been created successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create team. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ firstName, lastName });
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim()) {
      createTeamMutation.mutate(teamName);
    }
  };

  // Get current active subscription
  const activeSubscription = subscriptions.find(
    (sub) => sub.status === "active"
  );
  const currentPlan = activeSubscription
    ? plans.find((p) => p.id === activeSubscription.planId)
    : null;

  // Helper to safely format dates
  const formatDate = (date: Date | string) => {
    return format(
      typeof date === "string" ? new Date(date) : date,
      "MMM d, yyyy"
    );
  };

  return (
    <div className="flex-1 p-8">
      <div className="max-w-6xl mx-auto">
        <h1
          className="text-3xl font-semibold mb-8"
          data-testid="text-page-title"
        >
          Settings
        </h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList data-testid="tabs-settings">
            <TabsTrigger value="profile" data-testid="tab-profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="teams" data-testid="tab-teams">
              <Users className="h-4 w-4 mr-2" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">
              <CreditCard className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" data-testid="tab-content-profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Manage your account information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      data-testid="input-email"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      data-testid="input-last-name"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending
                      ? "Saving..."
                      : "Save Changes"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" data-testid="tab-content-teams">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle>Teams</CardTitle>
                      <CardDescription>
                        Manage your teams and collaborators
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => setIsCreateTeamDialogOpen(true)}
                      data-testid="button-create-team"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Team
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingTeams ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="p-4 border rounded-lg">
                          <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
                          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : teams.length > 0 ? (
                    <div className="space-y-3">
                      {teams.map((team) => (
                        <div
                          key={team.id}
                          className="p-4 border rounded-lg hover-elevate"
                          data-testid={`team-${team.id}`}
                        >
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Building className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3
                                  className="font-medium"
                                  data-testid={`team-name-${team.id}`}
                                >
                                  {team.name}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Created {formatDate(team.createdAt)}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              data-testid={`team-plan-${team.id}`}
                            >
                              {team.plan}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Users className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3
                        className="text-lg font-medium mb-2"
                        data-testid="text-no-teams"
                      >
                        No teams yet
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6 text-center">
                        Create a team to collaborate with others on projects
                      </p>
                      <Button
                        onClick={() => setIsCreateTeamDialogOpen(true)}
                        data-testid="button-create-first-team"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Team
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" data-testid="tab-content-billing">
            <div className="space-y-6">
              {/* Current Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>Your active subscription</CardDescription>
                </CardHeader>
                <CardContent>
                  {currentPlan ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div
                            className="text-2xl font-bold"
                            data-testid="text-plan-name"
                          >
                            {currentPlan.name}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            $
                            {parseFloat(currentPlan.price as string).toFixed(2)}{" "}
                            / {currentPlan.billingPeriod}
                          </div>
                        </div>
                        <Badge
                          variant="default"
                          data-testid="badge-subscription-status"
                        >
                          {activeSubscription?.status}
                        </Badge>
                      </div>
                      {activeSubscription && (
                        <div className="text-sm text-muted-foreground">
                          <p>
                            Current period ends:{" "}
                            {formatDate(activeSubscription.currentPeriodEnd)}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8">
                      <p
                        className="text-sm text-muted-foreground"
                        data-testid="text-no-subscription"
                      >
                        No active subscription
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Subscription History */}
              <Card>
                <CardHeader>
                  <CardTitle>Subscription History</CardTitle>
                  <CardDescription>
                    Your past and current subscriptions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSubscriptions ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-4 border rounded-lg">
                          <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
                          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : subscriptions.length > 0 ? (
                    <div className="space-y-3">
                      {subscriptions.map((subscription) => {
                        const plan = plans.find(
                          (p) => p.id === subscription.planId
                        );
                        return (
                          <div
                            key={subscription.id}
                            className="p-4 border rounded-lg"
                            data-testid={`subscription-${subscription.id}`}
                          >
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div>
                                <div
                                  className="font-medium"
                                  data-testid={`subscription-plan-${subscription.id}`}
                                >
                                  {plan?.name || "Unknown Plan"}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {formatDate(subscription.currentPeriodStart)}{" "}
                                  - {formatDate(subscription.currentPeriodEnd)}
                                </div>
                              </div>
                              <Badge
                                variant={
                                  subscription.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                                data-testid={`subscription-status-${subscription.id}`}
                              >
                                {subscription.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p
                      className="text-sm text-muted-foreground text-center py-8"
                      data-testid="text-no-subscriptions"
                    >
                      No subscription history
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Team Dialog */}
      <Dialog
        open={isCreateTeamDialogOpen}
        onOpenChange={setIsCreateTeamDialogOpen}
      >
        <DialogContent data-testid="dialog-create-team">
          <form onSubmit={handleCreateTeam}>
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">
                Create New Team
              </DialogTitle>
              <DialogDescription>
                Create a team to collaborate with others on projects
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  placeholder="My Awesome Team"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  data-testid="input-team-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateTeamDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTeamMutation.isPending}
                data-testid="button-submit-team"
              >
                {createTeamMutation.isPending ? "Creating..." : "Create Team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
