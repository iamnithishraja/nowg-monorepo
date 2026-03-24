import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";

type InvitationStatus = "pending" | "accepted" | "rejected" | "expired" | "not_found" | null;

export default function RejectOrgUserInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<InvitationStatus>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

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

  // Check if invitation has already been reacted to
  useEffect(() => {
    if (!token) return;

    const checkInvitationStatus = async () => {
      try {
        const response = await fetch(
          `/api/organizations/user/accept?token=${encodeURIComponent(token)}`,
          { credentials: "include" }
        );
        if (response.ok) {
          const data = await response.json();
          setInvitationStatus(data.status as InvitationStatus);
        } else if (response.status === 404) {
          setInvitationStatus("not_found");
        }
      } catch {
        // If status check fails, silently continue to show the normal flow
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkInvitationStatus();
  }, [token]);

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
        // If already reacted (409), surface as friendly state
        if (error.alreadyReacted || response.status === 409) {
          setInvitationStatus(error.status as InvitationStatus);
          return;
        }
        throw new Error(error.message || error.error || "Failed to reject invitation");
      }

      return response.json();
    },
    onSuccess: (data: any) => {
      if (!data) return; // Already-reacted case handled above
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

  // Show loading while checking invitation status
  if (isCheckingStatus) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show "already reacted" screen if invitation was already accepted or rejected
  if (invitationStatus === "accepted" || invitationStatus === "rejected") {
    const isAccepted = invitationStatus === "accepted";
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <CardHeader className="space-y-2">
            <CardTitle className="text-center text-2xl font-bold text-gray-900 dark:text-white">
              Invitation Already {isAccepted ? "Accepted" : "Rejected"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-6">
              <div className={`rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-5 ${isAccepted ? "bg-blue-50 dark:bg-blue-900/30" : "bg-orange-50 dark:bg-orange-900/30"}`}>
                <Info className={`h-10 w-10 ${isAccepted ? "text-blue-500" : "text-orange-500"}`} />
              </div>
              <p className="text-gray-700 dark:text-gray-200 font-medium text-base mb-2">
                You have already reacted to this invitation.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isAccepted
                  ? "You previously accepted this invitation and are already part of the organization."
                  : "You previously declined this invitation. Contact the organization admin if you'd like to join."}
              </p>
            </div>
            <Button
              onClick={() => navigate("/home")}
              className="w-full"
              size="lg"
            >
              Go to Home
            </Button>
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
