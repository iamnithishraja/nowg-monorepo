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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { client } from "@/lib/client";
import { UserRole } from "@nowgai/shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Film,
  HelpCircle,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FaqMedia {
  url: string;          // base64 data URL or remote URL
  type: "image" | "video";
  name: string;
}

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
  media: FaqMedia[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface FaqsResponse {
  faqs: Faq[];
}

interface FaqForm {
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
  media: FaqMedia[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ["General", "Account", "Billing", "Technical", "Features", "Other"];

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/mov", "video/quicktime"];
const MAX_FILE_SIZE_MB = 20;

const emptyForm: FaqForm = {
  question: "",
  answer: "",
  category: "General",
  order: 0,
  isPublished: true,
  media: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(dateString));

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Media Preview Strip ──────────────────────────────────────────────────────

function MediaStrip({ items, onRemove }: { items: FaqMedia[]; onRemove?: (i: number) => void }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {items.map((m, i) => (
        <div key={i} className="relative group rounded-lg overflow-hidden border border-border bg-muted/30 flex-shrink-0"
          style={{ width: 120, height: 90 }}>
          {m.type === "image" ? (
            <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
          ) : (
            <video src={m.url} className="w-full h-full object-cover" muted playsInline />
          )}
          {/* type badge */}
          <div className="absolute bottom-1 left-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white flex items-center gap-1">
              {m.type === "image" ? <ImageIcon className="w-3 h-3" /> : <Film className="w-3 h-3" />}
              {m.type}
            </span>
          </div>
          {/* remove button (only when onRemove provided) */}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FaqsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FaqForm>(emptyForm);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const userRole = (user as any)?.role;
  const isFullAdmin = userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;

  // ── Queries & Mutations ──────────────────────────────────────────────────

  const { data: faqsData, isLoading } = useQuery<FaqsResponse>({
    queryKey: ["/api/admin/faqs"],
    queryFn: () => client.get<FaqsResponse>("/api/admin/faqs"),
    enabled: isFullAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: FaqForm) => client.post("/api/admin/faqs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/faqs"] });
      toast({ title: "FAQ Created", description: "The FAQ has been created." });
      closeDialog();
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to create FAQ", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FaqForm> }) =>
      client.put(`/api/admin/faqs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/faqs"] });
      toast({ title: "FAQ Updated", description: "The FAQ has been updated." });
      closeDialog();
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to update FAQ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (faqId: string) => client.delete(`/api/admin/faqs/${faqId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/faqs"] });
      toast({ title: "FAQ Deleted", description: "The FAQ has been deleted." });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to delete FAQ", variant: "destructive" }),
  });

  // ── Dialog helpers ───────────────────────────────────────────────────────

  const openCreateDialog = () => { setEditingFaq(null); setForm(emptyForm); setIsDialogOpen(true); };

  const openEditDialog = (faq: Faq) => {
    setEditingFaq(faq);
    setForm({ question: faq.question, answer: faq.answer, category: faq.category || "General", order: faq.order, isPublished: faq.isPublished, media: faq.media || [] });
    setIsDialogOpen(true);
  };

  const closeDialog = () => { setIsDialogOpen(false); setEditingFaq(null); setForm(emptyForm); };

  const handleSubmit = () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast({ title: "Validation Error", description: "Question and answer are required.", variant: "destructive" });
      return;
    }
    if (editingFaq) updateMutation.mutate({ id: editingFaq.id, data: form });
    else createMutation.mutate(form);
  };

  // ── Media Upload ─────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const oversized = files.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      toast({ title: "File Too Large", description: `Files must be under ${MAX_FILE_SIZE_MB}MB. Remove: ${oversized.map(f => f.name).join(", ")}`, variant: "destructive" });
      return;
    }

    setUploadingMedia(true);
    try {
      const newMedia: FaqMedia[] = await Promise.all(
        files.map(async (file) => {
          const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
          const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);
          if (!isImage && !isVideo) throw new Error(`Unsupported file type: ${file.type}`);
          const url = await fileToBase64(file);
          return { url, type: isImage ? "image" : "video" as "image" | "video", name: file.name };
        })
      );
      setForm(prev => ({ ...prev, media: [...prev.media, ...newMedia] }));
      toast({ title: "Media Added", description: `${newMedia.length} file(s) added.` });
    } catch (err: any) {
      toast({ title: "Upload Error", description: err?.message || "Failed to process files.", variant: "destructive" });
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeMedia = (index: number) => {
    setForm(prev => ({ ...prev, media: prev.media.filter((_, i) => i !== index) }));
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const toggleExpand = (id: string) => setExpandedFaqs(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const faqs = faqsData?.faqs || [];
  const grouped = faqs.reduce((acc, faq) => {
    const cat = faq.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {} as Record<string, Faq[]>);

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ── Guard ────────────────────────────────────────────────────────────────

  if (!isFullAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card><CardContent className="p-6"><p className="text-muted-foreground">Only super admins can manage FAQs.</p></CardContent></Card>
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
            <HelpCircle className="h-8 w-8" />FAQs
          </h1>
          <p className="text-muted-foreground mt-1">Manage frequently asked questions shown to users</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2"><Plus className="h-4 w-4" />Add FAQ</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total FAQs", value: faqs.length, color: "blue" },
          { label: "Published", value: faqs.filter(f => f.isPublished).length, color: "green" },
          { label: "Categories", value: Object.keys(grouped).length, color: "orange" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full bg-${color}-100 dark:bg-${color}-950/40 flex items-center justify-center flex-shrink-0`}>
                <HelpCircle className={`h-5 w-5 text-${color}-600`} />
              </div>
              <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQs List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading FAQs...</div>
      ) : faqs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HelpCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No FAQs yet</p>
            <Button onClick={openCreateDialog} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" />Create your first FAQ</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryFaqs]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{category}</span><Badge variant="secondary">{categoryFaqs.length}</Badge>
                </CardTitle>
                <CardDescription>{categoryFaqs.filter(f => f.isPublished).length} published</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {categoryFaqs.map((faq) => {
                  const isExpanded = expandedFaqs.has(faq.id);
                  return (
                    <div key={faq.id} className="border rounded-lg overflow-hidden">
                      {/* Question row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button className="flex-1 text-left flex items-center gap-2" onClick={() => toggleExpand(faq.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                          <span className="font-medium text-sm">{faq.question}</span>
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {faq.media?.length > 0 && (
                            <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                              <ImageIcon className="h-3 w-3" />{faq.media.length}
                            </span>
                          )}
                          <Badge variant={faq.isPublished ? "default" : "secondary"} className={faq.isPublished ? "bg-green-600 text-xs" : "text-xs"}>
                            {faq.isPublished ? "Published" : "Draft"}
                          </Badge>
                          <span className="text-xs text-muted-foreground hidden sm:inline">#{faq.order}</span>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(faq)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(faq.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                      {/* Answer (Expanded) */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-3">{faq.answer}</p>
                          {/* Media strip in list view */}
                          <MediaStrip items={faq.media || []} />
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
                            <span>Created {formatDate(faq.createdAt)}</span>
                            {faq.createdBy && <span>by {faq.createdBy}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={open => !open && closeDialog()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingFaq ? "Edit FAQ" : "Create New FAQ"}</DialogTitle>
            <DialogDescription>
              {editingFaq ? "Update this frequently asked question." : "Add a new frequently asked question for users."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Question */}
            <div>
              <Label htmlFor="faq-question">Question <span className="text-destructive">*</span></Label>
              <Input id="faq-question" value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} placeholder="What is...?" className="mt-1.5" />
            </div>

            {/* Answer */}
            <div>
              <Label htmlFor="faq-answer">Answer <span className="text-destructive">*</span></Label>
              <Textarea id="faq-answer" value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} placeholder="The answer to the question..." rows={4} className="mt-1.5" />
            </div>

            {/* Category + Order */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="faq-category">Category</Label>
                <Select value={form.category} onValueChange={val => setForm(p => ({ ...p, category: val }))}>
                  <SelectTrigger id="faq-category" className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="faq-order">Display Order</Label>
                <Input id="faq-order" type="number" value={form.order} onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))} className="mt-1.5" min={0} />
              </div>
            </div>

            {/* Media Upload */}
            <div>
              <Label>Media Attachments</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Attach images or videos that appear alongside the answer. Max {MAX_FILE_SIZE_MB}MB per file.
              </p>

              {/* Drop zone / file picker */}
              <div
                className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload images or videos</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF, WebP, SVG · MP4, WebM, OGG · Up to {MAX_FILE_SIZE_MB}MB each
                </p>
                {uploadingMedia && <p className="text-xs text-primary mt-2 animate-pulse">Processing files…</p>}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(",")}
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Current media preview with remove buttons */}
              {form.media.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">{form.media.length} file(s) attached — hover to remove</p>
                  <MediaStrip items={form.media} onRemove={removeMedia} />
                </div>
              )}
            </div>

            {/* Published toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><p className="text-sm font-medium">Published</p><p className="text-xs text-muted-foreground">Published FAQs are visible to users</p></div>
              <Switch checked={form.isPublished} onCheckedChange={checked => setForm(p => ({ ...p, isPublished: checked }))} />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-2">
            <Button variant="outline" onClick={closeDialog} disabled={isMutating}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isMutating || uploadingMedia}>
              {isMutating ? (editingFaq ? "Saving..." : "Creating...") : editingFaq ? "Save Changes" : "Create FAQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={open => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete FAQ</DialogTitle>
            <DialogDescription>Are you sure you want to delete this FAQ? This action cannot be undone.</DialogDescription>
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
