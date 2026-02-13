import { ArrowLeft, DollarSign, User as UserIcon, Zap, Pencil, Check, X, Loader2, Link2, Link2Off } from "lucide-react";
import { Link, redirect, useRevalidator } from "react-router";
import { useState, useEffect } from "react";
import GradientGlow from "../components/GradientGlow";
import { ProjectSidebar } from "../components/ProjectSidebar";
import { ContributionGraph } from "../components/ContributionGraph";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { auth } from "../lib/auth";
import { authClient } from "../lib/authClient";
import { connectToDatabase } from "../lib/mongo";
import { isWhitelistedEmail } from "../lib/stripe";
import { getMessageModel } from "../models/messageModel";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { useGitHubAuth } from "../hooks/useGitHubAuth";
import type { Route } from "./+types/profile";

export async function loader({ request }: Route.LoaderArgs) {
  const { Profile: ProfileModel } = await import("@nowgai/shared/models");
  
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  const user = session.user;

  // Load profile/balance
  await connectToDatabase();
  let profile = await ProfileModel.findOne({ userId: user.id });
  if (!profile) {
    profile = new ProfileModel({ userId: user.id });
    await profile.save();
  }

  const whitelisted = isWhitelistedEmail(user.email);
  if (profile.isWhitelisted !== whitelisted) {
    profile.isWhitelisted = whitelisted;
    await profile.save();
  }

  // Fetch user message activity data (all years)
  // NOTE: This runs server-side in the loader for performance - we don't want to fetch
  // all messages client-side. Loaders run on the server before rendering.
  // We fetch all years so the year filter can work client-side without additional requests.
  const Messages = getMessageModel();

  // Aggregate user messages by date (counts user activity/contributions)
  // This runs server-side in the loader for performance - avoids fetching all messages client-side
  let editData: Array<{ date: string; count: number }> = [];
  
  try {
    editData = await Messages.aggregate([
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "conversation",
        },
      },
      {
        $unwind: {
          path: "$conversation",
          preserveNullAndEmptyArrays: false, // Only include messages with valid conversations
        },
      },
      {
        $match: {
          "conversation.userId": user.id,
          role: "user", // Count user messages, not assistant responses
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$timestamp",
            },
          },
          count: { $sum: 1 }, // Count messages per day
        },
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          _id: 0,
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);
  } catch (error) {
    console.error("[Profile] Error fetching contribution data:", error);
    // Return empty array on error - component will show 0 contributions
    editData = [];
  }

  return {
    user: {
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      image:
        (user as any).image ||
        (user as any).picture ||
        (user as any).avatar ||
        (user as any).avatarUrl ||
        null,
    },
    balance: profile.balance || 0,
    isWhitelisted: whitelisted,
    edits: editData,
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Profile - Nowgai" },
    { name: "description", content: "View your profile and balance" },
  ];
}

