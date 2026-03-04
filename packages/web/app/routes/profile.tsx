import {
  ArrowLeft,
  DollarSign,
  Link2,
  Link2Off,
  Loader2,
  Menu,
  Zap,
} from "lucide-react";
import { Link, redirect, useRevalidator } from "react-router";
import { useState, useEffect } from "react";
import GradientGlow from "../components/GradientGlow";
import { ProjectSidebar } from "../components/ProjectSidebar";
import { ContributionGraph } from "../components/ContributionGraph";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { auth } from "../lib/auth";
import { authClient } from "../lib/authClient";
import { connectToDatabase } from "../lib/mongo";
import { isWhitelistedEmail } from "../lib/stripe";
import { getMessageModel } from "../models/messageModel";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { useGitHubAuth } from "../hooks/useGitHubAuth";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { ProfileBasicInfo } from "../components/profile/ProfileBasicInfo";
import { ProfileSocialMediaForm } from "../components/profile/ProfileSocialMediaForm";
import { ProfileLegalSection } from "../components/profile/ProfileLegalSection";
import { ChangePasswordForm } from "../components/profile/ChangePasswordForm";
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

  // Log loaded profile data for debugging
  console.log("[Profile Loader] Loading profile for user:", user.id);
  console.log("[Profile Loader] Profile social data:", {
    linkedin: profile.linkedin,
    instagram: profile.instagram,
    x: profile.x,
    discord: profile.discord,
    portfolio: profile.portfolio,
    bio: profile.bio,
    customUrls: profile.customUrls,
  });

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
    profile: {
      linkedin: profile.linkedin || "",
      instagram: profile.instagram || "",
      x: profile.x || "",
      discord: profile.discord || "",
      portfolio: profile.portfolio || "",
      bio: profile.bio || "",
      customUrls: profile.customUrls || [],
    },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { Profile: ProfileModel } = await import("@nowgai/shared/models");

  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only handle POST requests
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = session.user;

  try {
    await connectToDatabase();

    // Parse FormData (React Router sends FormData by default)
    const fd = await request.formData();
    const linkedin = fd.get("linkedin")?.toString() || "";
    const instagram = fd.get("instagram")?.toString() || "";
    const x = fd.get("x")?.toString() || "";
    const discord = fd.get("discord")?.toString() || "";
    const portfolio = fd.get("portfolio")?.toString() || "";
    const bio = fd.get("bio")?.toString() || "";
    const customUrls = fd
      .getAll("customUrls")
      .map((url) => url.toString())
      .filter((url) => url.trim());

    // Find or create profile
    let profile = await ProfileModel.findOne({ userId: user.id });
    if (!profile) {
      profile = new ProfileModel({ userId: user.id });
    }

    // Update fields
    profile.linkedin = linkedin || "";
    profile.instagram = instagram || "";
    profile.x = x || "";
    profile.discord = discord || "";
    profile.portfolio = portfolio || "";
    profile.bio = bio || "";
    profile.customUrls = Array.isArray(customUrls)
      ? customUrls.filter((url: string) => url.trim())
      : [];
    profile.lastUpdated = new Date();

    await profile.save();

    // Return redirect to revalidate the page
    return redirect("/profile");
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to update profile" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
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
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const SupabaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 109 113" fill="none">
    <path
      d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
      fill="url(#paint0_linear)"
    />
    <path
      d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
      fill="url(#paint1_linear)"
      fillOpacity="0.2"
    />
    <path
      d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z"
      fill="#3ECF8E"
    />
    <defs>
      <linearGradient
        id="paint0_linear"
        x1="53.9738"
        y1="54.974"
        x2="94.1635"
        y2="71.8295"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#249361" />
        <stop offset="1" stopColor="#3ECF8E" />
      </linearGradient>
      <linearGradient
        id="paint1_linear"
        x1="36.1558"
        y1="30.578"
        x2="54.4844"
        y2="65.0806"
        gradientUnits="userSpaceOnUse"
      >
        <stop />
        <stop offset="1" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user, balance, isWhitelisted, edits, profile } = loaderData as {
    user: { id: string; name?: string; email?: string; image?: string | null };
    balance: number;
    isWhitelisted: boolean;
    edits: Array<{ date: string; count: number }>;
    profile: {
      linkedin: string;
      instagram: string;
      x: string;
      discord: string;
      portfolio: string;
      bio: string;
      customUrls: string[];
    };
  };

  const revalidator = useRevalidator();

  // Connected accounts state
  const [linkedAccounts, setLinkedAccounts] = useState<
    Array<{
      id: string;
      providerId: string;
      accountId: string;
    }>
  >([]);
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

  const displayName = user?.name || user?.email || "User";

  // Handle name update
  const handleNameUpdate = async (name: string) => {
    const result = await authClient.updateUser({ name });
    if (result.error) {
      throw new Error(result.error.message || "Failed to update name");
    }
    revalidator.revalidate();
  };

  return (
    <div className="h-screen w-screen max-w-full bg-canvas text-white flex overflow-hidden">
      {/* Sidebar */}
      <ProjectSidebar
        user={user ? { ...user, image: user.image ?? undefined } : undefined}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Gradient Background */}
        <GradientGlow />

        <main className="relative z-20 flex flex-col min-h-0 flex-1">
          {/* Mobile: top bar with menu so sidebar can be opened */}
          <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("openProjectSidebar"))
              }
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/5 text-tertiary hover:text-primary transition-colors touch-manipulation"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              to="/home"
              className="inline-flex items-center gap-2 text-sm text-tertiary hover:text-primary transition-colors py-2 touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Back to Home</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto overflow-x-hidden px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* Back Button - desktop only (on mobile we have it in the top bar) */}
            <Link
              to="/home"
              className="hidden md:inline-flex items-center gap-2 text-sm text-tertiary hover:text-primary transition-colors mb-4 sm:mb-6 touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Back to Home</span>
            </Link>

            {/* Page Header - responsive stack on small screens */}
            <div className="mb-6 sm:mb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="relative group flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--gradient-mid)]/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
                  <div className="relative">
                    <ProfileAvatar
                      imageUrl={user?.image}
                      displayName={displayName}
                      size="lg"
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary truncate">
                    {displayName}
                  </h1>
                  {user?.email && (
                    <p className="text-tertiary mt-0.5 sm:mt-1 text-sm sm:text-base truncate">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Main grid - single column on mobile, 3 cols on lg */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Account overview */}
              <div className="lg:col-span-2 min-w-0">
                <Card className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px] overflow-hidden">
                  <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                    <CardTitle className="text-lg sm:text-xl font-semibold text-primary">
                      Profile Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
                    <ProfileBasicInfo
                      name={user?.name || ""}
                      email={user?.email || ""}
                      onNameUpdate={handleNameUpdate}
                    />

                    <ProfileSocialMediaForm initialData={profile} />

                    <div className="pt-4 border-t border-subtle">
                      <ChangePasswordForm />
                    </div>

                    <ProfileLegalSection />
                  </CardContent>
                </Card>
              </div>

              {/* Balance - full width on mobile, stacks nicely */}
              <div className="min-w-0 order-first lg:order-none">
                <Card className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px] overflow-hidden">
                  <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                    <CardTitle className="text-lg sm:text-xl font-semibold text-primary">
                      Account Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                    <div className="p-3 sm:p-4 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-[var(--accent-primary)]/20 flex-shrink-0">
                            <DollarSign className="w-5 h-5 text-accent-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-tertiary">
                              Available Balance
                            </p>
                            <p className="text-xl sm:text-2xl font-bold text-accent-primary tabular-nums">
                              ${Number(balance || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {!isWhitelisted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => (window.location.href = "/recharge")}
                            className="bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 border-[var(--accent-primary)]/30 text-accent-primary flex-shrink-0 touch-manipulation"
                          >
                            Recharge
                          </Button>
                        )}
                      </div>
                      {isWhitelisted && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-accent-primary">
                          <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Unlimited Access</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Connected Services - responsive rows */}
            <div className="mt-4 sm:mt-6">
              <Card className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px] overflow-hidden">
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl font-semibold text-primary">
                    Connected Services
                  </CardTitle>
                  <p className="text-sm text-tertiary mt-1">
                    Services linked to your account for authentication and
                    integrations
                  </p>
                </CardHeader>
                <CardContent className="space-y-0 px-3 sm:px-6 pb-4 sm:pb-6">
                  {/* Google - Sign in provider */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-subtle">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
                        <GoogleIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary">
                          Google
                        </p>
                        <p className="text-xs text-tertiary truncate">
                          Sign in with Google
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 sm:pl-2">
                      {isLoadingAccounts ? (
                        <div className="px-3 py-1.5">
                          <Loader2 className="w-4 h-4 animate-spin text-tertiary" />
                        </div>
                      ) : isProviderLinked("google") ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 w-fit">
                          <Link2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-green-500">
                            Connected
                          </span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLinkProvider("google")}
                          disabled={linkingProvider === "google"}
                          className="bg-surface-2/50 hover:bg-surface-2 border-subtle text-secondary hover:text-primary touch-manipulation"
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
                  </div>

                  {/* GitHub - Sign in provider + Repo integration */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-subtle">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
                        <GitHubIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary">
                          GitHub
                        </p>
                        <p className="text-xs text-tertiary truncate">
                          {isProviderLinked("github") || hasGitHubConnected
                            ? "Sign in & repository access"
                            : "Sign in with GitHub"}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 sm:pl-2">
                      {isLoadingAccounts || isCheckingGitHub ? (
                        <div className="px-3 py-1.5">
                          <Loader2 className="w-4 h-4 animate-spin text-tertiary" />
                        </div>
                      ) : isProviderLinked("github") || hasGitHubConnected ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 w-fit">
                          <Link2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-green-500">
                            Connected
                          </span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLinkProvider("github")}
                          disabled={linkingProvider === "github"}
                          className="bg-surface-2/50 hover:bg-surface-2 border-subtle text-secondary hover:text-primary touch-manipulation"
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
                  </div>

                  {/* Supabase - Database integration */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
                        <SupabaseIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary">
                          Supabase
                        </p>
                        <p className="text-xs text-tertiary truncate">
                          {hasSupabaseConnected && supabaseUser?.email
                            ? supabaseUser.email
                            : "Database & backend services"}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 sm:pl-2">
                      {isCheckingSupabase ? (
                        <div className="px-3 py-1.5">
                          <Loader2 className="w-4 h-4 animate-spin text-tertiary" />
                        </div>
                      ) : hasSupabaseConnected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDisconnectSupabase}
                          className="bg-surface-2/50 hover:bg-red-500/10 border-subtle hover:border-red-500/30 text-secondary hover:text-red-500 touch-manipulation"
                        >
                          <Link2Off className="w-4 h-4 mr-2" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleConnectSupabase}
                          className="bg-surface-2/50 hover:bg-surface-2 border-subtle text-secondary hover:text-primary touch-manipulation"
                        >
                          <Link2 className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contribution Graph */}
            <div className="mt-4 sm:mt-6 min-w-0">
              <ContributionGraph edits={edits || []} projectName="Nowgai" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
