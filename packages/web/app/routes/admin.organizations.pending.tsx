import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Globe,
  Briefcase,
  FileText,
  Mail,
  Phone,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { AdminLayout } from "../components/AdminLayout";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { adminClient } from "../lib/adminClient";
import { auth } from "../lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

interface PendingOrganization {
  id: string;
  name: string;
  description: string;
  planType: string;
  approvalStatus: string;
  companySize: string | null;
  industry: string | null;
  website: string | null;
  useCase: string | null;
  contactPhone: string | null;
  allowedDomains: string[];
  orgAdmin: {
    id: string;
    email: string;
    name: string;
  } | null;
  createdAt: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  // Only allow admin and tech_support roles
  const userRole = (session.user as any)?.role;
  if (userRole !== "admin" && userRole !== "tech_support") {
    throw redirect("/admin");
  }

  return { user: session.user };
}

export function meta() {
  return [
    { title: "Pending Organizations - Admin - Nowgai" },
    { name: "description", content: "Review pending enterprise organization requests" },
  ];
}

export default function AdminPendingOrganizations() {
  const [organizations, setOrganizations] = useState<PendingOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<PendingOrganization | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const fetchPendingOrganizations = async () => {
    try {
      setIsLoading(true);
      const data = await adminClient.get<{ organizations: PendingOrganization[] }>(
        "/api/admin/organizations/pending"
      );
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error("Failed to fetch pending organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingOrganizations();
  }, []);

  const filteredOrganizations = organizations.filter((org) =>
    org.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.orgAdmin?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApprove = async () => {
    if (!selectedOrg) return;
    
    setIsProcessing(true);
    try {
      await adminClient.post(`/api/admin/organizations/${selectedOrg.id}/approve`, {});
      await fetchPendingOrganizations();
      setShowApproveDialog(false);
      setSelectedOrg(null);
    } catch (error) {
      console.error("Failed to approve organization:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedOrg) return;
    
    setIsProcessing(true);
    try {
      await adminClient.post(`/api/admin/organizations/${selectedOrg.id}/reject`, {
        reason: rejectReason,
      });
      await fetchPendingOrganizations();
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedOrg(null);
    } catch (error) {
      console.error("Failed to reject organization:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-[6px] bg-amber-500/10">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-primary">
                  Pending Enterprise Requests
                </h1>
                <p className="text-secondary text-sm mt-0.5">
                  Review and approve enterprise organization requests
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64 bg-surface-1 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff]"
                />
              </div>
              <Button
                onClick={() => fetchPendingOrganizations()}
                size="sm"
                variant="outline"
                disabled={isLoading}
                className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#7b4cff] transition-colors"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-surface-1 border-subtle">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{organizations.length}</p>
                    <p className="text-sm text-secondary">Pending Requests</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="rounded-[12px] bg-surface-1 border border-subtle">
              <Card className="bg-transparent border-0 shadow-none">
                <CardHeader className="border-b border-subtle px-5 py-3">
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-subtle hover:bg-transparent">
                        <TableHead className="text-secondary">Organization</TableHead>
                        <TableHead className="text-secondary">Requester</TableHead>
                        <TableHead className="text-secondary">Company Size</TableHead>
                        <TableHead className="text-secondary">Submitted</TableHead>
                        <TableHead className="text-secondary">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(3)].map((_, i) => (
                        <TableRow key={i} className="border-b border-subtle">
                          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="rounded-[12px] bg-surface-1 border border-subtle">
              <Card className="bg-transparent border-0 shadow-none">
                <CardContent className="py-16">
                  <div className="text-center">
                    <div className="p-4 rounded-full bg-[#7b4cff]/10 w-fit mx-auto mb-4">
                      <CheckCircle2 className="h-12 w-12 text-[#7b4cff]" />
                    </div>
                    <h3 className="text-lg font-medium text-primary mb-2">
                      No Pending Requests
                    </h3>
                    <p className="text-secondary">
                      All enterprise organization requests have been processed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-[12px] bg-surface-1 border border-subtle">
              <Card className="bg-transparent border-0 shadow-none">
                <CardHeader className="border-b border-subtle px-5 py-3">
                  <CardTitle className="text-primary text-lg font-medium">
                    Pending Requests ({filteredOrganizations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-subtle hover:bg-transparent">
                        <TableHead className="text-secondary">Organization</TableHead>
                        <TableHead className="text-secondary">Requester</TableHead>
                        <TableHead className="text-secondary">Company Size</TableHead>
                        <TableHead className="text-secondary">Industry</TableHead>
                        <TableHead className="text-secondary">Submitted</TableHead>
                        <TableHead className="text-secondary text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrganizations.map((org) => (
                        <TableRow
                          key={org.id}
                          className="border-b border-subtle hover:bg-surface-2"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-[#7b4cff]/10">
                                <Building2 className="h-4 w-4 text-[#7b4cff]" />
                              </div>
                              <div>
                                <p className="font-medium text-primary">{org.name}</p>
                                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs mt-1">
                                  Enterprise
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-primary">{org.orgAdmin?.name || "Unknown"}</p>
                              <p className="text-xs text-tertiary">{org.orgAdmin?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-primary">{org.companySize || "N/A"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-primary">{org.industry || "N/A"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-tertiary text-sm">
                              {formatDate(org.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setShowDetailsDialog(true);
                                }}
                                className="bg-surface-2 border-subtle text-primary hover:bg-subtle"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setShowApproveDialog(true);
                                }}
                                className="bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setShowRejectDialog(true);
                                }}
                                className="bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-surface-1 border-subtle max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#7b4cff]" />
              {selectedOrg?.name}
            </DialogTitle>
            <DialogDescription className="text-secondary">
              Enterprise organization request details
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrg && (
            <div className="space-y-6 py-4">
              {/* Organization Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-tertiary text-xs uppercase">Organization Name</Label>
                  <p className="text-primary font-medium">{selectedOrg.name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-tertiary text-xs uppercase">Plan Type</Label>
                  <Badge className="bg-[#7b4cff]/20 text-[#a78bfa] border-[#7b4cff]/30">
                    {selectedOrg.planType}
                  </Badge>
                </div>
              </div>

              {selectedOrg.description && (
                <div className="space-y-1">
                  <Label className="text-tertiary text-xs uppercase">Description</Label>
                  <p className="text-primary">{selectedOrg.description}</p>
                </div>
              )}

              {/* Requester Info */}
              <div className="rounded-lg bg-surface-2 border border-subtle p-4 space-y-3">
                <h4 className="font-medium text-primary flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#7b4cff]" />
                  Requester Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-tertiary text-xs uppercase">Name</Label>
                    <p className="text-primary">{selectedOrg.orgAdmin?.name || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-tertiary text-xs uppercase">Email</Label>
                    <p className="text-primary">{selectedOrg.orgAdmin?.email || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="rounded-lg bg-surface-2 border border-subtle p-4 space-y-3">
                <h4 className="font-medium text-primary flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-[#7b4cff]" />
                  Company Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-tertiary text-xs uppercase flex items-center gap-1">
                      <Users className="h-3 w-3" /> Company Size
                    </Label>
                    <p className="text-primary">{selectedOrg.companySize || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-tertiary text-xs uppercase">Industry</Label>
                    <p className="text-primary">{selectedOrg.industry || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-tertiary text-xs uppercase flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Website
                    </Label>
                    {selectedOrg.website ? (
                      <a
                        href={selectedOrg.website.startsWith("http") ? selectedOrg.website : `https://${selectedOrg.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7b4cff] hover:underline flex items-center gap-1"
                      >
                        {selectedOrg.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="text-primary">N/A</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-tertiary text-xs uppercase flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Contact Phone
                    </Label>
                    <p className="text-primary">{selectedOrg.contactPhone || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Use Case */}
              {selectedOrg.useCase && (
                <div className="rounded-lg bg-[#7b4cff]/5 border border-[#7b4cff]/20 p-4 space-y-2">
                  <h4 className="font-medium text-primary flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#7b4cff]" />
                    Use Case
                  </h4>
                  <p className="text-secondary italic">"{selectedOrg.useCase}"</p>
                </div>
              )}

              {/* Allowed Domains */}
              {selectedOrg.allowedDomains && selectedOrg.allowedDomains.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-tertiary text-xs uppercase">Allowed Domains</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrg.allowedDomains.map((domain, idx) => (
                      <Badge key={idx} variant="outline" className="bg-surface-2 text-primary border-subtle">
                        {domain}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Submitted Date */}
              <div className="space-y-1">
                <Label className="text-tertiary text-xs uppercase">Submitted</Label>
                <p className="text-primary">{formatDate(selectedOrg.createdAt)}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDetailsDialog(false)}
              className="bg-surface-2 border-subtle text-primary hover:bg-subtle"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setShowDetailsDialog(false);
                setShowApproveDialog(true);
              }}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              onClick={() => {
                setShowDetailsDialog(false);
                setShowRejectDialog(true);
              }}
              variant="destructive"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-surface-1 border-subtle">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Approve Organization
            </DialogTitle>
            <DialogDescription className="text-secondary">
              Are you sure you want to approve this enterprise organization request?
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrg && (
            <div className="py-4">
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                <p className="text-primary font-medium">{selectedOrg.name}</p>
                <p className="text-sm text-secondary mt-1">
                  Requested by: {selectedOrg.orgAdmin?.email}
                </p>
              </div>
              <p className="text-sm text-secondary mt-4">
                The requester will receive an email notification and gain full access to Enterprise features.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={isProcessing}
              className="bg-surface-2 border-subtle text-primary hover:bg-subtle"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isProcessing}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-surface-1 border-subtle">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Reject Organization
            </DialogTitle>
            <DialogDescription className="text-secondary">
              Please provide a reason for rejecting this request (optional).
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrg && (
            <div className="py-4 space-y-4">
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-primary font-medium">{selectedOrg.name}</p>
                <p className="text-sm text-secondary mt-1">
                  Requested by: {selectedOrg.orgAdmin?.email}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rejectReason" className="text-primary">
                  Reason for Rejection (Optional)
                </Label>
                <Textarea
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a reason that will be shared with the requester..."
                  className="bg-surface-2 border-subtle text-primary placeholder:text-tertiary"
                  rows={3}
                />
              </div>
              
              <p className="text-sm text-secondary">
                The requester will receive an email notification about this decision.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason("");
              }}
              disabled={isProcessing}
              className="bg-surface-2 border-subtle text-primary hover:bg-subtle"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
