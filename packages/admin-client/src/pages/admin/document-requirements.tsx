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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { client } from "@/lib/client";
import { UserRole } from "@nowgai/shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  isMandatory: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RequirementsResponse {
  requirements: DocumentRequirement[];
}

interface RequirementForm {
  name: string;
  description: string;
  isMandatory: boolean;
  isActive: boolean;
}

const emptyForm: RequirementForm = {
  name: "",
  description: "",
  isMandatory: true,
  isActive: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(dateString));

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentRequirementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<DocumentRequirement | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState<RequirementForm>(emptyForm);

  const userRole = (user as any)?.role;
  const isFullAdmin = userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;

  // ── Queries & Mutations ──────────────────────────────────────────────────

  const { data: requirementsData, isLoading } = useQuery<RequirementsResponse>({
    queryKey: ["/api/admin/org-document-requirements"],
    queryFn: () => client.get<RequirementsResponse>("/api/admin/org-document-requirements"),
    enabled: isFullAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: RequirementForm) => client.post("/api/admin/org-document-requirements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/org-document-requirements"] });
      toast({ title: "Requirement Created", description: "The document requirement has been created." });
      closeDialog();
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to create requirement", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RequirementForm> }) =>
      client.put(`/api/admin/org-document-requirements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/org-document-requirements"] });
      toast({ title: "Requirement Updated", description: "The document requirement has been updated." });
      closeDialog();
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to update requirement", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.delete(`/api/admin/org-document-requirements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/org-document-requirements"] });
      toast({ title: "Requirement Deleted", description: "The document requirement has been deleted." });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to delete requirement", variant: "destructive" }),
  });

  // ── Dialog helpers ───────────────────────────────────────────────────────

  const openCreateDialog = () => { setEditingReq(null); setForm(emptyForm); setIsDialogOpen(true); };

  const openEditDialog = (req: DocumentRequirement) => {
    setEditingReq(req);
    setForm({ name: req.name, description: req.description, isMandatory: req.isMandatory, isActive: req.isActive });
    setIsDialogOpen(true);
  };

  const closeDialog = () => { setIsDialogOpen(false); setEditingReq(null); setForm(emptyForm); };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: "Validation Error", description: "Name is required.", variant: "destructive" });
      return;
    }
    if (editingReq) updateMutation.mutate({ id: editingReq.id, data: form });
    else createMutation.mutate(form);
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const requirements = requirementsData?.requirements || [];
  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ── Guard ────────────────────────────────────────────────────────────────

  if (!isFullAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card><CardContent className="p-6"><p className="text-muted-foreground">Only super admins can manage document requirements.</p></CardContent></Card>
      </div>
    );
  }

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Document Requirements
          </h1>
          <p className="text-muted-foreground mt-1">Manage documents required for enterprise organization requests</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2"><Plus className="h-4 w-4" />Add Requirement</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Requirements", value: requirements.length, color: "blue" },
          { label: "Mandatory", value: requirements.filter(r => r.isMandatory).length, color: "red" },
          { label: "Active", value: requirements.filter(r => r.isActive).length, color: "green" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full bg-${color}-100 dark:bg-${color}-950/40 flex items-center justify-center flex-shrink-0`}>
                <BookOpen className={`h-5 w-5 text-${color}-600`} />
              </div>
              <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Requirements List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading requirements...</div>
      ) : requirements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No document requirements configured</p>
            <Button onClick={openCreateDialog} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" />Create your first requirement</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requirements.map((req) => (
            <Card key={req.id} className={!req.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg leading-tight">{req.name}</CardTitle>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(req)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(req.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 min-h-[40px] mt-2">
                  {req.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant={req.isMandatory ? "destructive" : "secondary"}>
                    {req.isMandatory ? "Mandatory" : "Optional"}
                  </Badge>
                  <Badge variant={req.isActive ? "default" : "outline"} className={req.isActive ? "bg-green-600" : ""}>
                    {req.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-4">
                  Added on {formatDate(req.createdAt)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={open => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingReq ? "Edit Requirement" : "Add Requirement"}</DialogTitle>
            <DialogDescription>
              {editingReq ? "Update document requirement details." : "Specify a new document required for enterprise applications."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-4">
            {/* Name */}
            <div>
              <Label htmlFor="req-name">Document Name <span className="text-destructive">*</span></Label>
              <Input id="req-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Business License" className="mt-1.5" />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="req-desc">Description</Label>
              <Textarea id="req-desc" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Provide details about what this document needs to contain..." rows={3} className="mt-1.5" />
            </div>

            {/* Mandatory toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><p className="text-sm font-medium">Mandatory</p><p className="text-xs text-muted-foreground">Must be uploaded to approve request</p></div>
              <Switch checked={form.isMandatory} onCheckedChange={checked => setForm(p => ({ ...p, isMandatory: checked }))} />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted-foreground">Visible to users in the upgrade form</p></div>
              <Switch checked={form.isActive} onCheckedChange={checked => setForm(p => ({ ...p, isActive: checked }))} />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-2">
            <Button variant="outline" onClick={closeDialog} disabled={isMutating}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isMutating}>
              {isMutating ? (editingReq ? "Saving..." : "Creating...") : editingReq ? "Save Changes" : "Create Requirement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={open => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Requirement</DialogTitle>
            <DialogDescription>Are you sure you want to delete this requirement? Users will no longer see it.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
