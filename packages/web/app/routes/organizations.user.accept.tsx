import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, UserPlus, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";

export default function AcceptOrgUserInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      toast({
        title: "Error",
        description: "Invalid invitation link",
        variant: "destructive",
      });
      setTimeout(() => navigate("/signin"), 2000);
    }
  }, [searchParams, navigate, toast]);

  const acceptMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch("/api/organizations/user/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const error = await response.json();
        // If authentication is required, throw a special error
        if (error.requiresAuth || response.status === 401) {
          const authError = new Error(
            error.message || "Authentication required"
          );
          (authError as any).requiresAuth = true;
          throw authError;
        }
        throw new Error(
          error.message || error.error || "Failed to accept invitation"
        );
      }

      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: data.message || "Invitation accepted successfully",
      });
      setTimeout(() => navigate("/home"), 2000);
    },
    onError: (error: Error) => {
      // If authentication is required, redirect to signup
      if ((error as any).requiresAuth) {
        toast({
          title: "Sign up required",
          description: "Please create an account to accept this invitation",
        });
        setTimeout(() => {
          navigate(`/signup?inviteToken=${token}`);
        }, 1500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch("/api/organizations/user/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || error.error || "Failed to reject invitation"
        );
      }

      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Invitation Rejected",
        description: data.message || "Invitation rejected successfully",
      });
      setTimeout(() => navigate("/home"), 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject invitation",
        variant: "destructive",
      });
    },
  });

  const handleAccept = useCallback(() => {
    if (token) {
      acceptMutation.mutate(token);
    }
  }, [token, acceptMutation]);

  const handleReject = useCallback(() => {
    if (token) {
      rejectMutation.mutate(token);
    }
  }, [token, rejectMutation]);

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        });
        if (response.ok) {
          const session = await response.json();
          setIsAuthenticated(!!session?.user);
        }
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    if (token) {
      checkAuth();
    }
  }, [token]);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-muted-foreground">Invalid invitation link</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If not authenticated, show signup prompt
  if (
    !isAuthenticated &&
    !acceptMutation.isError &&
    !acceptMutation.isPending
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <CardHeader className="space-y-2">
            <CardTitle className="text-center text-2xl font-bold text-gray-900 dark:text-white">
              Organization Invitation
            </CardTitle>
            <CardDescription className="text-center text-base text-gray-600 dark:text-gray-300">
              You've been invited to join an organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <UserPlus className="h-16 w-16 text-primary mx-auto mb-4 opacity-80" />
              <p className="text-gray-700 dark:text-gray-200 mb-2 font-medium">
                To accept this invitation, you need to create a Nowgai account
                first.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                After signing up, you'll be able to accept or reject this
                invitation.
              </p>
            </div>
            <Button
              onClick={() => navigate(`/signup?inviteToken=${token}`)}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
              size="lg"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Create Account
            </Button>
            <Button
              onClick={() => navigate(`/signin?inviteToken=${token}`)}
              variant="outline"
              className="w-full border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
              size="lg"
            >
              Already have an account? Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="space-y-2">
          <CardTitle className="text-center text-2xl font-bold text-gray-900 dark:text-white">
            Organization Invitation
          </CardTitle>
          <CardDescription className="text-center text-base text-gray-600 dark:text-gray-300">
            You've been invited to join an organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {acceptMutation.isPending ? (
            <div className="text-center py-8">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-gray-700 dark:text-gray-200 font-medium">
                Processing invitation...
              </p>
            </div>
          ) : acceptMutation.isSuccess ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                Invitation Accepted!
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                You have successfully joined the organization.
              </p>
            </div>
          ) : rejectMutation.isSuccess ? (
            <div className="text-center py-8">
              <XCircle className="h-16 w-16 text-orange-600 dark:text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                Invitation Rejected
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                You have rejected this invitation.
              </p>
            </div>
          ) : acceptMutation.isError || rejectMutation.isError ? (
            <div className="text-center py-8">
              <XCircle className="h-16 w-16 text-red-600 dark:text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                Error
              </h3>
              <p className="text-gray-700 dark:text-gray-200 mb-4 font-medium">
                {acceptMutation.error instanceof Error
                  ? acceptMutation.error.message
                  : rejectMutation.error instanceof Error
                  ? rejectMutation.error.message
                  : "Failed to process invitation"}
              </p>
              {(acceptMutation.error as any)?.requiresAuth && (
                <Button
                  onClick={() => navigate(`/signup?inviteToken=${token}`)}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                  size="lg"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Create Account
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="text-center py-4">
                <p className="text-gray-700 dark:text-gray-200 mb-6 font-medium">
                  You've been invited to join an organization. Choose to accept or reject this invitation.
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={handleAccept}
                  disabled={acceptMutation.isPending || rejectMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                  size="lg"
                >
                  {acceptMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Accept Invitation
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={acceptMutation.isPending || rejectMutation.isPending}
                  variant="outline"
                  className="w-full border-2 border-red-300 dark:border-red-600 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold"
                  size="lg"
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5 mr-2" />
                      Reject Invitation
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
