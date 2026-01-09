import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  ArrowLeft,
} from "lucide-react";
import { client } from "@/lib/client";

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

export default function ProjectFundRequestsPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const projectId = params.projectId;

  // Fetch fund requests for this project
  const { data: fundRequestsData, isLoading } = useQuery<FundRequestsResponse>(
    {
      queryKey: ["/api/admin/fund-requests", projectId],
      queryFn: async () => {
        return client.get<FundRequestsResponse>("/api/admin/fund-requests", {
          params: { projectId },
        });
      },
      enabled: !!projectId,
    }
  );

  const fundRequests = fundRequestsData?.fundRequests || [];
  const pendingRequests = fundRequests.filter((r) => r.status === "pending");
  const approvedRequests = fundRequests.filter((r) => r.status === "approved");
  const rejectedRequests = fundRequests.filter((r) => r.status === "rejected");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/admin/projects/${projectId}/wallet`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Fund Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            View fund requests for this project
          </p>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Requests ({pendingRequests.length})
            </CardTitle>
            <CardDescription>
              Requests awaiting organization admin approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {formatCurrency(request.amount)}
                    </TableCell>
                    <TableCell>
                      {request.description || (
                        <span className="text-muted-foreground">
                          No description
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(request.createdAt)}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {formatCurrency(request.amount)}
                    </TableCell>
                    <TableCell>
                      {request.description || (
                        <span className="text-muted-foreground">
                          No description
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.reviewedAt
                        ? formatDate(request.reviewedAt)
                        : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
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
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Review Comments</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejectedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {formatCurrency(request.amount)}
                    </TableCell>
                    <TableCell>
                      {request.description || (
                        <span className="text-muted-foreground">
                          No description
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.reviewedAt
                        ? formatDate(request.reviewedAt)
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {request.reviewComments || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {fundRequests.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Fund Requests</h3>
            <p className="text-muted-foreground text-sm mb-4">
              No fund requests have been created for this project yet.
            </p>
            <Button
              onClick={() => setLocation(`/admin/projects/${projectId}/wallet`)}
            >
              Go to Project Wallet
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading fund requests...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

