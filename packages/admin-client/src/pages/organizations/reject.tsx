import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { XCircle, CheckCircle2, Loader2 } from "lucide-react";
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

export default function RejectInvitation() {
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

  const rejectMutation = useMutation({
    mutationFn: async (token: string) => {
      return client.post("/api/organizations/reject", { token });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: data.message || "Invitation rejected successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject invitation",
        variant: "destructive",
      });
    },
  });

  const handleReject = () => {
    if (token) {
      rejectMutation.mutate(token);
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
          <CardTitle className="text-2xl">Reject Invitation</CardTitle>
          <CardDescription>
            Are you sure you want to reject this organization admin invitation?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rejectMutation.isSuccess ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
              <p className="text-lg font-medium">
                Invitation rejected successfully
              </p>
              <p className="text-muted-foreground">
                You have declined the organization admin invitation.
              </p>
            </div>
          ) : rejectMutation.isError ? (
            <div className="text-center space-y-4">
              <XCircle className="h-16 w-16 text-destructive mx-auto" />
              <p className="text-lg font-medium text-destructive">
                Failed to reject invitation
              </p>
              <p className="text-muted-foreground">
                {rejectMutation.error?.message || "An error occurred"}
              </p>
              <Button onClick={handleReject} className="w-full">
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  If you reject this invitation, you will not become an
                  Organization Admin. You can contact the administrator if you
                  change your mind later.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/login")}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={rejectMutation.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
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
