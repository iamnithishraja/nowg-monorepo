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

export default function AcceptOrgUserInvitation() {
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
      return client.post("/api/organizations/user/accept", { token });
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

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Organization Invitation</CardTitle>
          <CardDescription className="text-center">
            You've been invited to join an organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {acceptMutation.isPending ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Processing...</p>
            </div>
          ) : acceptMutation.isSuccess ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Invitation Accepted!
              </h3>
              <p className="text-muted-foreground">
                You have successfully joined the organization.
              </p>
            </div>
          ) : acceptMutation.isError ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error</h3>
              <p className="text-muted-foreground">
                {acceptMutation.error instanceof Error
                  ? acceptMutation.error.message
                  : "Failed to accept invitation"}
              </p>
            </div>
          ) : (
            <>
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-6">
                  Click the button below to accept this invitation and join the
                  organization.
                </p>
              </div>
              <Button onClick={handleAccept} className="w-full" size="lg">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Accept Invitation
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
