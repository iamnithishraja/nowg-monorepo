import * as React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import Team from "~/models/teamModel";
import TeamMember from "~/models/teamMemberModel";
import TeamInvitation from "~/models/teamInvitationModel";
import { TeamOnboardingDialog } from "~/components/TeamOnboardingDialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { SidebarProvider } from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/AppSidebar";
import { Header } from "~/components";
import Background from "~/components/Background";
import GlowEffects from "~/components/GlowEffects";
import {
  Users,
  Plus,
  Mail,
  Wallet,
  Settings,
  Trash2,
  UserPlus,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "~/lib/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return { teams: [], invitations: [] };
    }

    await connectToDatabase();

    const userId = session.user.id;
    const userEmail = session.user.email?.toLowerCase();

    // Get user's teams
    const memberships = await TeamMember.find({
      userId,
      status: "active",
    });

    const teams = await Promise.all(
      memberships.map(async (membership: any) => {
        const team = await Team.findById(membership.teamId);
        if (!team) return null;

        const memberCount = await TeamMember.countDocuments({
          teamId: team._id,
          status: "active",
        });

        return {
          id: team._id.toString(),
          name: team.name,
          description: team.description,
          balance: team.balance,
          adminId: team.adminId,
          role: membership.role,
          memberCount,
          createdAt: team.createdAt,
        };
      })
    );

    // Get pending invitations
    let invitations: any[] = [];
    if (userEmail) {
      invitations = await TeamInvitation.find({
        email: userEmail,
        status: "pending",
        expiresAt: { $gt: new Date() },
      }).populate("teamId");
    }

    return {
      teams: teams.filter(Boolean),
      invitations: invitations.map((inv: any) => ({
        id: inv._id.toString(),
        teamId: inv.teamId._id.toString(),
        teamName: inv.teamId.name,
        role: inv.role,
        invitedAt: inv.invitedAt,
        expiresAt: inv.expiresAt,
      })),
    };
  } catch (error) {
    console.error("Teams loader error:", error);
    return { teams: [], invitations: [] };
  }
}

export default function TeamsPage() {
  const { teams: initialTeams, invitations: initialInvitations } =
    useLoaderData<typeof loader>();
  const [teams, setTeams] = React.useState(initialTeams);
  const [invitations, setInvitations] = React.useState(initialInvitations);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showInviteDialog, setShowInviteDialog] = React.useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = React.useState(false);
  const [showRejectDialog, setShowRejectDialog] = React.useState(false);
  const [selectedTeam, setSelectedTeam] = React.useState<any>(null);
  const [selectedInvitation, setSelectedInvitation] = React.useState<any>(null);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("developer");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();

  const refreshTeams = async () => {
    try {
      const response = await fetch("/api/teams", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error("Failed to refresh teams:", err);
    }
  };

  const handleCreateTeam = (team: any) => {
    setTeams([...teams, team]);
    setShowCreateDialog(false);
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !inviteEmail) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/teams/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          teamId: selectedTeam.id,
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite member");
      }

      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("developer");
      setSelectedTeam(null);
    } catch (err: any) {
      setError(err.message || "Failed to invite member");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!selectedInvitation) return;

    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/teams/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ invitationId: selectedInvitation.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      // Remove from invitations and refresh teams
      setInvitations(
        invitations.filter((inv) => inv.id !== selectedInvitation.id)
      );
      await refreshTeams();
      setShowAcceptDialog(false);
      setSelectedInvitation(null);
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (!selectedInvitation) return;

    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/teams/invitations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ invitationId: selectedInvitation.id }),
      });

      if (response.ok) {
        setInvitations(
          invitations.filter((inv) => inv.id !== selectedInvitation.id)
        );
        setShowRejectDialog(false);
        setSelectedInvitation(null);
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject invitation");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reject invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-screen w-screen bg-black text-white flex overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Background />
          <GlowEffects />
        </div>

        <AppSidebar className="shrink-0" />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header showAuthButtons={false} showSidebarToggle={true} />

          <main className="relative z-20 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
              <div className="container mx-auto max-w-7xl">
                {/* Header */}
                <div className="mb-8">
                  <Button
                    variant="ghost"
                    className="mb-4"
                    onClick={() => navigate(-1)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground mb-2">
                        Teams
                      </h1>
                      <p className="text-muted-foreground">
                        Manage your teams, invite members, and collaborate on
                        projects
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowCreateDialog(true)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Team
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                    {error}
                  </div>
                )}

                {/* Pending Invitations */}
                {invitations.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-foreground mb-4">
                      Pending Invitations
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {invitations.map((inv) => (
                        <div
                          key={inv.id}
                          className="p-4 rounded-lg border border-border bg-card"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-medium text-foreground">
                                {inv.teamName}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Role: {inv.role}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedInvitation(inv);
                                setShowAcceptDialog(true);
                              }}
                              disabled={loading}
                              className="flex-1"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedInvitation(inv);
                                setShowRejectDialog(true);
                              }}
                              disabled={loading}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teams List */}
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Your Teams
                  </h2>
                  {teams.length === 0 ? (
                    <div className="text-center py-12 rounded-lg border border-border bg-card">
                      <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        No teams yet
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Create your first team to start collaborating
                      </p>
                      <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Team
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {teams.map((team) => (
                        <div
                          key={team.id}
                          className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/teams/${team.id}`)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-foreground mb-1">
                                {team.name}
                              </h3>
                              {team.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {team.description}
                                </p>
                              )}
                            </div>
                            {team.role === "admin" && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-primary/10 text-primary">
                                Admin
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Balance
                              </span>
                              <span className="font-medium text-foreground">
                                ${team.balance.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Members
                              </span>
                              <span className="font-medium text-foreground">
                                {team.memberCount}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTeam(team);
                                setShowInviteDialog(true);
                              }}
                              className="flex-1"
                            >
                              <UserPlus className="w-4 h-4 mr-1" />
                              Invite
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/teams/${team.id}`);
                              }}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Create Team Dialog */}
              <TeamOnboardingDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onSuccess={handleCreateTeam}
              />

              {/* Invite Member Dialog */}
              <Dialog
                open={showInviteDialog}
                onOpenChange={setShowInviteDialog}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join {selectedTeam?.name}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleInviteMember} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Email Address
                      </label>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        disabled={loading}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50 bg-background"
                      >
                        <option value="developer">Developer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    {error && (
                      <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                        {error}
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowInviteDialog(false)}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Send Invitation
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </main>
        </div>
      </div>

      {/* Accept Invitation Confirmation Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Accept Team Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to join{" "}
              <strong>{selectedInvitation?.teamName}</strong> as a{" "}
              <strong>{selectedInvitation?.role}</strong>? You will gain access
              to all team projects and resources.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAcceptDialog(false);
                setSelectedInvitation(null);
                setError(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleAcceptInvitation} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Invitation Confirmation Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Reject Team Invitation
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reject the invitation to join{" "}
              <strong>{selectedInvitation?.teamName}</strong>? This action
              cannot be undone and you will need to be invited again to join
              this team.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setSelectedInvitation(null);
                setError(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectInvitation}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Invitation
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
