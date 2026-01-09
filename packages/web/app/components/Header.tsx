import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { Link, useNavigate } from "react-router";
import { authClient } from "../lib/authClient";
import {
  List,
  X,
  SignOut,
  ChartBar,
  Database,
  User as UserIcon,
  GitBranch,
  CurrencyDollar,
  Lightning,
  Users,
  ChatCircle,
  Shield,
  CaretDown,
  Bell,
  Gear,
  SquaresFour,
  CreditCard,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import crop from "~/assets/crop.png";
import { useSidebar } from "./ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { CaretLeft } from "phosphor-react";

interface HeaderProps {
  className?: string;
  showAuthButtons?: boolean;
  showSidebarToggle?: boolean;
  organizationName?: string;
  chatTitle?: string;
}

export default function Header({
  className,
  showAuthButtons = true,
  showSidebarToggle = false,
  organizationName,
  chatTitle,
}: HeaderProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);

  // Only use sidebar context if showSidebarToggle is true
  const sidebarContext = showSidebarToggle ? useSidebar() : null;

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Fetch user session
  useEffect(() => {
    let aborted = false;
    const fetchSession = async () => {
      try {
        let session: any = null;
        try {
          session = await (authClient as any).getSession?.();
        } catch {}

        if (!session) {
          const res = await fetch("/api/auth/session", {
            credentials: "include",
          });
          if (res.ok) session = await res.json();
        }

        let maybeUser = session?.user || session?.data?.user || null;

        if (maybeUser) {
          try {
            const userRes = await fetch("/api/auth/user", {
              credentials: "include",
            });
            if (userRes.ok) {
              const userJson: any = await userRes.json();
              const richer = userJson?.user || userJson?.data?.user || userJson;
              if (richer) maybeUser = { ...maybeUser, ...richer };
            }
          } catch {}
        }

        if (!aborted) setUser(maybeUser);
      } catch {}
    };
    fetchSession();
    return () => {
      aborted = true;
    };
  }, []);

  // Fetch balance
  useEffect(() => {
    let aborted = false;
    const fetchBalance = async () => {
      try {
        const res = await fetch("/api/profile/balance", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (!aborted) {
            setBalance(data.balance);
            setIsWhitelisted(data.isWhitelisted);
          }
        }
      } catch {}
    };
    if (user) fetchBalance();
    return () => {
      aborted = true;
    };
  }, [user]);

  const userInitials = (nameOrEmail?: string) => {
    if (!nameOrEmail) return "?";
    const parts = nameOrEmail
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 1) {
      const handle = nameOrEmail.includes("@")
        ? nameOrEmail.split("@")[0]
        : nameOrEmail;
      return handle.slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const Avatar = ({ size = 8 }: { size?: number }) => {
    const sizeClass = size === 10 ? "w-10 h-10" : "w-8 h-8";
    const displayName = user?.name || user?.email;
    const [broken, setBroken] = useState(false);
    const imageUrl =
      user?.image ||
      user?.picture ||
      user?.avatar ||
      user?.avatarUrl ||
      user?.photoURL;

    if (imageUrl && !broken) {
      return (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setBroken(true)}
          className={`${sizeClass} rounded-full object-cover border border-border/60`}
        />
      );
    }
    const initials = displayName ? userInitials(displayName) : "";
    return (
      <div
        className={`flex items-center justify-center ${sizeClass} rounded-full bg-primary/20 text-primary font-semibold`}
      >
        {initials || <UserIcon className="w-4 h-4 text-primary" />}
      </div>
    );
  };

  return (
    <header
      className={cn(
        "relative z-20 w-full py-3 px-4 overflow-visible",
        className
      )}
    >
      {/* Top glow effect */}
      <div
        className="pointer-events-none w-screen absolute top-0 inset-x-0 -translate-y-1/2 h-[80px] blur-[60px] opacity-30"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--gradient-mid) 30%, var(--gradient-end) 50%, var(--gradient-mid) 70%, transparent 100%)",
        }}
      />

      <div className="max-w-full mx-auto flex items-center justify-between relative z-10">
        {/* Left Section - Logo & Organization */}
        <div className="flex items-center gap-3">
          {/* Logo with Organization Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-muted/30 transition-colors group">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden">
                  <img
                    src={crop}
                    alt="Logo"
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="text-sm font-semibold text-foreground hidden sm:inline">
                  {organizationName || chatTitle || "NowgAI"}
                </span>
                <CaretDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-56 bg-surface-1 border-border/50"
            >
              <DropdownMenuItem
                onClick={() => navigate("/home")}
                className="gap-2 cursor-pointer"
              >
                <CaretLeft className="w-4 h-4" />
                Go to Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/recharge")}
                className="gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                Request Credit Refill
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/profile")}
                className="gap-2 cursor-pointer"
              >
                <Gear className="w-4 h-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sidebar Toggle */}
          {showSidebarToggle && sidebarContext && (
            <button
              type="button"
              onClick={() => sidebarContext.setOpen(!sidebarContext.open)}
              className="inline-flex items-center justify-center rounded-xl p-2.5 text-muted-foreground hover:bg-surface-2/50 hover:text-foreground transition-all border border-transparent hover:border-border/30"
            >
              <List className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </button>
          )}
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2">
          {showAuthButtons && (
            <>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg font-medium transition-colors hidden md:block"
                asChild
              >
                <Link to="/">Log in</Link>
              </Button>
              <Button
                className="bg-foreground text-background hover:bg-foreground/90 px-5 py-2 rounded-lg font-medium shadow-sm hidden md:block"
                asChild
              >
                <Link to="/signup">Sign up</Link>
              </Button>
            </>
          )}

          {/* User Avatar - when logged in */}
          {!showAuthButtons && user && (
            <div className="hidden md:flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center w-9 h-9 rounded-full hover:ring-2 hover:ring-border transition-all">
                    <Avatar size={8} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-72 bg-surface-1 border-border/50"
                  align="end"
                >
                  <DropdownMenuLabel>
                    <button
                      onClick={() => navigate("/profile")}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-3 cursor-pointer">
                        <Avatar size={10} />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {user?.name || "User"}
                          </div>
                          {user?.email && (
                            <div className="text-muted-foreground text-sm truncate">
                              {user.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Balance Display */}
                  {balance !== null && (
                    <>
                      <div className="px-2 py-3 mx-2 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-primary/20">
                              <CurrencyDollar className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Balance
                              </p>
                              <p className="text-lg font-bold text-primary">
                                ${balance.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          {!isWhitelisted && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate("/recharge")}
                              className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary"
                            >
                              Recharge
                            </Button>
                          )}
                        </div>
                        {isWhitelisted && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                            <Lightning className="w-3 h-3" />
                            <span>Unlimited Access</span>
                          </div>
                        )}
                      </div>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {user && (
                    <DropdownMenuItem
                      onClick={() => navigate("/admin")}
                      className="gap-2 cursor-pointer"
                    >
                      <Shield className="w-4 h-4" />
                      Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => navigate("/analytics")}
                    className="gap-2 cursor-pointer"
                  >
                    <ChartBar className="w-4 h-4" />
                    Analytics
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/deployments")}
                    className="gap-2 cursor-pointer"
                  >
                    <GitBranch className="w-4 h-4" />
                    Deployments
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/supabase-projects")}
                    className="gap-2 cursor-pointer"
                  >
                    <Database className="w-4 h-4" />
                    Supabase Projects
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/teams")}
                    className="gap-2 cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    Teams
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/manage-org/convo")}
                    className="gap-2 cursor-pointer"
                  >
                    <ChatCircle className="w-4 h-4" />
                    Manage Organization
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    variant="destructive"
                    className="gap-2 cursor-pointer"
                  >
                    <SignOut className="w-4 h-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notification Bell */}
              <button className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
                <Bell className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="text-foreground md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <List className="h-6 w-6" />
            )}
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-t border-border shadow-lg">
          <div className="px-6 py-4">
            <nav className="flex flex-col gap-4">
              {showAuthButtons ? (
                <>
                  <Link
                    to="/"
                    className="text-muted-foreground hover:text-foreground text-lg py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="w-full mt-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Button className="bg-white text-black hover:bg-white/90 rounded-full px-6 py-2 font-medium shadow-sm w-full">
                      Sign up
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/profile");
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/20 w-full text-left"
                  >
                    <Avatar size={10} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {user?.name || "User"}
                      </div>
                      {user?.email && (
                        <div className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </div>
                      )}
                    </div>
                  </button>

                  {user && (
                    <Button
                      onClick={() => {
                        navigate("/admin");
                        setIsMobileMenuOpen(false);
                      }}
                      variant="outline"
                      className="w-full justify-start gap-2"
                    >
                      <Shield className="w-4 h-4" /> Admin Panel
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      navigate("/analytics");
                      setIsMobileMenuOpen(false);
                    }}
                    variant="outline"
                    className="w-full justify-start gap-2"
                  >
                    <ChartBar className="w-4 h-4" /> Analytics
                  </Button>
                  <Button
                    onClick={() => {
                      navigate("/deployments");
                      setIsMobileMenuOpen(false);
                    }}
                    variant="outline"
                    className="w-full justify-start gap-2"
                  >
                    <GitBranch className="w-4 h-4" /> Deployments
                  </Button>
                  <Button
                    onClick={() => {
                      navigate("/manage-org/convo");
                      setIsMobileMenuOpen(false);
                    }}
                    variant="outline"
                    className="w-full justify-start gap-2"
                  >
                    <ChatCircle className="w-4 h-4" /> Manage Organization
                  </Button>
                  <Button
                    onClick={() => {
                      handleSignOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="bg-white text-black hover:bg-white/90 rounded-md h-10 px-5 font-medium shadow-sm w-full flex gap-2"
                  >
                    <SignOut className="w-4 h-4" /> Logout
                  </Button>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
