import { ArrowLeft, DollarSign, User as UserIcon, Zap, Pencil, Check, X, Loader2 } from "lucide-react";
import { Link, redirect, useRevalidator } from "react-router";
import { useState } from "react";
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

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user, balance, isWhitelisted, edits } = loaderData as {
    user: { id: string; name?: string; email?: string; image?: string | null };
    balance: number;
    isWhitelisted: boolean;
    edits: Array<{ date: string; count: number }>;
  };

  const revalidator = useRevalidator();

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


