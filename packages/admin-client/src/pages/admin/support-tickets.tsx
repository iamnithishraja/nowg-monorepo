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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCircle2,
  Clock,
  Headphones,
  Mail,
  MessageSquare,
  Phone,
  Building2,
} from "lucide-react";
import { useState } from "react";

interface SupportTicket {
  id: string;
  requestId: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  phone: string;
  countryCode: string;
  company: string;
  status: "open" | "resolved";
  resolvedAt: string | null;
  resolvedBy: string | null;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketsResponse {
  tickets: SupportTicket[];
}

interface CallRequest {
  id: string;
  requestId: string;
  ticketId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  phone: string;
  countryCode: string;
  status: "open" | "resolved";
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CallsResponse {
  calls: CallRequest[];
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

const shortId = (ticket: SupportTicket) => {
  if (ticket.requestId) return `#${ticket.requestId}`;
  return `#${String(ticket.id).slice(-8).toUpperCase()}`;
};

export default function SupportTicketsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null
  );
  const [viewTicket, setViewTicket] = useState<SupportTicket | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const userRole = (user as any)?.role;
  const isFullAdmin =
    userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;

  // Fetch all tickets
  const { data: ticketsData, isLoading } = useQuery<TicketsResponse>({
    queryKey: ["/api/admin/support-tickets"],
    queryFn: async () => {
      return client.get<TicketsResponse>("/api/admin/support-tickets");
    },
    refetchInterval: 30000,
    enabled: isFullAdmin,
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      return client.post(`/api/admin/support-tickets/${ticketId}/resolve`, {
        adminNotes: adminNotes.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/support-tickets"],
      });
      toast({
        title: "Ticket Resolved",
        description: "The support ticket has been marked as resolved.",
      });
      setSelectedTicket(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to resolve ticket",
        variant: "destructive",
      });
    },
  });

  const handleResolve = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setAdminNotes("");
  };

  // Fetch all calls
  const { data: callsData, isLoading: callsLoading } = useQuery<CallsResponse>({
    queryKey: ["/api/admin/support-tickets/calls"],
    queryFn: async () => {
      return client.get<CallsResponse>("/api/admin/support-tickets/calls");
    },
    refetchInterval: 30000,
    enabled: isFullAdmin,
  });

  // Resolve Call mutation
  const resolveCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      return client.post(`/api/admin/support-tickets/calls/${callId}/resolve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/support-tickets/calls"],
      });
      toast({
        title: "Call Resolved",
        description: "The call request has been marked as resolved.",
      });
      setSelectedCall(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to resolve call",
        variant: "destructive",
      });
    },
  });

  const handleResolveCall = (call: CallRequest) => {
    setSelectedCall(call);
  };

  const allTickets = ticketsData?.tickets || [];
  const openTickets = allTickets.filter((t) => t.status === "open");
  const resolvedTickets = allTickets.filter((t) => t.status === "resolved");

  const allCalls = callsData?.calls || [];
  const openCalls = allCalls.filter((c) => c.status === "open");

  if (!isFullAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              You don't have permission to view support tickets. Only super
              admins can manage support tickets.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderCallsTable = (calls: CallRequest[]) => {
    if (calls.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No call requests</p>
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Req ID</TableHead>
            <TableHead>User / Phone</TableHead>
            <TableHead>Ticket ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id} className="hover:bg-muted/30">
              <TableCell className="font-mono text-xs text-muted-foreground">#{call.requestId || String(call.id).slice(-8).toUpperCase()}</TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{call.userEmail}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {call.countryCode} {call.phone}
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">#{call.ticketId}</TableCell>
              <TableCell>
                {call.status === "open" ? (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30">Open</Badge>
                ) : (
                  <Badge variant="default" className="bg-green-600">Resolved</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(call.createdAt)}</TableCell>
              <TableCell className="text-right">
                {call.status === "open" && (
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleResolveCall(call); }}
                    disabled={resolveCallMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Resolve Call
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderTicketsTable = (tickets: SupportTicket[], showActions: boolean) => {
    if (tickets.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No tickets in this category</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket ID</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow 
              key={ticket.id} 
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => setViewTicket(ticket)}
            >
              {/* Ticket ID */}
              <TableCell>
                <span className="font-mono text-xs text-muted-foreground">
                  {shortId(ticket)}
                </span>
              </TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">
                    {ticket.userName || ticket.userEmail}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {ticket.userEmail}
                  </div>
                  {ticket.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {ticket.countryCode} {ticket.phone}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <p className="font-medium text-sm max-w-[250px] truncate" title={ticket.subject}>{ticket.subject}</p>
              </TableCell>
              <TableCell>
                {ticket.company ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {ticket.company}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {formatDate(ticket.createdAt)}
              </TableCell>
              <TableCell>
                {ticket.status === "open" ? (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                    <Clock className="h-3 w-3 mr-1" />
                    Open
                  </Badge>
                ) : (
                  <div className="space-y-1">
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Resolved
                    </Badge>
                    {ticket.resolvedAt && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(ticket.resolvedAt)}
                      </p>
                    )}
                  </div>
                )}
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleResolve(ticket); }}
                    disabled={resolveMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Mark Resolved
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Headphones className="h-8 w-8" />
          Support Tickets
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage and resolve user support requests
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openTickets.length}</p>
              <p className="text-sm text-muted-foreground">Open Tickets</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resolvedTickets.length}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{allTickets.length}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Tabs */}
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">
            Open
            {openTickets.length > 0 && (
              <span className="ml-2 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5 leading-none">
                {openTickets.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="calls">
            Calls
            {openCalls.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5 leading-none">
                {openCalls.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-orange-500" />
                Open Tickets ({openTickets.length})
              </CardTitle>
              <CardDescription>
                These tickets are awaiting resolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                renderTicketsTable(openTickets, true)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolved" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Resolved Tickets ({resolvedTickets.length})
              </CardTitle>
              <CardDescription>
                Tickets that have been marked as resolved
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                renderTicketsTable(resolvedTickets, false)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                All Tickets ({allTickets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                renderTicketsTable(allTickets, false)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-red-500" />
                Call Requests ({allCalls.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                renderCallsTable(allCalls)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resolve Dialog */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicket(null);
            setAdminNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Mark Ticket as Resolved
              <span className="text-sm font-mono text-muted-foreground">
                {selectedTicket ? shortId(selectedTicket) : ""}
              </span>
            </DialogTitle>
            <DialogDescription>
              {selectedTicket?.subject}
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              {/* Ticket details */}
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">From</span>
                  <p className="font-medium">{selectedTicket.userName || selectedTicket.userEmail}</p>
                  <p className="text-muted-foreground text-xs">{selectedTicket.userEmail}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Message</span>
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <Label htmlFor="admin-notes">
                  Admin Notes (Optional)
                </Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any notes about the resolution..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTicket(null);
                setAdminNotes("");
              }}
              disabled={resolveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedTicket && resolveMutation.mutate(selectedTicket.id)}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Call Dialog */}
      <Dialog
        open={!!selectedCall}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCall(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Call Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this call request as resolved? The user will be notified via email that the call has been resolved.
            </DialogDescription>
          </DialogHeader>
          {selectedCall && (
            <div className="py-4">
              <p>User: {selectedCall.userEmail}</p>
              <p>Phone: {selectedCall.countryCode} {selectedCall.phone}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedCall(null)}
              disabled={resolveCallMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedCall && resolveCallMutation.mutate(selectedCall.id)}
              disabled={resolveCallMutation.isPending}
            >
              {resolveCallMutation.isPending ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Ticket Details Dialog */}
      <Dialog
        open={!!viewTicket}
        onOpenChange={(open) => {
          if (!open) setViewTicket(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket Details</DialogTitle>
            <DialogDescription>
              View full information about this support request
            </DialogDescription>
          </DialogHeader>

          {viewTicket && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
                  {viewTicket.status === "open" ? (
                    <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                      Open
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-green-600">
                      Resolved
                    </Badge>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Ticket ID</h4>
                  <p className="text-sm font-mono">{shortId(viewTicket)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">User</h4>
                  <p className="text-sm font-medium">{viewTicket.userName || viewTicket.userEmail}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3" />
                    {viewTicket.userEmail}
                  </p>
                  {viewTicket.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" />
                      {viewTicket.countryCode} {viewTicket.phone}
                    </p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Submitted</h4>
                  <p className="text-sm">{formatDate(viewTicket.createdAt)}</p>
                </div>
                {viewTicket.company && (
                  <div className="col-span-2">
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Company</h4>
                    <p className="text-sm flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" /> 
                      {viewTicket.company}
                    </p>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 bg-muted/10">
                <h4 className="font-semibold text-lg mb-2">{viewTicket.subject}</h4>
                <div className="text-sm whitespace-pre-wrap">{viewTicket.message}</div>
              </div>

              {viewTicket.status === "resolved" && (
                <div className="border-l-4 border-green-500 pl-4 py-1">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Resolution Info</h4>
                  {viewTicket.resolvedAt && (
                    <p className="text-xs text-muted-foreground mb-2">Resolved at {formatDate(viewTicket.resolvedAt)}</p>
                  )}
                  {viewTicket.adminNotes && (
                    <>
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Admin Notes</h5>
                      <p className="text-sm whitespace-pre-wrap">{viewTicket.adminNotes}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {viewTicket?.status === "open" && (
              <Button 
                onClick={() => { 
                  handleResolve(viewTicket); 
                  setViewTicket(null); 
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Resolve Ticket
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewTicket(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
