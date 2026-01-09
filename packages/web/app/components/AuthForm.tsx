import { useState, useMemo } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Github,
  Chrome,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { signIn, signUp, authClient } from "../lib/authClient";

type AuthInitialTab = "signin" | "signup";

interface AuthFormProps {
  initialTab?: AuthInitialTab;
  inviteToken?: string;
}

export default function AuthForm({ initialTab = "signin", inviteToken }: AuthFormProps) {
  // shared
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // sign in state
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // sign up state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] =
    useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const passwordsMatch =
    signupPassword.length > 0 && signupPassword === signupConfirm;
  const showMismatch =
    signupConfirm.length > 0 && signupPassword !== signupConfirm;
  const passwordValid = signupPassword.length >= 8;
  const showPasswordValidation = signupPassword.length > 0;

  const handleSocial = async (provider: "google" | "github") => {
    setIsLoading(true);
    setError("");
    try {
      // Store inviteToken in localStorage before social signup
      if (inviteToken) {
        localStorage.setItem("pendingInviteToken", inviteToken);
      }
      await signIn.social({ provider });
    } catch (err) {
      // Clear inviteToken if signup fails
      if (inviteToken) {
        localStorage.removeItem("pendingInviteToken");
      }
      setError(
        err instanceof Error
          ? err.message
          : `Failed with ${provider}. Please try again.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signinEmail || !signinPassword) return;

    setIsLoading(true);
    setError("");
    setShowResendVerification(false);

    try {
      const result = await signIn.email(
        { email: signinEmail, password: signinPassword },
        {
          onError: (ctx) => {
            if (ctx.error.status === 403) {
              setError("Please verify your email before signing in.");
              setShowResendVerification(true);
            } else {
              setError(ctx.error.message || "Sign in failed");
            }
          },
        }
      );

      if (result?.error)
        throw new Error(result.error.message || "Sign in failed");
      
      // If there's an inviteToken, redirect to accept invitation
      if (inviteToken) {
        window.location.href = `/organizations/user/accept?token=${inviteToken}`;
      } else {
        window.location.href = "/home";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!signinEmail) {
      setError("Please enter your email address first.");
      return;
    }
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await authClient.sendVerificationEmail({
        email: signinEmail,
        callbackURL: "/home",
      });
      setResendSuccess(true);
      setError("");
    } catch {
      setError("Failed to resend verification email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !passwordsMatch ||
      !signupName ||
      !signupEmail ||
      !signupPassword ||
      !passwordValid
    )
      return;
    setIsLoading(true);
    setError("");
    try {
      const result = await signUp.email({
        email: signupEmail,
        password: signupPassword,
        name: signupName,
      });
      if (result.error)
        throw new Error(result.error.message || "Signup failed");
      setSignupSuccess(true);
      setError("");
      
      // Check for pending invitations after signup
      // Note: This will work after email verification when user is authenticated
      // We'll also check in the home route after verification
      try {
        // Try to check for pending invitations (might fail if not verified yet, that's ok)
        await fetch("/api/organizations/user/check-pending-invitations", {
          method: "POST",
          credentials: "include",
        }).catch(() => {
          // Ignore errors - user might not be verified yet
        });
      } catch (err) {
        // Ignore - will check again after verification
      }
      
      // If there's an inviteToken, redirect to accept invitation after a short delay
      if (inviteToken) {
        setTimeout(() => {
          window.location.href = `/organizations/user/accept?token=${inviteToken}`;
        }, 2000);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create account. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Social */}
      <div className="space-y-3 mb-6">
        <Button
          variant="outline"
          className="w-full h-12 bg-muted/50 border border-border/60 hover:bg-muted rounded-xl font-medium"
          onClick={() => handleSocial("google")}
          disabled={isLoading}
        >
          <Chrome className="w-5 h-5 mr-3" /> Continue with Google
        </Button>
        <Button
          variant="outline"
          className="w-full h-12 bg-muted/50 border border-border/60 hover:bg-muted rounded-xl font-medium"
          onClick={() => handleSocial("github")}
          disabled={isLoading}
        >
          <Github className="w-5 h-5 mr-3" /> Continue with GitHub
        </Button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <Separator className="flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent h-px" />
        <span className="text-muted-foreground text-sm font-medium">or</span>
        <Separator className="flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent h-px" />
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full bg-muted/20 border border-border/60 rounded-full p-1">
          <TabsTrigger
            value="signin"
            className="rounded-full py-2 text-sm data-[state=active]:bg-[var(--accent-primary)] data-[state=active]:text-white data-[state=active]:shadow-[0_0_0_2px_rgba(123,76,255,0.35),0_10px_30px_-12px_rgba(123,76,255,0.55)]"
          >
            Sign in
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="rounded-full py-2 text-sm data-[state=active]:bg-[var(--accent-primary)] data-[state=active]:text-white data-[state=active]:shadow-[0_0_0_2px_rgba(123,76,255,0.35),0_10px_30px_-12px_rgba(123,76,255,0.55)]"
          >
            Create account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="mt-6">
          <form className="space-y-5" onSubmit={handleEmailSignIn}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground block">
                Email address
              </label>
              <Input
                type="email"
                placeholder="you@studio.dev"
                className="h-12 bg-muted/30 border border-border/60 rounded-xl"
                value={signinEmail}
                onChange={(e) => setSigninEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showSigninPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="h-12 bg-muted/30 border border-border/60 rounded-xl pr-12"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                  onClick={() => setShowSigninPassword(!showSigninPassword)}
                >
                  {showSigninPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 backdrop-blur-sm border border-destructive/20 rounded-xl">
                <p
                  className="text-destructive text-sm font-medium"
                  role="alert"
                >
                  {error}
                </p>
                {showResendVerification && (
                  <div className="mt-4 pt-4 border-t border-destructive/20">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="w-full bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20 rounded-lg"
                    >
                      {resendLoading
                        ? "Sending..."
                        : "Resend Verification Email"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {resendSuccess && (
              <div className="p-4 bg-[var(--accent-primary)]/10 backdrop-blur-sm border border-[var(--accent-primary)]/20 rounded-xl">
                <p className="text-accent-primary text-sm font-medium">
                  Verification email sent! Check your inbox.
                </p>
              </div>
            )}

            <Button
              className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-semibold rounded-xl"
              disabled={!signinEmail || !signinPassword || isLoading}
              type="submit"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                "Sign in"
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Protected by industry‑standard encryption</span>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="signup" className="mt-6">
          {signupSuccess ? (
            <div className="text-center space-y-6">
              <div className="p-6 bg-[var(--accent-primary)]/10 backdrop-blur-sm border border-[var(--accent-primary)]/20 rounded-2xl">
                <p className="text-accent-primary text-sm leading-relaxed">
                  We sent a verification email to{" "}
                  <span className="font-semibold">{signupEmail}</span>.
                </p>
              </div>
              <Button
                className="w-full h-12 rounded-xl"
                onClick={() => window.location.assign("/signin")}
              >
                Go to Sign In
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleEmailSignUp}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name</label>
                <Input
                  type="text"
                  placeholder="Your name"
                  className="h-12 bg-muted/30 border border-border/60 rounded-xl"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email address</label>
                <Input
                  type="email"
                  placeholder="you@studio.dev"
                  className="h-12 bg-muted/30 border border-border/60 rounded-xl"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Input
                    type={showSignupPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    className="h-12 bg-muted/30 border border-border/60 rounded-xl pr-12"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                  >
                    {showSignupPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {showPasswordValidation && (
                  <div className="flex items-center gap-2 text-xs">
                    {passwordValid ? (
                      <Check className="w-3 h-3 text-success-500" />
                    ) : (
                      <X className="w-3 h-3 text-destructive" />
                    )}
                    <span
                      className={
                        passwordValid ? "text-success-500" : "text-destructive"
                      }
                    >
                      At least 8 characters
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm password</label>
                <div className="relative">
                  <Input
                    type={showSignupConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    className="h-12 bg-muted/30 border border-border/60 rounded-xl pr-12"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                    onClick={() =>
                      setShowSignupConfirmPassword(!showSignupConfirmPassword)
                    }
                  >
                    {showSignupConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {signupConfirm.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    {passwordsMatch ? (
                      <>
                        <Check className="w-3 h-3 text-success-500" />
                        <span className="text-success-500">
                          Passwords match
                        </span>
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3 text-destructive" />
                        <span className="text-destructive">
                          Passwords do not match
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-destructive/10 backdrop-blur-sm border border-destructive/20 rounded-xl">
                  <p
                    className="text-destructive text-sm font-medium"
                    role="alert"
                  >
                    {error}
                  </p>
                </div>
              )}

              <Button
                className="w-full h-12 rounded-xl"
                disabled={
                  !passwordsMatch ||
                  !signupEmail ||
                  !signupPassword ||
                  !passwordValid ||
                  isLoading
                }
                type="submit"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating account...
                  </div>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
