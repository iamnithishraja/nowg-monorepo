import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Tag, Trash2, Edit, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Plan } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

export default function PlansPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    billingPeriod: "monthly",
    tokensIncluded: "",
    storageLimit: "",
    projectsLimit: "",
    isActive: true
  });

  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"]
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/plans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Plan created successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create plan",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest('PATCH', `/api/plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Plan updated successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      toast({
        title: "Success",
        description: "Plan deleted successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete plan",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      billingPeriod: "monthly",
      tokensIncluded: "",
      storageLimit: "",
      projectsLimit: "",
      isActive: true
    });
    setFeatures([]);
    setNewFeature("");
    setEditingPlan(null);
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      tokensIncluded: plan.tokensIncluded.toString(),
      storageLimit: plan.storageLimit.toString(),
      projectsLimit: plan.projectsLimit.toString(),
      isActive: plan.isActive
    });
    setFeatures(plan.features || []);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setPlanToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.price.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and price are required",
        variant: "destructive"
      });
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      price: formData.price,
      billingPeriod: formData.billingPeriod,
      tokensIncluded: parseInt(formData.tokensIncluded) || 0,
      storageLimit: parseInt(formData.storageLimit) || 1024,
      projectsLimit: parseInt(formData.projectsLimit) || 10,
      features: features.length > 0 ? features : null,
      isActive: formData.isActive
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const addFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature("");
    }
  };

  const removeFeature = (feature: string) => {
    setFeatures(features.filter(f => f !== feature));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">Loading plans...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 bg-background">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Plans</h1>
        <p className="text-muted-foreground">
          Manage subscription plans and pricing tiers
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4 mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} data-testid="button-create-plan">
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-plan-form">
            <DialogHeader>
              <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Plan Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Pro Plan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-plan-name"
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Plan description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    data-testid="textarea-plan-description"
                  />
                </div>

                <div>
                  <Label htmlFor="price">Price (USD) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="9.99"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    data-testid="input-plan-price"
                  />
                </div>

                <div>
                  <Label htmlFor="billingPeriod">Billing Period</Label>
                  <Select value={formData.billingPeriod} onValueChange={(value) => setFormData({ ...formData, billingPeriod: value })}>
                    <SelectTrigger data-testid="select-billing-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tokensIncluded">Tokens Included</Label>
                  <Input
                    id="tokensIncluded"
                    type="number"
                    placeholder="100000"
                    value={formData.tokensIncluded}
                    onChange={(e) => setFormData({ ...formData, tokensIncluded: e.target.value })}
                    data-testid="input-tokens-included"
                  />
                </div>

                <div>
                  <Label htmlFor="storageLimit">Storage Limit (MB)</Label>
                  <Input
                    id="storageLimit"
                    type="number"
                    placeholder="1024"
                    value={formData.storageLimit}
                    onChange={(e) => setFormData({ ...formData, storageLimit: e.target.value })}
                    data-testid="input-storage-limit"
                  />
                </div>

                <div>
                  <Label htmlFor="projectsLimit">Projects Limit</Label>
                  <Input
                    id="projectsLimit"
                    type="number"
                    placeholder="10"
                    value={formData.projectsLimit}
                    onChange={(e) => setFormData({ ...formData, projectsLimit: e.target.value })}
                    data-testid="input-projects-limit"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="isActive">Active</Label>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-plan-active"
                  />
                </div>
              </div>

              <div className="border rounded-md p-4 bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <h3 className="font-medium">Features</h3>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add feature..."
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                      data-testid="input-new-feature"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFeature}
                      data-testid="button-add-feature"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                {features.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No features added yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {features.map((feature, index) => (
                      <div key={index} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-background">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{feature}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFeature(feature)}
                          data-testid={`button-remove-feature-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-plan">
                  {editingPlan ? "Update Plan" : "Create Plan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {plans.length === 0 ? (
        <Card className="p-12 text-center">
          <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No plans yet</h3>
          <p className="text-muted-foreground mb-4">Create your first subscription plan</p>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} data-testid="button-create-first-plan">
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="shadow-sm hover-elevate" data-testid={`card-plan-${plan.id}`}>
              <CardHeader className="border-b pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Tag className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        ${plan.price}/{plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)} data-testid={`button-edit-${plan.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)} data-testid={`button-delete-${plan.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {plan.description && (
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                )}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${plan.isActive ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                      <span className={`font-medium ${plan.isActive ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Tokens</span>
                    <span className="font-medium">{plan.tokensIncluded.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Storage</span>
                    <span className="font-medium">{plan.storageLimit} MB</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Projects</span>
                    <span className="font-medium">{plan.projectsLimit}</span>
                  </div>
                  {plan.features && plan.features.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Features</p>
                      <div className="flex flex-wrap gap-2">
                        {plan.features.map((feature, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs" data-testid={`badge-feature-${idx}`}>
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this plan? This action cannot be undone and may affect existing subscriptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planToDelete && deleteMutation.mutate(planToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
