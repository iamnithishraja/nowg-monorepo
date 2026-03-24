import { UserRole } from "@nowgai/shared/types";
import { useCallback, useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { AdminLayout } from "~/components/AdminLayout";
import { auth } from "~/lib/auth";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { SpinnerGap } from "@phosphor-icons/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });
  if (!session) throw redirect("/");
  return { user: session.user };
}

export function meta() {
  return [
    { title: "Support Tickets - Admin - Nowgai" },
    { name: "description", content: "Manage user support tickets" },
  ];
}

interface SupportTicket {
  id: string;
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

const shortId = (id: string) => `#${String(id).slice(-8).toUpperCase()}`;

export default function AdminSupportTickets() {
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const isFullAdmin =
    userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/support-tickets");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (err) {
      console.error("Error fetching tickets:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFullAdmin) fetchTickets();
  }, [isFullAdmin, fetchTickets]);

  const handleResolve = async () => {
    if (!selectedTicket) return;
    setIsResolving(true);
    try {
      const res = await fetch("/api/admin/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          ticketId: selectedTicket.id,
          adminNotes: adminNotes.trim(),
        }),
      });
      if (res.ok) {
        await fetchTickets();
        setSelectedTicket(null);
        setAdminNotes("");
      }
    } catch (err) {
      console.error("Error resolving ticket:", err);
    } finally {
      setIsResolving(false);
    }
  };

  const openTickets = tickets.filter((t) => t.status === "open");
  const resolvedTickets = tickets.filter((t) => t.status === "resolved");

  if (!isFullAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-white/50">Only super admins can view support tickets.</p>
        </div>
      </AdminLayout>
    );
  }

  const TicketTable = ({
    ticketList,
    showResolve,
  }: {
    ticketList: SupportTicket[];
    showResolve: boolean;
  }) => {
    if (ticketList.length === 0) {
      return (
        <div className="text-center py-12 text-white/40">No tickets in this category</div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow className="border-white/10">
            <TableHead className="text-white/50">Ticket ID</TableHead>
            <TableHead className="text-white/50">User</TableHead>
            <TableHead className="text-white/50">Subject</TableHead>
            <TableHead className="text-white/50">Company</TableHead>
            <TableHead className="text-white/50">Date</TableHead>
            <TableHead className="text-white/50">Status</TableHead>
            {showResolve && <TableHead className="text-right text-white/50">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ticketList.map((ticket) => (
            <TableRow key={ticket.id} className="border-white/10">
              <TableCell>
                <span className="font-mono text-xs text-white/40">{shortId(ticket.id)}</span>
              </TableCell>
              <TableCell>
                <div>
                  <p className="text-sm font-medium text-white">
                    {ticket.userName || ticket.userEmail}
                  </p>
                  <p className="text-xs text-white/50">{ticket.userEmail}</p>
                  {ticket.phone && (
                    <p className="text-xs text-white/40">
                      {ticket.countryCode} {ticket.phone}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="max-w-xs">
                  <p className="text-sm font-medium text-white">{ticket.subject}</p>
                  <p className="text-xs text-white/50 line-clamp-2 mt-0.5">{ticket.message}</p>
                </div>
              </TableCell>
              <TableCell className="text-sm text-white/70">
                {ticket.company || "—"}
              </TableCell>
              <TableCell className="text-xs text-white/50 whitespace-nowrap">
                {formatDate(ticket.createdAt)}
              </TableCell>
              <TableCell>
                {ticket.status === "open" ? (
                  <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    Open
                  </Badge>
                ) : (
                  <div className="space-y-0.5">
                    <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
                      Resolved
                    </Badge>
                    {ticket.resolvedAt && (
                      <p className="text-xs text-white/40">{formatDate(ticket.resolvedAt)}</p>
                    )}
                  </div>
                )}
              </TableCell>
              {showResolve && (
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setAdminNotes("");
                    }}
                  >
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
    <AdminLayout>
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
            <p className="text-white/50 text-sm mt-1">
              View and resolve user support requests
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Open", count: openTickets.length, color: "text-orange-400" },
              { label: "Resolved", count: resolvedTickets.length, color: "text-green-400" },
              { label: "Total", count: tickets.length, color: "text-blue-400" },
            ].map(({ label, count, color }) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
                <p className="text-white/50 text-sm">{label} Tickets</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <SpinnerGap className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : (
            <Tabs defaultValue="open">
              <TabsList className="bg-white/5 border border-white/10">
                <TabsTrigger value="open">
                  Open
                  {openTickets.length > 0 && (
                    <span className="ml-2 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5 leading-none">
                      {openTickets.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
                <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
              </TabsList>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <TabsContent value="open" className="m-0">
                  <TicketTable ticketList={openTickets} showResolve={true} />
                </TabsContent>
                <TabsContent value="resolved" className="m-0">
                  <TicketTable ticketList={resolvedTickets} showResolve={false} />
                </TabsContent>
                <TabsContent value="all" className="m-0">
                  <TicketTable ticketList={tickets} showResolve={false} />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </div>

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
        <DialogContent className="bg-[#1a1a1a] border-white/10 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              Mark Ticket as Resolved
              <span className="text-sm font-mono text-white/40">
                {selectedTicket ? shortId(selectedTicket.id) : ""}
              </span>
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {selectedTicket?.subject}
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2 text-sm">
                <div>
                  <span className="text-white/40 text-xs uppercase tracking-wide font-medium">From</span>
                  <p className="font-medium text-white">{selectedTicket.userName || selectedTicket.userEmail}</p>
                  <p className="text-white/50 text-xs">{selectedTicket.userEmail}</p>
                </div>
                <div>
                  <span className="text-white/40 text-xs uppercase tracking-wide font-medium">Message</span>
                  <p className="text-white/80 text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="admin-notes" className="text-white/70">
                  Admin Notes (Optional)
                </Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about the resolution..."
                  className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setSelectedTicket(null); setAdminNotes(""); }}
              disabled={isResolving}
              className="border-white/10 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={isResolving}
              className="bg-purple-500 hover:bg-purple-600 text-white"
            >
              {isResolving ? (
                <>
                  <SpinnerGap className="w-4 h-4 mr-2 animate-spin" />
                  Resolving...
                </>
              ) : (
                "Mark as Resolved"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
