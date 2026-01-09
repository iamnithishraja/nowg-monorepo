import type { Route } from "./+types/reset-password";
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="w-20 h-20 border-4 border-border border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Create new password</h1>
          <p className="text-muted-foreground">Enter your new password below</p>
        </div>

        <div className="bg-card/60 border border-border rounded-2xl p-6 space-y-4">
          {success ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <h3 className="text-lg font-semibold text-primary mb-2">
                  Password reset successful!
                </h3>
                <p className="text-primary text-sm">
                  Your password has been updated successfully. You can now sign
                  in with your new password.
                </p>
              </div>
              <Link
                to="/"
                className="inline-block w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm text-foreground">New Password</label>
                <Input
                  type="password"
                  placeholder="At least 8 characters"
                  className="bg-transparent border-border"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  placeholder="Re-enter your new password"
                  className="bg-transparent border-border"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  aria-invalid={showMismatch}
                  required
                />
                {showMismatch && (
                  <p className="text-xs text-destructive">
                    Passwords do not match.
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm" role="alert">
                    {error}
                  </p>
                </div>
              )}

              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!passwordsMatch || !password || !token || isLoading}
                type="submit"
              >
                {isLoading ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link to="/" className="text-foreground underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
