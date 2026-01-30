import {
  ArrowLeft,
  CreditCard,
  Database,
  DollarSign,
  FolderKanban,
  Github,
  Loader2,
  Palette,
  Plus,
  Send,
  Settings,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  XCircle
} from "lucide-react";
import { MongoClient, ObjectId } from "mongodb";
import * as React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useNavigate } from "react-router";
import { Header } from "~/components";
import { ProjectSidebar } from "~/components/ProjectSidebar";
import Background from "~/components/Background";
import { FilePreview } from "~/components/FileUpload";
import GitHubImportModal from "~/components/GitHubImportModal";
import { Button } from "~/components/ui/button";
import { ColorSchemeDialog } from "~/components/ui/ColorSchemeDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { OPENROUTER_MODELS } from "~/consts/models";
import { useToast } from "~/hooks/use-toast";
import { useFileHandling } from "~/hooks/useFileHandling";
import { useSupabaseAuth } from "~/hooks/useSupabaseAuth";
import { auth } from "~/lib/auth";
import { createClientFileStorageService } from "~/lib/clientFileStorage";
import { connectToDatabase } from "~/lib/mongo";
import { cn } from "~/lib/utils";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { Conversation, ProjectWallet, Team, TeamInvitation, TeamMember } = await import("@nowgai/shared/models");
    
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      throw new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();

    const teamId = params.teamId;
    if (!teamId) {
      throw new Response("Team ID required", { status: 400 });
    }

    const userId = session.user.id;

    // Check if user is member
    const membership = await TeamMember.findOne({
      teamId,
      userId,
      status: "active",
    });

    if (!membership) {
      throw new Response("Not a member of this team", { status: 403 });
    }

    // Parallelize all data fetching
    const [team, members, invitations, projects] = await Promise.all([
      // Get team
      Team.findById(teamId),
      // Get all members
      TeamMember.find({
        teamId,
        status: "active",
      }),
      // Get pending invitations
      TeamInvitation.find({
        teamId,
      })
        .sort({ createdAt: -1 })
        .limit(50),
      // Get team projects
      Conversation.find({
        teamId,
        projectType: "team",
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .select("_id title model createdAt updatedAt messages"),
    ]);

    if (!team) {
      throw new Response("Team not found", { status: 404 });
    }

    // Fetch user details from BetterAuth (only if we have members)
    const userIds = members.map((m: any) => m.userId);
    const userMap = new Map();

    if (userIds.length > 0) {
      const connectionString = process.env.MONGODB_URI;
      if (connectionString) {
        try {
          const mongoClient = new MongoClient(connectionString);
          await mongoClient.connect();
          const db = mongoClient.db("nowgai");

          // Convert string userIds to ObjectIds for MongoDB query
          const objectIds = userIds
            .filter((id) => ObjectId.isValid(id))
            .map((id) => new ObjectId(id));

          if (objectIds.length > 0) {
            const users = await db
              .collection("user")
              .find(
                { _id: { $in: objectIds } },
                { projection: { email: 1, name: 1 } } // Only fetch needed fields
              )
              .toArray();

            users.forEach((user: any) => {
              userMap.set(user._id.toString(), {
                email: user.email || "",
                name: user.name || user.email || "Unknown User",
              });
            });
          }

        } catch (error) {
          console.error("Error fetching user details:", error);
        }
      }
    }

    // Get project wallets in parallel (batch query if possible)
    const projectIds = projects.map((p: any) => p._id);
    const wallets =
      projectIds.length > 0
        ? await ProjectWallet.find({
            conversationId: { $in: projectIds },
          })
        : [];

    // Create a map for quick wallet lookup
    const walletMap = new Map();
    wallets.forEach((wallet: any) => {
      walletMap.set(wallet.conversationId.toString(), wallet);
    });

    // Combine projects with wallets
    const projectsWithWallets = projects.map((project: any) => {
      const wallet = walletMap.get(project._id.toString());
      return {
        id: project._id.toString(),
        title: project.title,
        model: project.model,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        balance: wallet?.balance || 0,
        messageCount: project.messages?.length || 0,
      };
    });

    return {
      team: {
        id: team._id.toString(),
        name: team.name,
        description: team.description,
        balance: team.balance,
        adminId: team.adminId,
        settings: team.settings,
        createdAt: team.createdAt,
      },
      membership: {
        role: membership.role,
        userId: userId,
      },
      members: members.map((m: any) => {
        const userInfo = userMap.get(m.userId) || {
          email: "",
          name: m.userId, // Fallback to userId if user not found
        };
        return {
          userId: m.userId,
          name: userInfo.name,
          email: userInfo.email,
          role: m.role,
          walletLimit: m.walletLimit,
          currentSpending: m.currentSpending,
          joinedAt: m.joinedAt,
        };
      }),
      invitations: invitations.map((inv: any) => ({
        id: inv._id.toString(),
        email: inv.email,
        role: inv.role,
        status: inv.status,
        invitedBy: inv.invitedBy,
        invitedAt: inv.invitedAt,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        rejectedAt: inv.rejectedAt,
      })),
      projects: projectsWithWallets,
      user: session.user,
    };
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Team detail loader error:", error);
    throw new Response("Failed to load team", { status: 500 });
  }
}

