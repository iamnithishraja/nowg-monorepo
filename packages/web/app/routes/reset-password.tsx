import type { Route } from "./+types/reset-password";
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, Eye, EyeSlash, SpinnerGap, X } from "@phosphor-icons/react";
import { Input } from "../components/ui/input";
import { authClient } from "../lib/authClient";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Reset Password - Nowgai" },
    { name: "description", content: "Create a new password for your account" },
  ];
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      setError(
        "Invalid or missing reset token. Please request a new password reset."
      );
    }
  }, [searchParams]);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const showMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;
  const passwordValid = password.length >= 8;
  const showPasswordValidation = password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch || !password || !token) return;

    setIsLoading(true);
    setError("");

    try {
      await authClient.resetPassword({
        newPassword: password,
        token,
      });
      setSuccess(true);
    } catch (err) {
      console.error("Reset password error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reset password. Please try again or request a new reset link."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token && !error) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center px-6">
        <div className="w-20 h-20 border-4 border-white/[0.06] border-t-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Create new password</h1>
          <p className="text-white/60">Enter your new password below</p>
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
                  Password reset successful!
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Your password has been updated successfully. You can now sign
                  in with your new password.
                </p>
              </div>
              <Link
                to="/"
                className="inline-block w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-sm hover:from-purple-400 hover:to-purple-500 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2.5">
                <label className="text-sm font-semibold text-white/80 tracking-wide">
                  New Password
                </label>
                <div className="relative group">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    className="h-12 bg-white/[0.02] border-white/[0.06] rounded-xl text-white placeholder:text-white/40 pr-12 focus:border-purple-500/50 focus:ring-purple-500/20 focus:ring-2 focus:bg-white/[0.04] transition-all duration-300"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all duration-200"
                  >
                    {showPassword ? (
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
                  Confirm New Password
                </label>
                <div className="relative group">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    className="h-12 bg-white/[0.02] border-white/[0.06] rounded-xl text-white placeholder:text-white/40 pr-12 focus:border-purple-500/50 focus:ring-purple-500/20 focus:ring-2 focus:bg-white/[0.04] transition-all duration-300"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    aria-invalid={showMismatch}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all duration-200"
                  >
                    {showConfirmPassword ? (
                      <EyeSlash className="w-5 h-5" weight="bold" />
                    ) : (
                      <Eye className="w-5 h-5" weight="bold" />
                    )}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
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

              {error && (
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                      <X className="w-3 h-3 text-red-400" weight="bold" />
                    </div>
                    <p className="text-sm text-red-400 font-medium flex-1" role="alert">
                      {error}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!passwordsMatch || !password || !token || isLoading}
                className="group relative w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-sm hover:from-purple-400 hover:to-purple-500 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2 overflow-hidden"
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/90 to-purple-600/90 flex items-center justify-center">
                    <SpinnerGap className="w-5 h-5 animate-spin text-white" weight="bold" />
                  </div>
                )}
                <span className={isLoading ? "opacity-0" : "opacity-100"}>
                  Update password
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
