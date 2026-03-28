import {
  Check,
  Eye,
  EyeSlash,
  GithubLogo,
  GoogleLogo,
  ShieldCheck,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { Link } from "react-router";
import { authClient, signIn, signUp } from "../lib/authClient";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const BLOCKED_EMAIL_DOMAINS = new Set([
  // Placeholder / test domains
  "example.com", "example.org", "example.net", "example.io",
  "test.com", "test.org", "test.net", "test.io",
  "abc.com", "abc.org", "abc.net",
  "foo.com", "bar.com", "baz.com",
  "fake.com", "fake.org", "fake.net",
  "dummy.com", "dummy.org",
  "sample.com", "sample.org",
  "placeholder.com",
  "noreply.com", "no-reply.com",
  "invalid.com", "invalid.org",
  "domain.com", "domain.org",
  "email.com", "myemail.com",
  "mail.com", "webmail.com",
  "username.com",
  "user.com",
  "none.com",
  "null.com",
  "admin.com",
  "test123.com",
  "xyz.com", "xyz.org",
  "aaa.com", "bbb.com", "ccc.com",
  "asdf.com", "qwerty.com",
  // Disposable / temp-mail providers
  "mailinator.com", "guerrillamail.com", "guerrillamail.net",
  "guerrillamail.org", "guerrillamail.de", "guerrillamail.biz",
  "guerrillamail.info", "guerrillamailblock.com",
  "sharklasers.com", "guerrillamaildesktop.com", "grr.la",
  "spam4.me", "yopmail.com", "yopmail.fr", "cool.fr.nf",
  "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx",
  "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
  "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  "trashmail.com", "trashmail.me", "trashmail.net",
  "trashmail.at", "trashmail.io", "trashmail.xyz",
  "dispostable.com", "mailnull.com", "spamgourmet.com",
  "throwam.com", "throwam.net",
  "tempmail.com", "tempmail.net", "tempmail.org",
  "temp-mail.org", "temp-mail.ru", "temp-mail.io",
  "tempr.email", "discard.email",
  "mailnesia.com", "maildrop.cc",
  "fakeinbox.com", "throwaway.email",
  "mytempemail.com", "tempemail.net",
  "mailtemp.info", "emailondeck.com",
  "getnada.com", "inboxkitten.com",
  "owlpic.com",
  "mohmal.com",
]);

type AuthInitialTab = "signin" | "signup";

interface AuthFormProps {
  initialTab?: AuthInitialTab;
  inviteToken?: string;
  showCreateAccountMessage?: boolean;
}

export default function AuthForm({ initialTab = "signin", inviteToken, showCreateAccountMessage }: AuthFormProps) {
  // shared
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<AuthInitialTab>(initialTab);

  // sign in state
  const [signinEmail, setSigninEmail] = useState("");
  const [signinEmailError, setSigninEmailError] = useState("");
  const [signinEmailTouched, setSigninEmailTouched] = useState(false);
  const [signinPassword, setSigninPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // sign up state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupEmailError, setSignupEmailError] = useState("");
  const [signupEmailTouched, setSignupEmailTouched] = useState(false);
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

  // Real-time email validation helper
  const validateEmail = useCallback((email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return "";
    if (/\s/.test(trimmed)) return "Email must not contain spaces";
    if (trimmed.includes("..")) return "Email cannot contain consecutive dots";
    if (!trimmed.includes("@")) return "Email must contain an @ symbol";
    const [local, domain] = trimmed.split("@");
    if (!local) return "Email is missing the part before @";
    if (!domain) return "Email is missing the domain after @";
    if (!domain.includes(".")) return "Email domain must contain a dot (e.g. gmail.com)";
    const tld = domain.split(".").pop();
    if (!tld || tld.length < 2) return "Email must have a valid extension (e.g. .com, .in)";
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(trimmed)) return "Please enter a valid email address";
    if (BLOCKED_EMAIL_DOMAINS.has(domain.toLowerCase())) return "Please use a valid business or personal email address";
    return "";
  }, []);

  const handleSigninEmailChange = (value: string) => {
    setSigninEmail(value);
    if (signinEmailTouched) {
      setSigninEmailError(validateEmail(value));
    }
  };

  const handleSignupEmailChange = (value: string) => {
    setSignupEmail(value);
    if (signupEmailTouched) {
      setSignupEmailError(validateEmail(value));
    }
  };

  const signinEmailValid = signinEmail.length > 0 && !validateEmail(signinEmail);
  const signupEmailValid = signupEmail.length > 0 && !validateEmail(signupEmail);

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

  // Helper function to check if user exists
  const checkUserExists = async (email: string): Promise<boolean> => {
    try {
      const checkUserResponse = await fetch("/api/check-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (checkUserResponse.ok) {
        const checkResult = await checkUserResponse.json();
        return checkResult.exists === true;
      }
      return false;
    } catch (error) {
      console.error("Error checking user existence:", error);
      return false;
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signinEmail || !signinPassword) return;

    // Validate email before submitting
    setSigninEmailTouched(true);
    const emailErr = validateEmail(signinEmail);
    if (emailErr) {
      setSigninEmailError(emailErr);
      return;
    }

    setIsLoading(true);
    setError("");
    setShowResendVerification(false);

    try {

      // First, check if the user exists
      const userExists = await checkUserExists(signinEmail);
      
      if (!userExists) {
        const redirectUrl = inviteToken 
          ? `/signup?needAccount=true&inviteToken=${inviteToken}`
          : `/signup?needAccount=true`;
        window.location.href = redirectUrl;
        return;
      }

      // User exists, proceed with sign-in
      const result = await signIn.email(
        { email: signinEmail, password: signinPassword },
        {
          onError: async (ctx) => {
            if (ctx.error.status === 403) {
              setError("Please verify your email before signing in.");
              setShowResendVerification(true);
            } else {
              // Better Auth might return "Invalid password" even if user doesn't exist (for security)
              // Double-check user existence to provide helpful message
              const errorMessage = ctx.error.message || "";
              if (
                errorMessage.toLowerCase().includes("invalid") ||
                errorMessage.toLowerCase().includes("password")
              ) {
                const stillExists = await checkUserExists(signinEmail);
                if (!stillExists) {
                  const redirectUrl = inviteToken 
                    ? `/signup?needAccount=true&inviteToken=${inviteToken}`
                    : `/signup?needAccount=true`;
                  window.location.href = redirectUrl;
                  return;
                }
              }
              setError(ctx.error.message || "Invalid email or password");
            }
          },
        }
      );

      if (result?.error) {
        // If we get here, user exists but password is wrong (we already checked existence)
        throw new Error(result.error.message || "Invalid email or password");
      }
      
      // If there's an inviteToken, redirect to accept invitation
      if (inviteToken) {
        window.location.href = `/organizations/user/accept?token=${inviteToken}`;
      } else {
        window.location.href = "/home";
      }
    } catch (err) {
      // If error occurs, check one more time if user exists
      // This handles edge cases where Better Auth might throw before onError
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.toLowerCase().includes("invalid") &&
        (errorMessage.toLowerCase().includes("password") || errorMessage.toLowerCase().includes("email"))
      ) {
        const userExists = await checkUserExists(signinEmail);
        if (!userExists) {
          const redirectUrl = inviteToken 
            ? `/signup?needAccount=true&inviteToken=${inviteToken}`
            : `/signup?needAccount=true`;
          window.location.href = redirectUrl;
          return;
        }
      }
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
    // Validate email before submitting
    setSignupEmailTouched(true);
    const emailErr = validateEmail(signupEmail);
    if (emailErr) {
      setSignupEmailError(emailErr);
      return;
    }

    setIsLoading(true);
    setError("");
    try {

      // First, check if the user already exists
      const userExists = await checkUserExists(signupEmail);
      if (userExists) {
        setError("An account with this email already exists. Please sign in instead.");
        setIsLoading(false);
        return;
      }

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
    <div className="space-y-7">
      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleSocial("google")}
          disabled={isLoading}
          className="group flex items-center justify-center gap-2.5 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/70 font-medium text-sm hover:bg-white/[0.06] hover:border-white/[0.12] hover:text-white hover:shadow-lg hover:shadow-white/[0.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleLogo className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" weight="bold" />
          Google
        </button>
        <button
          onClick={() => handleSocial("github")}
          disabled={isLoading}
          className="group flex items-center justify-center gap-2.5 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/70 font-medium text-sm hover:bg-white/[0.06] hover:border-white/[0.12] hover:text-white hover:shadow-lg hover:shadow-white/[0.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GithubLogo className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" weight="bold" />
          GitHub
        </button>
      </div>

      {/* Divider */}
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-white/[0.06]" />
        <div className="relative flex justify-center text-xs text-white/40 font-medium px-4 bg-[#0c0c0c]">
          <span className="bg-[#0c0c0c] px-2 uppercase tracking-widest">or</span>
        </div>
        <div className="flex-1 border-t border-white/[0.06]" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AuthInitialTab)} className="w-full">
        <TabsList className="grid grid-cols-2 w-full h-12 p-1.5 bg-white/[0.02] border border-white/[0.04] rounded-xl backdrop-blur-sm">
          <TabsTrigger
            value="signin"
            className="rounded-lg text-sm font-semibold text-white/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 transition-all duration-300"
          >
            Sign in
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="rounded-lg text-sm font-semibold text-white/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 transition-all duration-300"
          >
            Create account
          </TabsTrigger>
        </TabsList>

        {/* Sign In Tab */}
        <TabsContent value="signin" className="mt-8 space-y-6">
          <form className="space-y-5" onSubmit={handleEmailSignIn}>
            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-white/80 tracking-wide">
                Email address
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                className={`h-12 bg-white/[0.02] border-white/[0.06] rounded-xl text-white placeholder:text-white/40 focus:border-purple-500/50 focus:ring-purple-500/20 focus:ring-2 focus:bg-white/[0.04] transition-all duration-300 ${signinEmailTouched && signinEmailError ? "border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20" : ""}`}
                value={signinEmail}
                onChange={(e) => handleSigninEmailChange(e.target.value)}
                onBlur={() => {
                  setSigninEmailTouched(true);
                  setSigninEmailError(validateEmail(signinEmail));
                }}
                disabled={isLoading}
                required
              />
              {signinEmailTouched && signinEmail.length > 0 && (
                <div className="flex items-center gap-3 text-xs mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${signinEmailValid ? "bg-green-500/20" : "bg-red-500/20"}`}>
                    {signinEmailValid ? (
                      <Check className="w-3 h-3 text-green-400" weight="bold" />
                    ) : (
                      <X className="w-3 h-3 text-red-400" weight="bold" />
                    )}
                  </div>
                  <span className={`font-medium ${signinEmailValid ? "text-green-400" : "text-red-400"}`}>
                    {signinEmailValid ? "Valid email" : signinEmailError}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white/80 tracking-wide">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium hover:underline transition-all duration-200"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative group">
                <Input
                  type={showSigninPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="h-12 bg-white/[0.02] border-white/[0.06] rounded-xl text-white placeholder:text-white/40 pr-12 focus:border-purple-500/50 focus:ring-purple-500/20 focus:ring-2 focus:bg-white/[0.04] transition-all duration-300"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSigninPassword(!showSigninPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all duration-200"
                >
                  {showSigninPassword ? (
                    <EyeSlash className="w-5 h-5" weight="bold" />
                  ) : (
                    <Eye className="w-5 h-5" weight="bold" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                    <X className="w-3 h-3 text-red-400" weight="bold" />
                  </div>
                  <p className="text-sm text-red-400 font-medium flex-1">{error}</p>
                </div>
                {showResendVerification && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="mt-4 w-full h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 disabled:opacity-50"
                  >
                    {resendLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <SpinnerGap className="w-4 h-4 animate-spin" weight="bold" />
                        Sending...
                      </div>
                    ) : (
                      "Resend Verification Email"
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Resend Success */}
            {resendSuccess && (
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-400" weight="bold" />
                  </div>
                  <p className="text-sm text-green-400 font-medium">
                    Verification email sent! Check your inbox.
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!signinEmail || !signinPassword || isLoading || !signinEmailValid}
              className="group relative w-full h-12 rounded-xl bg-gradient-to-r from-white to-white/95 text-black font-bold text-sm hover:from-white/95 hover:to-white/85 hover:shadow-lg hover:shadow-white/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2 overflow-hidden"
            >
              {isLoading && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/90 to-white/80 flex items-center justify-center">
                  <SpinnerGap className="w-5 h-5 animate-spin text-black" weight="bold" />
                </div>
              )}
              <span className={isLoading ? "opacity-0" : "opacity-100"}>
                Sign in
              </span>
            </button>

            {/* Security Note */}
            <div className="flex items-center justify-center gap-2 text-xs text-white/40 pt-2">
              <ShieldCheck className="w-4 h-4" weight="bold" />
              <span>Protected by industry-standard encryption</span>
            </div>
          </form>
        </TabsContent>

        {/* Sign Up Tab */}
        <TabsContent value="signup" className="mt-8 space-y-6">
          {showCreateAccountMessage && !signupSuccess && (
            <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-400" weight="bold" />
                </div>
                <p className="text-sm text-green-400 font-medium">
                  Please create an account first, then you can sign in.
                </p>
              </div>
            </div>
          )}
          {signupSuccess ? (
            <div className="text-center space-y-8 py-6">
              <div className="relative">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-400/20 to-green-600/20 border border-green-500/30 flex items-center justify-center backdrop-blur-sm">
                  <Check className="w-10 h-10 text-green-400" weight="bold" />
                </div>
                <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-green-500/5 animate-ping" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">
                  Check your email
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  We sent a verification link to{" "}
                  <span className="text-white font-semibold break-all">{signupEmail}</span>
                </p>
              </div>
              <button
                onClick={() => window.location.assign("/signin")}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-sm hover:from-purple-400 hover:to-purple-500 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleEmailSignUp}>
              <div className="space-y-2.5">
                <label className="text-sm font-semibold text-white/80 tracking-wide">
                  Full name
                </label>
                <Input
                  type="text"
                  placeholder="Your name"
                  className="h-12 bg-white/[0.02] border-white/[0.06] rounded-xl text-white placeholder:text-white/40 focus:border-purple-500/50 focus:ring-purple-500/20 focus:ring-2 focus:bg-white/[0.04] transition-all duration-300"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-semibold text-white/80 tracking-wide">
                  Email address
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  className={`h-12 bg-white/[0.02] border-white/[0.06] rounded-xl text-white placeholder:text-white/40 focus:border-purple-500/50 focus:ring-purple-500/20 focus:ring-2 focus:bg-white/[0.04] transition-all duration-300 ${signupEmailTouched && signupEmailError ? "border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20" : ""}`}
                  value={signupEmail}
                  onChange={(e) => handleSignupEmailChange(e.target.value)}
                  onBlur={() => {
                    setSignupEmailTouched(true);
                    setSignupEmailError(validateEmail(signupEmail));
                  }}
                  disabled={isLoading}
                  required
                />
                {signupEmailTouched && signupEmail.length > 0 && (
                  <div className="flex items-center gap-3 text-xs mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${signupEmailValid ? "bg-green-500/20" : "bg-red-500/20"}`}>
                      {signupEmailValid ? (
                        <Check className="w-3 h-3 text-green-400" weight="bold" />
                      ) : (
                        <X className="w-3 h-3 text-red-400" weight="bold" />
                      )}
                    </div>
                    <span className={`font-medium ${signupEmailValid ? "text-green-400" : "text-red-400"}`}>
                      {signupEmailValid ? "Valid email" : signupEmailError}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-semibold text-white/80 tracking-wide">
                  Password
                </label>
                <div className="relative group">
                  <Input
                    type={showSignupPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    className="h-12 bg-white/[0.02] border-white/[0.06] rounded-xl text-white placeholder:text-white/40 pr-12 focus:border-purple-500/50 focus:ring-purple-500/20 focus:ring-2 focus:bg-white/[0.04] transition-all duration-300"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all duration-200"
                  >
                    {showSignupPassword ? (
                      <EyeSlash className="w-5 h-5" weight="bold" />
                    ) : (
                      <Eye className="w-5 h-5" weight="bold" />
                    )}
                  </button>
                </div>
                {showPasswordValidation && (
                  <div className="flex items-center gap-3 text-xs mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${passwordValid ? "bg-green-500/20" : "bg-red-500/20"}`}>
                      {passwordValid ? (
                        <Check className="w-3 h-3 text-green-400" weight="bold" />
                      ) : (
                        <X className="w-3 h-3 text-red-400" weight="bold" />
                      )}
                    </div>
                    <span className={`font-medium ${passwordValid ? "text-green-400" : "text-red-400"}`}>
                      At least 8 characters
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-semibold text-white/80 tracking-wide">
                  Confirm password
                </label>
                <div className="relative group">
                  <Input
                    type={showSignupConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    className="h-12 bg-white/[0.02] border-white/[0.06] rounded-xl text-white placeholder:text-white/40 pr-12 focus:border-purple-500/50 focus:ring-purple-500/20 focus:ring-2 focus:bg-white/[0.04] transition-all duration-300"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all duration-200"
                  >
                    {showSignupConfirmPassword ? (
                      <EyeSlash className="w-5 h-5" weight="bold" />
                    ) : (
                      <Eye className="w-5 h-5" weight="bold" />
                    )}
                  </button>
                </div>
                {signupConfirm.length > 0 && (
                  <div className="flex items-center gap-3 text-xs mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${passwordsMatch ? "bg-green-500/20" : "bg-red-500/20"}`}>
                      {passwordsMatch ? (
                        <Check className="w-3 h-3 text-green-400" weight="bold" />
                      ) : (
                        <X className="w-3 h-3 text-red-400" weight="bold" />
                      )}
                    </div>
                    <span className={`font-medium ${passwordsMatch ? "text-green-400" : "text-red-400"}`}>
                      {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                    </span>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                      <X className="w-3 h-3 text-red-400" weight="bold" />
                    </div>
                    <p className="text-sm text-red-400 font-medium flex-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  !passwordsMatch ||
                  !signupEmail ||
                  !signupPassword ||
                  !passwordValid ||
                  isLoading
                }
                className="group relative w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-sm hover:from-purple-400 hover:to-purple-500 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2 overflow-hidden"
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/90 to-purple-600/90 flex items-center justify-center">
                    <SpinnerGap className="w-5 h-5 animate-spin text-white" weight="bold" />
                  </div>
                )}
                <span className={isLoading ? "opacity-0" : "opacity-100"}>
                  Create account
                </span>
              </button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