export default function TeamDetailPage() {
  const { team, membership, members, invitations, projects, user } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<
    "overview" | "members" | "projects"
  >("overview");
  const [showInviteDialog, setShowInviteDialog] = React.useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] =
    React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showRechargeDialog, setShowRechargeDialog] = React.useState(false);
  const [showEditTeamDialog, setShowEditTeamDialog] = React.useState(false);
  const [showEditMemberDialog, setShowEditMemberDialog] = React.useState(false);
  const [showCancelInvitationDialog, setShowCancelInvitationDialog] =
    React.useState(false);
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] =
    React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<any>(null);
  const [selectedInvitation, setSelectedInvitation] = React.useState<any>(null);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("developer");
  const [projectModel, setProjectModel] = React.useState<string>(
    OPENROUTER_MODELS[0].id
  );
  const [projectPrompt, setProjectPrompt] = React.useState("");
  const [useSupabase, setUseSupabase] = React.useState(false);
  const [enableDesignScheme, setEnableDesignScheme] = React.useState(false);
  const [designScheme, setDesignScheme] = React.useState<any>(undefined);
  const [uploadedFiles, setUploadedFiles] = React.useState<File[]>([]);
  const [importedFiles, setImportedFiles] = React.useState<any[]>([]);
  const [showGitHubModal, setShowGitHubModal] = React.useState(false);
  const [walletAmount, setWalletAmount] = React.useState("");
  const [editTeamName, setEditTeamName] = React.useState(team.name);
  const [editTeamDescription, setEditTeamDescription] = React.useState(
    team.description || ""
  );
  const [editMemberRole, setEditMemberRole] = React.useState("developer");
  const [editMemberWalletLimit, setEditMemberWalletLimit] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [localMembers, setLocalMembers] = React.useState(members);
  const [localInvitations, setLocalInvitations] = React.useState(
    invitations.filter((inv: any) => inv.status !== "accepted")
  );
  const [localProjects, setLocalProjects] = React.useState(projects);
  const [teamBalance, setTeamBalance] = React.useState(team.balance);
  const [localTeam, setLocalTeam] = React.useState(team);

  const isAdmin = membership.role === "admin";

  // Refresh team balance
  const refreshTeamBalance = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/teams/wallet?teamId=${team.id}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTeamBalance(data.balance);
        }
      }
    } catch (err) {
      console.error("Failed to refresh team balance:", err);
    }
  }, [team.id]);

  // Refresh balance on mount and when returning from payment
  React.useEffect(() => {
    refreshTeamBalance();
    // Check if we're returning from a payment
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("payment_success") === "true") {
      refreshTeamBalance();
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refreshTeamBalance]);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
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
          teamId: team.id,
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

      // Refresh invitations
      const membersResponse = await fetch(
        `/api/teams/members?teamId=${team.id}`,
        {
          credentials: "include",
        }
      );
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setLocalInvitations(
          (membersData.invitations || []).filter(
            (inv: any) => inv.status !== "accepted"
          )
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to invite member");
    } finally {
      setLoading(false);
    }
  };

  // File handling hook
  const {
    imageDataList,
    isDragging,
    dragHandlers,
    handleFileSelect,
    handleRemoveFile,
  } = useFileHandling({
    uploadedFiles,
    setUploadedFiles,
  });

  // Supabase OAuth hook
  const {
    hasSupabaseConnected,
    isCheckingToken: isCheckingSupabase,
    supabaseUser,
    handleConnectSupabase,
    handleDisconnectSupabase,
    checkSupabaseToken,
  } = useSupabaseAuth();

  // Handle Supabase toggle
  const handleSupabaseToggle = (checked: boolean) => {
    if (checked && !hasSupabaseConnected && !isCheckingSupabase) {
      handleConnectSupabase();
      setUseSupabase(false);
    } else if (checked && hasSupabaseConnected) {
      setUseSupabase(true);
    } else {
      setUseSupabase(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectPrompt.trim()) {
      setError("Please enter a project description");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Generate an idempotency key for the initial user message
      const clientRequestId =
        (window.crypto && "randomUUID" in window.crypto
          ? (window.crypto as any).randomUUID()
          : Math.random().toString(36).slice(2)) +
        "-" +
        Date.now();

      // Initialize client-side file storage
      const fileStorageService = createClientFileStorageService();

      // Prepare filesMap (for imported files)
      const filesMap = {} as any;

      // Prepare uploaded files data for server
      const uploadedFilesData = await Promise.all(
        uploadedFiles.map(async (file) => {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });

          return {
            name: file.name,
            type: file.type,
            size: file.size,
            base64Data,
          };
        })
      );

      // Create team project with full features
      const response = await fetch("/api/teams/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          teamId: team.id,
          title: projectPrompt.slice(0, 50), // Temporary title, will be auto-generated
          model: projectModel,
          firstMessage: projectPrompt,
          filesMap,
          uploadedFiles: uploadedFilesData,
          clientRequestId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      if (data.success && data.conversationId) {
        const conversationId = data.conversationId;

        // Optionally provision Supabase for this conversation
        if (useSupabase) {
          try {
            const provisionResponse = await fetch("/api/supabase/provision", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId, enable: true }),
            });

            if (!provisionResponse.ok) {
              const errorData = await provisionResponse
                .json()
                .catch(() => ({}));
              console.error("Supabase provision failed:", errorData);
              if (errorData.error === "PROJECT_LIMIT_REACHED") {
                alert(
                  "Your Supabase organization has reached its project limit. Please delete some projects or upgrade your plan."
                );
              } else if (errorData.error === "SUPABASE_NOT_CONNECTED") {
                handleConnectSupabase();
              } else if (errorData.error === "SUPABASE_AUTH_ERROR") {
                handleConnectSupabase();
              } else {
                alert(
                  `Failed to provision Supabase project: ${
                    errorData.message || "Unknown error"
                  }`
                );
              }
              // Continue anyway - project is created
            } else {
              const provisionData = await provisionResponse.json();
              console.log("Supabase provisioned successfully:", provisionData);
            }
          } catch (e) {
            console.error("Supabase provision failed", e);
            // Continue anyway - project is created
          }
        }

        // Navigate to workspace with conversation ID
        navigate(`/workspace?conversationId=${conversationId}`, {
          state: {
            initialPrompt: projectPrompt,
            model: projectModel,
            hasUploadedFiles: uploadedFiles.length > 0,
            designScheme: enableDesignScheme ? designScheme : undefined,
            importedFiles: importedFiles,
          },
        });

        // Close dialog and reset state
        setShowCreateProjectDialog(false);
        setProjectPrompt("");
        setProjectModel(OPENROUTER_MODELS[0].id);
        setUseSupabase(false);
        setEnableDesignScheme(false);
        setDesignScheme(undefined);
        setUploadedFiles([]);
        setImportedFiles([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Background />
      </div>

      {/* Left Sidebar - ProjectSidebar */}
      <ProjectSidebar user={user} className="flex-shrink-0" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header showAuthButtons={false} showSidebarToggle={false} />

          <main className="relative z-20 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
              <div className="container mx-auto max-w-7xl">
                {/* Header */}
                <div className="mb-8">
                  <Link to="/teams">
                    <Button variant="ghost" className="mb-4">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Teams
                    </Button>
                  </Link>
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground mb-2">
                        {localTeam.name}
                      </h1>
                      {localTeam.description && (
                        <p className="text-muted-foreground">
                          {localTeam.description}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowEditTeamDialog(true)}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Edit Team
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowDeleteDialog(true)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Team
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                    {error}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="p-6 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Team Balance
                      </span>
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-foreground">
                        ${teamBalance.toFixed(2)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRechargeDialog(true)}
                        className="ml-2"
                      >
                        <CreditCard className="w-4 h-4 mr-1" />
                        Add Funds
                      </Button>
                    </div>
                  </div>
                  <div className="p-6 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Members
                      </span>
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {localMembers.length}
                    </p>
                  </div>
                  <div className="p-6 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Projects
                      </span>
                      <FolderKanban className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {localProjects.length}
                    </p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="mb-6">
                  <div className="flex gap-2 border-b border-border">
                    {[
                      { id: "overview", label: "Overview" },
                      { id: "members", label: "Members" },
                      { id: "projects", label: "Projects" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                          "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                          activeTab === tab.id
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-lg border border-border bg-card">
                      <h2 className="text-lg font-semibold text-foreground mb-4">
                        Quick Actions
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                          variant="outline"
                          onClick={() => setShowInviteDialog(true)}
                          className="h-auto py-4 flex flex-col items-start"
                        >
                          <UserPlus className="w-5 h-5 mb-2" />
                          <span className="font-medium">Invite Member</span>
                          <span className="text-xs text-muted-foreground">
                            Add new team members
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowCreateProjectDialog(true)}
                          className="h-auto py-4 flex flex-col items-start"
                        >
                          <Plus className="w-5 h-5 mb-2" />
                          <span className="font-medium">Create Project</span>
                          <span className="text-xs text-muted-foreground">
                            Start a new team project
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Members Tab */}
                {activeTab === "members" && (
                  <div className="space-y-6">
                    {isAdmin && (
                      <div className="flex justify-end">
                        <Button onClick={() => setShowInviteDialog(true)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invite Member
                        </Button>
                      </div>
                    )}

                    {/* Active Members */}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3">
                        Active Members ({localMembers.length})
                      </h3>
                      <div className="space-y-2">
                        {localMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground p-4 text-center">
                            No active members
                          </p>
                        ) : (
                          localMembers.map((member) => (
                            <div
                              key={member.userId}
                              className="p-4 rounded-lg border border-border bg-card flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {member.name || member.email || member.userId}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {member.email &&
                                    member.email !== member.name && (
                                      <span>{member.email} • </span>
                                    )}
                                  {member.role} • Joined{" "}
                                  {new Date(
                                    member.joinedAt
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                              {isAdmin &&
                                member.userId !== team.adminId &&
                                member.userId !== membership.userId && (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectedMember(member);
                                        setEditMemberRole(member.role);
                                        setEditMemberWalletLimit(
                                          member.walletLimit?.toString() || ""
                                        );
                                        setShowEditMemberDialog(true);
                                      }}
                                      title="Edit member"
                                    >
                                      <Settings className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectedMember(member);
                                        setShowRemoveMemberDialog(true);
                                      }}
                                      className="text-destructive hover:text-destructive"
                                      title="Remove member"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Pending/Rejected Invitations */}
                    {localInvitations.filter(
                      (inv: any) => inv.status !== "accepted"
                    ).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3">
                          Invitations (
                          {
                            localInvitations.filter(
                              (inv: any) => inv.status !== "accepted"
                            ).length
                          }
                          )
                        </h3>
                        <div className="space-y-2">
                          {localInvitations
                            .filter((inv: any) => inv.status !== "accepted")
                            .map((invitation: any) => {
                              const isExpired = invitation.expiresAt
                                ? new Date(invitation.expiresAt) < new Date()
                                : false;
                              const status = isExpired
                                ? "expired"
                                : invitation.status || "pending";

                              return (
                                <div
                                  key={invitation.id}
                                  className="p-4 rounded-lg border border-border bg-card flex items-center justify-between"
                                >
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {invitation.email}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {invitation.role}
                                      {invitation.invitedAt && (
                                        <>
                                          {" "}
                                          • Invited{" "}
                                          {new Date(
                                            invitation.invitedAt
                                          ).toLocaleDateString()}
                                        </>
                                      )}
                                      {status === "pending" && !isExpired && (
                                        <>
                                          {" • "}
                                          <span className="text-primary">
                                            Pending
                                          </span>
                                          {" • Expires "}
                                          {invitation.expiresAt
                                            ? new Date(
                                                invitation.expiresAt
                                              ).toLocaleDateString()
                                            : "Unknown"}
                                        </>
                                      )}
                                      {status === "accepted" && (
                                        <>
                                          {" • "}
                                          <span className="text-emerald-500">
                                            Accepted
                                          </span>
                                          {invitation.acceptedAt && (
                                            <>
                                              {" "}
                                              on{" "}
                                              {new Date(
                                                invitation.acceptedAt
                                              ).toLocaleDateString()}
                                            </>
                                          )}
                                        </>
                                      )}
                                      {status === "rejected" && (
                                        <>
                                          {" • "}
                                          <span className="text-destructive">
                                            Rejected
                                          </span>
                                          {invitation.rejectedAt && (
                                            <>
                                              {" "}
                                              on{" "}
                                              {new Date(
                                                invitation.rejectedAt
                                              ).toLocaleDateString()}
                                            </>
                                          )}
                                        </>
                                      )}
                                      {(status === "expired" || isExpired) && (
                                        <>
                                          {" • "}
                                          <span className="text-muted-foreground">
                                            Expired
                                          </span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  {isAdmin &&
                                    (status === "pending" || isExpired) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setSelectedInvitation(invitation);
                                          setShowCancelInvitationDialog(true);
                                        }}
                                        className="text-destructive hover:text-destructive"
                                        title="Cancel invitation"
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </Button>
                                    )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Projects Tab */}
                {activeTab === "projects" && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button onClick={() => setShowCreateProjectDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Project
                      </Button>
                    </div>
                    {localProjects.length === 0 ? (
                      <div className="text-center py-12 rounded-lg border border-border bg-card">
                        <FolderKanban className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium text-foreground mb-2">
                          No projects yet
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          Create your first team project
                        </p>
                        <Button
                          onClick={() => setShowCreateProjectDialog(true)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Project
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {localProjects.map((project) => (
                          <div
                            key={project.id}
                            className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors cursor-pointer"
                            onClick={() =>
                              navigate(
                                `/workspace?conversationId=${project.id}`
                              )
                            }
                          >
                            <h3 className="font-medium text-foreground mb-2">
                              {project.title}
                            </h3>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  Balance
                                </span>
                                <span className="font-medium text-foreground">
                                  ${project.balance.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  Messages
                                </span>
                                <span className="font-medium text-foreground">
                                  {project.messageCount}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Invite Member Dialog */}
              <Dialog
                open={showInviteDialog}
                onOpenChange={setShowInviteDialog}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join {team.name}
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
                          "Send Invitation"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Create Project Dialog - Full Featured */}
              <Dialog
                open={showCreateProjectDialog}
                onOpenChange={(open) => {
                  setShowCreateProjectDialog(open);
                  if (!open) {
                    // Reset form when closing
                    setProjectPrompt("");
                    setProjectModel(OPENROUTER_MODELS[0].id);
                    setUseSupabase(false);
                    setEnableDesignScheme(false);
                    setDesignScheme(undefined);
                    setUploadedFiles([]);
                    setImportedFiles([]);
                    setError(null);
                  }
                }}
              >
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Team Project</DialogTitle>
                    <DialogDescription>
                      Create a new project for {team.name} with all features
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateProject} className="space-y-4">
                    {/* Model Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Model</Label>
                      <Select
                        value={projectModel}
                        onValueChange={(value) => setProjectModel(value)}
                        disabled={loading}
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPENROUTER_MODELS.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex flex-col">
                                <span className="text-sm">{model.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {model.provider}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Project Prompt */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Project Description
                      </Label>
                      <Textarea
                        placeholder="Describe what you want to build..."
                        value={projectPrompt}
                        onChange={(e) => setProjectPrompt(e.target.value)}
                        required
                        disabled={loading}
                        rows={4}
                        className="bg-background border-border resize-none"
                      />
                    </div>

                    {/* File Preview */}
                    {uploadedFiles.length > 0 && (
                      <div>
                        <FilePreview
                          files={uploadedFiles}
                          onRemove={handleRemoveFile}
                          removeIcon="✕"
                          fileIcon="📄"
                          imageDataList={imageDataList}
                        />
                      </div>
                    )}

                    {/* Options Row */}
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Supabase Toggle */}
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-primary" />
                        <Label htmlFor="supabase-toggle" className="text-sm">
                          Enable Database
                        </Label>
                        <Switch
                          id="supabase-toggle"
                          checked={useSupabase}
                          onCheckedChange={handleSupabaseToggle}
                          disabled={
                            loading ||
                            (!hasSupabaseConnected && !isCheckingSupabase)
                          }
                          className="data-[state=checked]:bg-primary"
                        />
                        {!hasSupabaseConnected && !isCheckingSupabase && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleConnectSupabase}
                            className="h-6 text-xs"
                          >
                            Connect
                          </Button>
                        )}
                      </div>

                      {/* Design Scheme Toggle */}
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-primary" />
                        <Label
                          htmlFor="design-scheme-toggle"
                          className="text-sm"
                        >
                          Color Scheme
                        </Label>
                        <Switch
                          id="design-scheme-toggle"
                          checked={enableDesignScheme}
                          onCheckedChange={(checked) => {
                            setEnableDesignScheme(checked);
                            if (!checked) {
                              setDesignScheme(undefined);
                            }
                          }}
                          disabled={loading}
                          className="data-[state=checked]:bg-primary"
                        />
                        {enableDesignScheme && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const event = new CustomEvent(
                                "openColorSchemeDialog"
                              );
                              window.dispatchEvent(event);
                            }}
                            className="h-6 w-6 p-0"
                            title="Open palette"
                          >
                            <Palette className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2">
                      {/* File Upload */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleFileSelect}
                        disabled={loading}
                        className="bg-background border-border"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Upload
                      </Button>

                      {/* GitHub Import */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowGitHubModal(true)}
                        disabled={loading}
                        className="bg-background border-border"
                      >
                        <Github className="w-4 h-4 mr-1" />
                        Import GitHub
                      </Button>

                      <div className="flex-1" />

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        disabled={loading || !projectPrompt.trim()}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Create Project
                          </>
                        )}
                      </Button>
                    </div>

                    {error && (
                      <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                        {error}
                      </div>
                    )}
                  </form>
                </DialogContent>
              </Dialog>

              {/* GitHub Import Modal */}
              <GitHubImportModal
                isOpen={showGitHubModal}
                onClose={() => setShowGitHubModal(false)}
                selectedModel={projectModel}
              />

              {/* Color Scheme Dialog */}
              <ColorSchemeDialog
                designScheme={designScheme}
                setDesignScheme={setDesignScheme}
                showButton={false}
              />

              {/* Delete Team Dialog */}
              <Dialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="text-destructive">
                      Delete Team
                    </DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete{" "}
                      <span className="font-semibold text-foreground">
                        "{team.name}"
                      </span>
                      ? This action cannot be undone and will permanently
                      delete:
                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        <li>All team members</li>
                        <li>
                          All team projects ({localProjects.length} project
                          {localProjects.length !== 1 ? "s" : ""})
                        </li>
                        <li>All project data, messages, and files</li>
                        <li>Team wallet and all transactions</li>
                      </ul>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 justify-end mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteDialog(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        setError(null);
                        setLoading(true);

                        try {
                          const response = await fetch("/api/teams", {
                            method: "DELETE",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            credentials: "include",
                            body: JSON.stringify({ teamId: team.id }),
                          });

                          const data = await response.json();

                          if (!response.ok) {
                            throw new Error(
                              data.error || "Failed to delete team"
                            );
                          }

                          // Redirect to teams page after successful deletion
                          navigate("/teams");
                        } catch (err: any) {
                          setError(err.message || "Failed to delete team");
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Team
                        </>
                      )}
                    </Button>
                  </div>
                  {error && (
                    <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                      {error}
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* Recharge Wallet Dialog */}
              <Dialog
                open={showRechargeDialog}
                onOpenChange={setShowRechargeDialog}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add Funds to Team Wallet</DialogTitle>
                    <DialogDescription>
                      Add funds to {team.name}'s wallet
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Current Balance
                        </span>
                        <span className="text-lg font-bold text-foreground">
                          ${teamBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Amount (USD)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Enter amount"
                          value={walletAmount}
                          onChange={(e) => setWalletAmount(e.target.value)}
                          disabled={loading}
                          className="pl-10 bg-background border-border"
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                        {error}
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRechargeDialog(false);
                          setWalletAmount("");
                          setError(null);
                        }}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          const amount = parseFloat(walletAmount);
                          if (isNaN(amount) || amount <= 0) {
                            setError(
                              "Please enter a valid amount greater than $0"
                            );
                            return;
                          }

                          setError(null);
                          setLoading(true);

                          try {
                            // Get user's country code from browser location
                            const { getCountryCodeForPayment, handlePaymentResponse } = await import("~/utils/payment");
                            const countryCode = await getCountryCodeForPayment();

                            const response = await fetch(
                              "/api/teams/wallet/checkout",
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                credentials: "include",
                                body: JSON.stringify({
                                  teamId: team.id,
                                  amount,
                                  countryCode, // Include country code
                                }),
                              }
                            );

                            const data = await response.json();

                            if (!response.ok) {
                              throw new Error(
                                data.error ||
                                  "Failed to create checkout session"
                              );
                            }

                            // Handle different payment providers
                            await handlePaymentResponse(data, amount, () => {
                              setLoading(false); // Stop loading for Razorpay
                            });
                          } catch (err: any) {
                            setError(
                              err.message || "Failed to process payment"
                            );
                            setLoading(false);
                          }
                        }}
                        disabled={
                          loading ||
                          !walletAmount ||
                          parseFloat(walletAmount) <= 0
                        }
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Add Funds
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Team Dialog */}
              <Dialog
                open={showEditTeamDialog}
                onOpenChange={(open) => {
                  setShowEditTeamDialog(open);
                  if (!open) {
                    setEditTeamName(localTeam.name);
                    setEditTeamDescription(localTeam.description || "");
                    setError(null);
                  }
                }}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Team</DialogTitle>
                    <DialogDescription>
                      Update team name and description
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setError(null);
                      setLoading(true);

                      try {
                        const response = await fetch("/api/teams", {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          credentials: "include",
                          body: JSON.stringify({
                            teamId: team.id,
                            name: editTeamName,
                            description: editTeamDescription,
                          }),
                        });

                        const data = await response.json();

                        if (!response.ok) {
                          throw new Error(
                            data.error || "Failed to update team"
                          );
                        }

                        if (data.success && data.team) {
                          setLocalTeam({
                            ...localTeam,
                            name: data.team.name,
                            description: data.team.description,
                          });
                          setShowEditTeamDialog(false);
                        }
                      } catch (err: any) {
                        setError(err.message || "Failed to update team");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Team Name</label>
                      <Input
                        type="text"
                        value={editTeamName}
                        onChange={(e) => setEditTeamName(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <textarea
                        value={editTeamDescription}
                        onChange={(e) => setEditTeamDescription(e.target.value)}
                        disabled={loading}
                        rows={3}
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50 bg-background"
                      />
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
                        onClick={() => {
                          setShowEditTeamDialog(false);
                          setEditTeamName(localTeam.name);
                          setEditTeamDescription(localTeam.description || "");
                          setError(null);
                        }}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading || !editTeamName.trim()}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Updating...
                          </>
                        ) : (
                          "Update Team"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Edit Member Dialog */}
              <Dialog
                open={showEditMemberDialog}
                onOpenChange={(open) => {
                  setShowEditMemberDialog(open);
                  if (!open) {
                    setSelectedMember(null);
                    setError(null);
                  }
                }}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Team Member</DialogTitle>
                    <DialogDescription>
                      Update role and wallet limit for{" "}
                      {selectedMember?.name ||
                        selectedMember?.email ||
                        selectedMember?.userId}
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!selectedMember) return;

                      setError(null);
                      setLoading(true);

                      try {
                        const response = await fetch("/api/teams/members", {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          credentials: "include",
                          body: JSON.stringify({
                            teamId: team.id,
                            userId: selectedMember.userId,
                            role: editMemberRole,
                            walletLimit:
                              editMemberWalletLimit.trim() === ""
                                ? null
                                : parseFloat(editMemberWalletLimit),
                          }),
                        });

                        const data = await response.json();

                        if (!response.ok) {
                          throw new Error(
                            data.error || "Failed to update member"
                          );
                        }

                        if (data.success && data.member) {
                          setLocalMembers(
                            localMembers.map((m) =>
                              m.userId === selectedMember.userId
                                ? { ...m, ...data.member }
                                : m
                            )
                          );
                          setShowEditMemberDialog(false);
                          setSelectedMember(null);
                          toast({
                            title: "Success",
                            description: editMemberRole === "admin" 
                              ? "Team admin assigned successfully"
                              : "Member updated successfully",
                          });
                        }
                      } catch (err: any) {
                        const errorMessage = err.message || "Failed to update member";
                        setError(errorMessage);
                        toast({
                          title: "Error",
                          description: errorMessage,
                          variant: "destructive",
                        });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <select
                        value={editMemberRole}
                        onChange={(e) => setEditMemberRole(e.target.value)}
                        disabled={
                          loading || selectedMember?.userId === team.adminId
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50 bg-background"
                      >
                        <option value="developer">Developer</option>
                        <option value="admin">Admin</option>
                      </select>
                      {selectedMember?.userId === team.adminId && (
                        <p className="text-xs text-muted-foreground">
                          Team admin role cannot be changed
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Wallet Limit (USD)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="No limit (leave empty)"
                          value={editMemberWalletLimit}
                          onChange={(e) =>
                            setEditMemberWalletLimit(e.target.value)
                          }
                          disabled={loading}
                          className="pl-10 bg-background border-border"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Set a spending limit for this member. Leave empty for no
                        limit.
                      </p>
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
                        onClick={() => {
                          setShowEditMemberDialog(false);
                          setSelectedMember(null);
                          setError(null);
                        }}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Updating...
                          </>
                        ) : (
                          "Update Member"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Cancel Invitation Confirmation Dialog */}
              <Dialog
                open={showCancelInvitationDialog}
                onOpenChange={setShowCancelInvitationDialog}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="text-destructive">
                      Cancel Invitation
                    </DialogTitle>
                    <DialogDescription>
                      Are you sure you want to cancel the invitation for{" "}
                      <strong>{selectedInvitation?.email}</strong>? This action
                      cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 justify-end mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCancelInvitationDialog(false);
                        setSelectedInvitation(null);
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (!selectedInvitation) return;

                        setError(null);
                        setLoading(true);

                        try {
                          const response = await fetch(
                            "/api/teams/invitations",
                            {
                              method: "DELETE",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              credentials: "include",
                              body: JSON.stringify({
                                invitationId: selectedInvitation.id,
                              }),
                            }
                          );

                          if (response.ok) {
                            setLocalInvitations(
                              localInvitations.filter(
                                (inv: any) => inv.id !== selectedInvitation.id
                              )
                            );
                            setShowCancelInvitationDialog(false);
                            setSelectedInvitation(null);
                          } else {
                            const data = await response.json();
                            throw new Error(
                              data.error || "Failed to cancel invitation"
                            );
                          }
                        } catch (err: any) {
                          setError(
                            err.message || "Failed to cancel invitation"
                          );
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Canceling...
                        </>
                      ) : (
                        "Cancel Invitation"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Remove Member Confirmation Dialog */}
              <Dialog
                open={showRemoveMemberDialog}
                onOpenChange={setShowRemoveMemberDialog}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="text-destructive">
                      Remove Team Member
                    </DialogTitle>
                    <DialogDescription>
                      Are you sure you want to remove{" "}
                      <strong>
                        {selectedMember?.name ||
                          selectedMember?.email ||
                          selectedMember?.userId}
                      </strong>{" "}
                      from this team? This action cannot be undone and they will
                      lose access to all team projects.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 justify-end mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRemoveMemberDialog(false);
                        setSelectedMember(null);
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (!selectedMember) return;

                        setError(null);
                        setLoading(true);

                        try {
                          const response = await fetch("/api/teams/members", {
                            method: "DELETE",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            credentials: "include",
                            body: JSON.stringify({
                              teamId: team.id,
                              userId: selectedMember.userId,
                            }),
                          });

                          if (response.ok) {
                            setLocalMembers(
                              localMembers.filter(
                                (m) => m.userId !== selectedMember.userId
                              )
                            );
                            setShowRemoveMemberDialog(false);
                            setSelectedMember(null);
                          } else {
                            const data = await response.json();
                            throw new Error(
                              data.error || "Failed to remove member"
                            );
                          }
                        } catch (err: any) {
                          setError(err.message || "Failed to remove member");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Removing...
                        </>
                      ) : (
                        "Remove Member"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </main>
        </div>
      </div>
  );
}
