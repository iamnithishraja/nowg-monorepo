import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KycRecord } from "@shared/schema";

export default function KYCManager() {
  const { toast } = useToast();
  const { data: records, isLoading } = useQuery<KycRecord[]>({
    queryKey: ['/api/kyc-records'],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/kyc-records/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kyc-records'] });
      toast({ title: "KYC record updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleApprove = (id: string) => {
    updateMutation.mutate({ id, status: 'approved', reviewedAt: new Date() });
  };

  const handleReject = (id: string) => {
    updateMutation.mutate({ id, status: 'rejected', reviewedAt: new Date() });
  };

  return (
    <div className="flex-1 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">KYC Manager</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student Verification Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : records && records.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Institution</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id} data-testid={`row-kyc-${record.id}`}>
                      <TableCell className="font-medium">{record.fullName}</TableCell>
                      <TableCell>{record.institution || '-'}</TableCell>
                      <TableCell className="font-mono">{record.studentId || '-'}</TableCell>
                      <TableCell>
                        {record.documentUrl ? (
                          <a 
                            href={record.documentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            View Document
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            record.status === 'approved' ? 'default' :
                            record.status === 'rejected' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(record.id)}
                              disabled={updateMutation.isPending}
                              data-testid={`button-approve-${record.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(record.id)}
                              disabled={updateMutation.isPending}
                              data-testid={`button-reject-${record.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16">
                <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No KYC Records</h3>
                <p className="text-sm text-muted-foreground">
                  No student verification requests at this time.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
