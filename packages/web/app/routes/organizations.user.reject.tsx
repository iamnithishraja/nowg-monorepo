import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";

export default function RejectOrgUserInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

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
        throw new Error(error.message || error.error || "Failed to reject invitation");
      }

      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: data.message || "Invitation rejected successfully",
      });
      setTimeout(() => navigate("/signin"), 2000);
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
          {rejectMutation.isPending ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Processing...</p>
            </div>
          ) : rejectMutation.isSuccess ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Invitation Rejected
              </h3>
              <p className="text-muted-foreground">
                You have rejected this invitation.
              </p>
            </div>
          ) : rejectMutation.isError ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error</h3>
              <p className="text-muted-foreground">
                {rejectMutation.error instanceof Error
                  ? rejectMutation.error.message
                  : "Failed to reject invitation"}
              </p>
            </div>
          ) : (
            <>
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-6">
                  Click the button below to reject this invitation.
                </p>
              </div>
              <Button
                onClick={handleReject}
                className="w-full"
                size="lg"
                variant="destructive"
              >
                <XCircle className="h-5 w-5 mr-2" />
                Reject Invitation
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

