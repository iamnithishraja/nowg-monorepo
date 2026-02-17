import type { Route } from "./+types/forgot-password";
import { useState } from "react";
import { Link } from "react-router";
import { Check, SpinnerGap, X } from "@phosphor-icons/react";
import { Input } from "../components/ui/input";
import { authClient } from "../lib/authClient";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Forgot Password - Nowgai" },
    { name: "description", content: "Reset your Nowgai account password" },
  ];
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError("");
    setSuccess(false);
    setUserNotFound(false);

    try {
      // First, check if the user exists
      const userExists = await checkUserExists(email);
      
      if (!userExists) {
        setUserNotFound(true);
        setError("No account found with this email address.");
        setIsLoading(false);
        return;
      }

      // User exists, proceed with password reset
      console.log("📧 Requesting password reset for:", email);
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      
      console.log("Password reset request result:", result);
      
      // Check if there's an error in the result
      if (result?.error) {
        throw new Error(result.error.message || "Failed to send reset email");
      }
      
      setSuccess(true);
    } catch (err) {
      console.error("❌ Forgot password error:", err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'object' && err !== null && 'message' in err
        ? String(err.message)
        : "Failed to send reset email. Please try again.";
      
      setError(errorMessage);
      setSuccess(false);
      setUserNotFound(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Forgot your password?</h1>
          <p className="text-white/60">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4 backdrop-blur-sm">
          {success ? (
            <div className="text-center space-y-6 py-4">
              <div className="relative">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-400/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center backdrop-blur-sm">
                  <Check className="w-10 h-10 text-purple-400" weight="bold" />
                </div>
                <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-purple-500/5 animate-ping" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">
                  Reset link sent!
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  We've sent a password reset link to{" "}
                  <span className="text-white font-semibold break-all">{email}</span>.
                  Please check your inbox and follow the instructions.
                </p>
              </div>
              <div className="text-sm text-white/40">
                <p>
                  Didn't receive the email? Check your spam folder or try again.
                </p>
              </div>
              <Link
                to="/"
                className="inline-block w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-sm hover:from-purple-400 hover:to-purple-500 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2.5">
                <label className="text-sm font-semibold text-white/80 tracking-wide">
                  Email address
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  className="h-12 bg-white/[0.02] border-white/[0.06] rounded-xl text-white placeholder:text-white/40 focus:border-purple-500/50 focus:ring-purple-500/20 focus:ring-2 focus:bg-white/[0.04] transition-all duration-300"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <div className={`p-4 rounded-xl backdrop-blur-sm ${
                  userNotFound 
                    ? "bg-yellow-500/5 border border-yellow-500/20" 
                    : "bg-red-500/5 border border-red-500/10"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      userNotFound 
                        ? "bg-yellow-500/20" 
                        : "bg-red-500/20"
                    }`}>
                      <X className={`w-3 h-3 ${
                        userNotFound ? "text-yellow-400" : "text-red-400"
                      }`} weight="bold" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className={`text-sm font-medium ${
                        userNotFound ? "text-yellow-400" : "text-red-400"
                      }`} role="alert">
                        {error}
                      </p>
                      {userNotFound && (
                        <div className="pt-2 space-y-2">
                          <p className="text-sm text-white/60">
                            Don't have an account yet? Create one to get started.
                          </p>
                          <Link
                            to="/?tab=signup"
                            className="inline-flex items-center justify-center w-full h-10 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium text-sm hover:from-purple-400 hover:to-purple-500 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
                          >
                            Create Account
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!email || isLoading}
                className="group relative w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-sm hover:from-purple-400 hover:to-purple-500 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2 overflow-hidden"
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/90 to-purple-600/90 flex items-center justify-center">
                    <SpinnerGap className="w-5 h-5 animate-spin text-white" weight="bold" />
                  </div>
                )}
                <span className={isLoading ? "opacity-0" : "opacity-100"}>
                  Send reset link
                </span>
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-white/40">
          Remember your password?{" "}
          <Link to="/" className="text-purple-400 hover:text-purple-300 font-medium hover:underline transition-all duration-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