// Provider icons
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const SupabaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 109 113" fill="none">
    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2"/>
    <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
    <defs>
      <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
        <stop stopColor="#249361"/>
        <stop offset="1" stopColor="#3ECF8E"/>
      </linearGradient>
      <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
        <stop/>
        <stop offset="1" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user, balance, isWhitelisted, edits } = loaderData as {
    user: { id: string; name?: string; email?: string; image?: string | null };
    balance: number;
    isWhitelisted: boolean;
    edits: Array<{ date: string; count: number }>;
  };

  const revalidator = useRevalidator();

  // Connected accounts state
  const [linkedAccounts, setLinkedAccounts] = useState<Array<{
    id: string;
    providerId: string;
    accountId: string;
  }>>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  // Supabase integration (for database, not auth)
  const {
    hasSupabaseConnected,
    isCheckingToken: isCheckingSupabase,
    supabaseUser,
    handleConnectSupabase,
    handleDisconnectSupabase,
  } = useSupabaseAuth();

  // GitHub integration (for repos, not auth)
  const {
    hasGitHubConnected,
    isCheckingToken: isCheckingGitHub,
    handleConnectGitHub,
  } = useGitHubAuth();

  // Fetch linked auth accounts
  useEffect(() => {
    const fetchLinkedAccounts = async () => {
      try {
        const response = await fetch("/api/auth/list-accounts", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setLinkedAccounts(data || []);
        }
      } catch (err) {
        console.error("Failed to fetch linked accounts:", err);
      } finally {
        setIsLoadingAccounts(false);
      }
    };
    fetchLinkedAccounts();
  }, []);

  // Handle linking a social provider
  const handleLinkProvider = async (provider: "google" | "github") => {
    setLinkingProvider(provider);
    try {
      await (authClient as any).linkSocial({
        provider,
        callbackURL: window.location.href,
      });
    } catch (err) {
      console.error(`Failed to link ${provider}:`, err);
      setLinkingProvider(null);
    }
  };

  // Check if provider is linked
  const isProviderLinked = (providerId: string) => {
    return linkedAccounts.some((acc) => acc.providerId === providerId);
  };

  // Editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const displayName = user?.name || user?.email || "User";

  const initials = (() => {
    const source = displayName || "";
    const parts = source
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    const handle = source.includes("@") ? source.split("@")[0] : source;
    return handle.slice(0, 2).toUpperCase();
  })();

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      setNameError("Name cannot be empty");
      return;
    }
    
    setNameLoading(true);
    setNameError(null);
    
    try {
      const result = await authClient.updateUser({
        name: editedName.trim(),
      });
      
      if (result.error) {
        setNameError(result.error.message || "Failed to update name");
        return;
      }
      
      setIsEditingName(false);
      revalidator.revalidate();
    } catch (err: any) {
      setNameError(err.message || "Failed to update name");
    } finally {
      setNameLoading(false);
    }
  };

  const handleCancelName = () => {
    setIsEditingName(false);
    setEditedName(user?.name || "");
    setNameError(null);
  };

  const Avatar = ({ size = "lg" }: { size?: "sm" | "lg" }) => {
    const imageUrl = user?.image || undefined;
    const sizeClass = size === "lg" ? "w-16 h-16" : "w-10 h-10";
    const textSize = size === "lg" ? "text-xl" : "text-sm";
    
    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          className={`${sizeClass} rounded-full object-cover border border-white/10`}
        />
      );
    }
    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white ${textSize} font-semibold`}>
        {initials || <UserIcon className="w-6 h-6" />}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-canvas text-white flex overflow-hidden">
      {/* Sidebar */}
      <ProjectSidebar user={user ? { ...user, image: user.image ?? undefined } : undefined} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Gradient Background */}
        <GradientGlow />

        <main className="relative z-20 flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
            {/* Back Button */}
            <Link
              to="/home"
              className="inline-flex items-center gap-2 text-sm text-tertiary hover:text-primary transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>

            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--gradient-mid)]/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                    <div className="relative">
                      <Avatar size="lg" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                      {displayName}
                    </h1>
                    {user?.email && (
                      <p className="text-tertiary mt-1">{user.email}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Account overview */}
              <div className="lg:col-span-2">
                <Card className="bg-surface-1 border border-subtle rounded-[12px]">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-primary">
                      Profile Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Name Field */}
                      <div>
                        <label className="text-sm text-tertiary">Name</label>
                        {isEditingName ? (
                          <div className="mt-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="flex-1 bg-surface-2/50 border-subtle text-secondary"
                                placeholder="Enter your name"
                                disabled={nameLoading}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveName();
                                  if (e.key === "Escape") handleCancelName();
                                }}
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleSaveName}
                                disabled={nameLoading}
                                className="h-9 w-9 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                              >
                                {nameLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleCancelName}
                                disabled={nameLoading}
                                className="h-9 w-9 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            {nameError && (
                              <p className="text-xs text-red-500">{nameError}</p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 px-3 py-2 rounded-lg border border-subtle bg-surface-2/50 text-secondary">
                              {user?.name || "—"}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditedName(user?.name || "");
                                setIsEditingName(true);
                              }}
                              className="h-9 w-9 text-tertiary hover:text-primary"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Email Field */}
                      <div>
                        <label className="text-sm text-tertiary">Email</label>
                        <div className="mt-1">
                          <div className="px-3 py-2 rounded-lg border border-subtle bg-surface-2/50 text-secondary">
                            {user?.email || "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-subtle">
                      <p className="text-xs text-tertiary mb-3 font-medium">Legal & Policies</p>
                      <div className="flex flex-col gap-2">
                        <Link
                          to="/privacy-policy"
                          className="text-sm text-tertiary hover:text-primary transition-colors underline underline-offset-2"
                        >
                          Privacy Policy
                        </Link>
                        <Link
                          to="/EULA"
                          className="text-sm text-tertiary hover:text-primary transition-colors underline underline-offset-2"
                        >
                          End User License Agreement (EULA)
                        </Link>
                        <Link
                          to="/support"
                          className="text-sm text-tertiary hover:text-primary transition-colors underline underline-offset-2"
                        >
                          Support & Contact
                        </Link>
                      </div>
                      <div className="mt-4 pt-3 border-t border-subtle">
                        <p className="text-xs text-tertiary mb-2">Compliance</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          We comply with India's DPDP Act, IT Act, and applicable global standards including GDPR for EU users. For privacy queries or to exercise your rights, contact{" "}
                          <a 
                            href="mailto:support@nowg.ai" 
                            className="text-tertiary hover:text-primary underline underline-offset-2"
                          >
                            support@nowg.ai
                          </a>
                          .
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Balance */}
              <div>
                <Card className="bg-surface-1 border border-subtle rounded-[12px]">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-primary">
                      Account Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="px-4 py-4 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-[var(--accent-primary)]/20">
                            <DollarSign className="w-5 h-5 text-accent-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-tertiary">
                              Available Balance
                            </p>
                            <p className="text-2xl font-bold text-accent-primary">
                              ${Number(balance || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {!isWhitelisted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => (window.location.href = "/recharge")}
                            className="bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 border-[var(--accent-primary)]/30 text-accent-primary"
                          >
                            Recharge
                          </Button>
                        )}
                      </div>
                      {isWhitelisted && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-accent-primary">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Unlimited Access</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Connected Services */}
            <div className="mt-6">
              <Card className="bg-surface-1 border border-subtle rounded-[12px]">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-primary">
                    Connected Services
                  </CardTitle>
                  <p className="text-sm text-tertiary mt-1">
                    Services linked to your account for authentication and integrations
                  </p>
                </CardHeader>
                <CardContent className="space-y-1">
                  {/* Google - Sign in provider */}
                  <div className="flex items-center justify-between py-3 border-b border-subtle">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                        <GoogleIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">Google</p>
                        <p className="text-xs text-tertiary">Sign in with Google</p>
                      </div>
                    </div>
                    {isLoadingAccounts ? (
                      <div className="px-3 py-1.5">
                        <Loader2 className="w-4 h-4 animate-spin text-tertiary" />
                      </div>
                    ) : isProviderLinked("google") ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                        <Link2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-500">Connected</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLinkProvider("google")}
                        disabled={linkingProvider === "google"}
                        className="bg-surface-2/50 hover:bg-surface-2 border-subtle text-secondary hover:text-primary"
                      >
                        {linkingProvider === "google" ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Link2 className="w-4 h-4 mr-2" />
                        )}
                        Connect
                      </Button>
                    )}
                  </div>

                  {/* GitHub - Sign in provider + Repo integration */}
                  <div className="flex items-center justify-between py-3 border-b border-subtle">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                        <GitHubIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">GitHub</p>
                        <p className="text-xs text-tertiary">
                          {isProviderLinked("github") || hasGitHubConnected 
                            ? "Sign in & repository access" 
                            : "Sign in with GitHub"}
                        </p>
                      </div>
                    </div>
                    {isLoadingAccounts || isCheckingGitHub ? (
                      <div className="px-3 py-1.5">
                        <Loader2 className="w-4 h-4 animate-spin text-tertiary" />
                      </div>
                    ) : isProviderLinked("github") || hasGitHubConnected ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                        <Link2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-500">Connected</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLinkProvider("github")}
                        disabled={linkingProvider === "github"}
                        className="bg-surface-2/50 hover:bg-surface-2 border-subtle text-secondary hover:text-primary"
                      >
                        {linkingProvider === "github" ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Link2 className="w-4 h-4 mr-2" />
                        )}
                        Connect
                      </Button>
                    )}
                  </div>

                  {/* Supabase - Database integration */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                        <SupabaseIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">Supabase</p>
                        <p className="text-xs text-tertiary">
                          {hasSupabaseConnected && supabaseUser?.email 
                            ? supabaseUser.email 
                            : "Database & backend services"}
                        </p>
                      </div>
                    </div>
                    {isCheckingSupabase ? (
                      <div className="px-3 py-1.5">
                        <Loader2 className="w-4 h-4 animate-spin text-tertiary" />
                      </div>
                    ) : hasSupabaseConnected ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDisconnectSupabase}
                        className="bg-surface-2/50 hover:bg-red-500/10 border-subtle hover:border-red-500/30 text-secondary hover:text-red-500"
                      >
                        <Link2Off className="w-4 h-4 mr-2" />
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleConnectSupabase}
                        className="bg-surface-2/50 hover:bg-surface-2 border-subtle text-secondary hover:text-primary"
                      >
                        <Link2 className="w-4 h-4 mr-2" />
                        Connect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contribution Graph */}
            <div className="mt-6">
              <ContributionGraph edits={edits || []} projectName="Nowgai" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


