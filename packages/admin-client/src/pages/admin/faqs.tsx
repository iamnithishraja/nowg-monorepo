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
  HelpCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface FaqsResponse {
  faqs: Faq[];
}

const CATEGORIES = [
  "General",
  "Account",
  "Billing",
  "Technical",
  "Features",
  "Other",
];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const emptyForm = {
  question: "",
  answer: "",
  category: "General",
  order: 0,
  isPublished: true,
};

export default function FaqsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set());
  const [form, setForm] = useState(emptyForm);

  const userRole = (user as any)?.role;
  const isFullAdmin =
    userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;

  // Fetch all FAQs
  const { data: faqsData, isLoading } = useQuery<FaqsResponse>({
    queryKey: ["/api/admin/faqs"],
    queryFn: async () => {
      return client.get<FaqsResponse>("/api/admin/faqs");
    },
    enabled: isFullAdmin,
  });

  // Create FAQ mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      return client.post("/api/admin/faqs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/faqs"] });
      toast({ title: "FAQ Created", description: "The FAQ has been created." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create FAQ",
        variant: "destructive",
      });
    },
  });

  // Update FAQ mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<typeof form>;
    }) => {
      return client.put(`/api/admin/faqs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/faqs"] });
      toast({ title: "FAQ Updated", description: "The FAQ has been updated." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update FAQ",
        variant: "destructive",
      });
    },
  });

  // Delete FAQ mutation
  const deleteMutation = useMutation({
    mutationFn: async (faqId: string) => {
      return client.delete(`/api/admin/faqs/${faqId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/faqs"] });
      toast({ title: "FAQ Deleted", description: "The FAQ has been deleted." });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete FAQ",
        variant: "destructive",
      });
    },
  });

  const openCreateDialog = () => {
    setEditingFaq(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (faq: Faq) => {
    setEditingFaq(faq);
    setForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || "General",
      order: faq.order,
      isPublished: faq.isPublished,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFaq(null);
    setForm(emptyForm);
  };

  const handleSubmit = () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast({
        title: "Validation Error",
        description: "Question and answer are required.",
        variant: "destructive",
      });
      return;
    }

    if (editingFaq) {
      updateMutation.mutate({ id: editingFaq.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const faqs = faqsData?.faqs || [];

  // Group by category
  const grouped = faqs.reduce(
    (acc, faq) => {
      const cat = faq.category || "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(faq);
      return acc;
    },
    {} as Record<string, Faq[]>
  );

  const isMutating =
    createMutation.isPending || updateMutation.isPending;

  if (!isFullAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              You don't have permission to manage FAQs. Only super admins can
              manage FAQs.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HelpCircle className="h-8 w-8" />
            FAQs
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage frequently asked questions shown to users
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add FAQ
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{faqs.length}</p>
              <p className="text-sm text-muted-foreground">Total FAQs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {faqs.filter((f) => f.isPublished).length}
              </p>
              <p className="text-sm text-muted-foreground">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {Object.keys(grouped).length}
              </p>
              <p className="text-sm text-muted-foreground">Categories</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQs List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading FAQs...
        </div>
      ) : faqs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HelpCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No FAQs yet</p>
            <Button onClick={openCreateDialog} variant="outline" className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Create your first FAQ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryFaqs]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{category}</span>
                  <Badge variant="secondary">{categoryFaqs.length}</Badge>
                </CardTitle>
                <CardDescription>
                  {categoryFaqs.filter((f) => f.isPublished).length} published
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {categoryFaqs.map((faq) => {
                  const isExpanded = expandedFaqs.has(faq.id);
                  return (
                    <div
                      key={faq.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Question row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          className="flex-1 text-left flex items-center gap-2"
                          onClick={() => toggleExpand(faq.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          )}
                          <span className="font-medium text-sm">
                            {faq.question}
                          </span>
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge
                            variant={faq.isPublished ? "default" : "secondary"}
                            className={
                              faq.isPublished
                                ? "bg-green-600 text-xs"
                                : "text-xs"
                            }
                          >
                            {faq.isPublished ? "Published" : "Draft"}
                          </Badge>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            #{faq.order}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEditDialog(faq)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(faq.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Answer (Expanded) */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-3">
                            {faq.answer}
                          </p>
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
                            <span>Created {formatDate(faq.createdAt)}</span>
                            {faq.createdBy && (
                              <span>by {faq.createdBy}</span>
                            )}
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

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFaq ? "Edit FAQ" : "Create New FAQ"}
            </DialogTitle>
            <DialogDescription>
              {editingFaq
                ? "Update this frequently asked question."
                : "Add a new frequently asked question for users."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Question */}
            <div>
              <Label htmlFor="faq-question">
                Question <span className="text-destructive">*</span>
              </Label>
              <Input
                id="faq-question"
                value={form.question}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, question: e.target.value }))
                }
                placeholder="What is...?"
                className="mt-1.5"
              />
            </div>

            {/* Answer */}
            <div>
              <Label htmlFor="faq-answer">
                Answer <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="faq-answer"
                value={form.answer}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, answer: e.target.value }))
                }
                placeholder="The answer to the question..."
                rows={4}
                className="mt-1.5"
              />
            </div>

            {/* Category and Order */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="faq-category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) =>
                    setForm((prev) => ({ ...prev, category: val }))
                  }
                >
                  <SelectTrigger id="faq-category" className="mt-1.5">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="faq-order">Display Order</Label>
                <Input
                  id="faq-order"
                  type="number"
                  value={form.order}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      order: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="mt-1.5"
                  min={0}
                />
              </div>
            </div>

            {/* Published toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">
                  Published FAQs are visible to users
                </p>
              </div>
              <Switch
                checked={form.isPublished}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isPublished: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isMutating}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isMutating}>
              {isMutating
                ? editingFaq
                  ? "Saving..."
                  : "Creating..."
                : editingFaq
                ? "Save Changes"
                : "Create FAQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete FAQ</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this FAQ? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmId && deleteMutation.mutate(deleteConfirmId)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
