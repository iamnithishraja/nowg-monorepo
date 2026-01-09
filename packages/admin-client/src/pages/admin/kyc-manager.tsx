import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileCheck, Eye, CheckCircle, XCircle, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { KycRecord } from "@shared/schema";
import { format } from "date-fns";

export default function KycManagerPage() {
  const { toast } = useToast();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<KycRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: records = [], isLoading } = useQuery<KycRecord[]>({
    queryKey: ["/api/kyc-records"]
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest('PATCH', `/api/kyc-records/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-records"] });
      setReviewDialogOpen(false);
      setSelectedRecord(null);
      setNotes("");
      toast({
        title: "Success",
        description: "KYC record updated successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update KYC record",
        variant: "destructive"
      });
    }
  });

  const handleReview = (record: KycRecord) => {
    setSelectedRecord(record);
    setNotes(record.notes || "");
    setReviewDialogOpen(true);
  };

  const handleApprove = () => {
    if (!selectedRecord) return;
    updateMutation.mutate({
      id: selectedRecord.id,
      status: "approved",
      notes: notes.trim() || null,
      reviewedAt: new Date().toISOString()
    });
  };

  const handleReject = () => {
    if (!selectedRecord) return;
    if (!notes.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for rejection",
        variant: "destructive"
      });
      return;
    }
    updateMutation.mutate({
      id: selectedRecord.id,
      status: "rejected",
      notes: notes.trim(),
      reviewedAt: new Date().toISOString()
    });
  };

  const filteredRecords = records.filter(record => {
    if (statusFilter === "all") return true;
    return record.status === statusFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">Pending</Badge>;
    }
  };

  const pendingCount = records.filter(r => r.status === "pending").length;
  const approvedCount = records.filter(r => r.status === "approved").length;
  const rejectedCount = records.filter(r => r.status === "rejected").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">Loading KYC records...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 bg-background">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">KYC Manager</h1>
        <p className="text-muted-foreground">
          Review and manage user identity verification requests
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
              <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-yellow-500/10">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{approvedCount}</p>
              </div>
              <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">{rejectedCount}</p>
              </div>
              <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All ({records.length})</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">Approved ({approvedCount})</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected ({rejectedCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredRecords.length === 0 ? (
        <Card className="p-12 text-center">
          <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No KYC records</h3>
          <p className="text-muted-foreground">
            {statusFilter === "all" 
              ? "No verification requests submitted yet"
              : `No ${statusFilter} verification requests`}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRecords.map((record) => (
            <Card key={record.id} className="shadow-sm hover-elevate" data-testid={`card-kyc-${record.id}`}>
              <CardHeader className="border-b pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{record.fullName}</h3>
                      <p className="text-sm text-muted-foreground">
                        Submitted {format(new Date(record.submittedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(record.status)}
                    <Button variant="outline" size="sm" onClick={() => handleReview(record)} data-testid={`button-review-${record.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Document Type</span>
                    <span className="font-medium capitalize">{record.documentType?.replace('_', ' ') || 'N/A'}</span>
                  </div>
                  {record.institution && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Institution</span>
                      <span className="font-medium">{record.institution}</span>
                    </div>
                  )}
                  {record.studentId && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Student ID</span>
                      <span className="font-medium">{record.studentId}</span>
                    </div>
                  )}
                  {record.dateOfBirth && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Date of Birth</span>
                      <span className="font-medium">{record.dateOfBirth}</span>
                    </div>
                  )}
                  {record.reviewedAt && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Reviewed</span>
                      <span className="font-medium">{format(new Date(record.reviewedAt), "MMM d, yyyy")}</span>
                    </div>
                  )}
                </div>
                {record.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Admin Notes</p>
                    <p className="text-sm">{record.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-review">
          <DialogHeader>
            <DialogTitle>Review KYC Submission</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Full Name</Label>
                  <p className="font-medium">{selectedRecord.fullName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRecord.status)}</div>
                </div>
                {selectedRecord.dateOfBirth && (
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">{selectedRecord.dateOfBirth}</p>
                  </div>
                )}
                {selectedRecord.documentType && (
                  <div>
                    <Label className="text-muted-foreground">Document Type</Label>
                    <p className="font-medium capitalize">{selectedRecord.documentType.replace('_', ' ')}</p>
                  </div>
                )}
                {selectedRecord.institution && (
                  <div>
                    <Label className="text-muted-foreground">Institution</Label>
                    <p className="font-medium">{selectedRecord.institution}</p>
                  </div>
                )}
                {selectedRecord.studentId && (
                  <div>
                    <Label className="text-muted-foreground">Student ID</Label>
                    <p className="font-medium">{selectedRecord.studentId}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p className="font-medium">{format(new Date(selectedRecord.submittedAt), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
                {selectedRecord.reviewedAt && (
                  <div>
                    <Label className="text-muted-foreground">Reviewed</Label>
                    <p className="font-medium">{format(new Date(selectedRecord.reviewedAt), "MMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                )}
              </div>

              {selectedRecord.documentUrl && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Document</Label>
                  <Card className="p-4 bg-muted/30">
                    <a
                      href={selectedRecord.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-2"
                      data-testid="link-document"
                    >
                      <FileCheck className="h-4 w-4" />
                      View Document
                    </a>
                  </Card>
                </div>
              )}

              <div>
                <Label htmlFor="notes">Admin Notes {selectedRecord.status === "pending" && <span className="text-destructive">*</span>}</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this verification..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  data-testid="textarea-notes"
                />
                {selectedRecord.status === "pending" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    * Required when rejecting a submission
                  </p>
                )}
              </div>

              {selectedRecord.status === "pending" && (
                <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => setReviewDialogOpen(false)}
                    data-testid="button-cancel-review"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleReject}
                    disabled={updateMutation.isPending}
                    data-testid="button-reject"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={updateMutation.isPending}
                    data-testid="button-approve"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
