import type { Route } from "./+types/forgot-password";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Forgot your password?</h1>
          <p className="text-muted-foreground">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <div className="bg-card/60 border border-border rounded-2xl p-6 space-y-4">
          {success ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <h3 className="text-lg font-semibold text-primary mb-2">
                  Reset link sent!
                </h3>
                <p className="text-primary text-sm">
                  We've sent a password reset link to <strong>{email}</strong>.
                  Please check your inbox and follow the instructions.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  Didn't receive the email? Check your spam folder or try again.
                </p>
              </div>
              <Link
                to="/"
                className="inline-block w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm text-foreground">Email address</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  className="bg-transparent border-border"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
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
                disabled={!email || isLoading}
                type="submit"
              >
                {isLoading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-400">
          Remember your password?{" "}
          <Link to="/" className="text-gray-200 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
