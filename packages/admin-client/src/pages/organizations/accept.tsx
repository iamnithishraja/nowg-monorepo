import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { client } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

export default function AcceptInvitation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      toast({
        title: "Error",
        description: "Invalid invitation link",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/login"), 2000);
    }
  }, [setLocation, toast]);

  const acceptMutation = useMutation({
    mutationFn: async (token: string) => {
      return client.post("/api/organizations/accept", { token });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: data.message || "Invitation accepted successfully",
      });
      setTimeout(() => setLocation("/login"), 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    },
  });

  const handleAccept = () => {
    if (token) {
      acceptMutation.mutate(token);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-muted-foreground">
                Invalid invitation link. Redirecting...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Organization Admin Invitation
          </CardTitle>
          <CardDescription>
            You've been invited to become an Organization Admin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {acceptMutation.isSuccess ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
              <p className="text-lg font-medium">
                Invitation accepted successfully!
              </p>
              <p className="text-muted-foreground">
                You can now log in to access your organization admin panel.
              </p>
            </div>
          ) : acceptMutation.isError ? (
            <div className="text-center space-y-4">
              <XCircle className="h-16 w-16 text-destructive mx-auto" />
              <p className="text-lg font-medium text-destructive">
                Failed to accept invitation
              </p>
              <p className="text-muted-foreground">
                {acceptMutation.error?.message || "An error occurred"}
              </p>
              <Button onClick={handleAccept} className="w-full">
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  By accepting this invitation, you will become an Organization
                  Admin with the ability to manage your organization's settings
                  and invite members from allowed domains.
                </p>
              </div>
              <Button
                onClick={handleAccept}
                disabled={acceptMutation.isPending}
                className="w-full"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Accept Invitation
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
