import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { client } from "@/lib/client";
import { UserRole } from "@nowgai/shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    CheckCircle2,
    Clock,
    DollarSign,
    FolderKanban,
    XCircle,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

interface FundRequest {
  id: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  amount: number;
  description: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  reviewedBy: string | null;
  reviewComments: string;
  createdAt: string;
  reviewedAt: string | null;
}

interface FundRequestsResponse {
  fundRequests: FundRequest[];
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatCurrency = (amount: number) => {
  return `$${amount.toFixed(2)}`;
};

export default function FundRequestsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<FundRequest | null>(
    null
  );
  const [reviewComments, setReviewComments] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null
  );

  const userRole = (user as any)?.role;
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;

  // Fetch fund requests
  const { data: fundRequestsData, isLoading } = useQuery<FundRequestsResponse>(
    {
      queryKey: ["/api/admin/fund-requests"],
      queryFn: async () => {
        return client.get<FundRequestsResponse>("/api/admin/fund-requests");
      },
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return client.post(`/api/admin/fund-requests/${requestId}/approve`, {
        reviewComments: reviewComments.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      toast({
        title: "Request Approved",
        description: "Funds have been transferred to the project",
      });
      setSelectedRequest(null);
      setReviewComments("");
      setActionType(null);
    },
    onError: (error: any) => {
      let errorMessage = "Failed to approve request";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return client.post(`/api/admin/fund-requests/${requestId}/reject`, {
        reviewComments: reviewComments.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      toast({
        title: "Request Rejected",
        description: "Fund request has been rejected",
      });
      setSelectedRequest(null);
      setReviewComments("");
      setActionType(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (request: FundRequest) => {
    setSelectedRequest(request);
    setActionType("approve");
    setReviewComments("");
  };

  const handleReject = (request: FundRequest) => {
    setSelectedRequest(request);
    setActionType("reject");
    setReviewComments("");
  };

  const confirmAction = () => {
    if (!selectedRequest) return;

    if (actionType === "approve") {
      approveMutation.mutate(selectedRequest.id);
    } else if (actionType === "reject") {
      rejectMutation.mutate(selectedRequest.id);
    }
  };

  const fundRequests = fundRequestsData?.fundRequests || [];
  const pendingRequests = fundRequests.filter((r) => r.status === "pending");
  const approvedRequests = fundRequests.filter((r) => r.status === "approved");
  const rejectedRequests = fundRequests.filter((r) => r.status === "rejected");

  if (!isOrgAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              You don't have permission to view fund requests. Only organization
              admins can view and manage fund requests.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          Fund Requests
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and manage fund requests from project admins
        </p>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>
            Fund requests awaiting your approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending fund requests
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                        {request.projectName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {request.organizationName}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(request.amount)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {request.description || (
                        <span className="text-muted-foreground">No description</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(request.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(request)}
                          disabled={
                            approveMutation.isPending ||
                            rejectMutation.isPending
                          }
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request)}
                          disabled={
                            approveMutation.isPending ||
                            rejectMutation.isPending
                          }
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approved Requests */}
      {approvedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Approved Requests ({approvedRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.projectName}</TableCell>
                    <TableCell>{request.organizationName}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(request.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.reviewedAt
                        ? formatDate(request.reviewedAt)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-600">
                        Approved
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rejected Requests */}
      {rejectedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Rejected Requests ({rejectedRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejectedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.projectName}</TableCell>
                    <TableCell>{request.organizationName}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(request.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.reviewedAt
                        ? formatDate(request.reviewedAt)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Rejected</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setReviewComments("");
            setActionType(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve"
                ? "Approve Fund Request"
                : "Reject Fund Request"}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  {actionType === "approve"
                    ? `Approve ${formatCurrency(selectedRequest.amount)} for ${selectedRequest.projectName}?`
                    : `Reject ${formatCurrency(selectedRequest.amount)} request from ${selectedRequest.projectName}?`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequest && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Project
                    </Label>
                    <p className="font-medium">{selectedRequest.projectName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Amount
                    </Label>
                    <p className="font-medium">
                      {formatCurrency(selectedRequest.amount)}
                    </p>
                  </div>
                </div>
                {selectedRequest.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Description
                    </Label>
                    <p className="text-sm">{selectedRequest.description}</p>
                  </div>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="review-comments">
                Review Comments (Optional)
              </Label>
              <Textarea
                id="review-comments"
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Add any comments about this decision..."
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setReviewComments("");
                setActionType(null);
              }}
              disabled={
                approveMutation.isPending || rejectMutation.isPending
              }
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={
                approveMutation.isPending || rejectMutation.isPending
              }
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {approveMutation.isPending || rejectMutation.isPending
                ? "Processing..."
                : actionType === "approve"
                ? "Approve"
                : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

