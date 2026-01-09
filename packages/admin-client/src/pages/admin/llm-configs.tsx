import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Cpu, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { LlmConfig } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

export default function LlmConfigsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LlmConfig | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    provider: "",
    apiKey: "",
    isActive: true,
    modelPricing: "",
    config: ""
  });

  const { data: configs = [], isLoading } = useQuery<LlmConfig[]>({
    queryKey: ["/api/llm-configs"]
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/llm-configs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-configs"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "LLM configuration created successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create configuration",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest('PATCH', `/api/llm-configs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-configs"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "LLM configuration updated successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update configuration",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/llm-configs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-configs"] });
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
      toast({
        title: "Success",
        description: "LLM configuration deleted successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete configuration",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      provider: "",
      apiKey: "",
      isActive: true,
      modelPricing: "",
      config: ""
    });
    setEditingConfig(null);
  };

  const handleEdit = (config: LlmConfig) => {
    setEditingConfig(config);
    setFormData({
      provider: config.provider,
      apiKey: config.apiKey,
      isActive: config.isActive,
      modelPricing: config.modelPricing ? JSON.stringify(config.modelPricing, null, 2) : "",
      config: config.config ? JSON.stringify(config.config, null, 2) : ""
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfigToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.provider.trim() || !formData.apiKey.trim()) {
      toast({
        title: "Validation Error",
        description: "Provider and API key are required",
        variant: "destructive"
      });
      return;
    }

    let modelPricing = null;
    let config = null;

    if (formData.modelPricing.trim()) {
      try {
        modelPricing = JSON.parse(formData.modelPricing);
      } catch {
        toast({
          title: "Validation Error",
          description: "Model pricing must be valid JSON",
          variant: "destructive"
        });
        return;
      }
    }

    if (formData.config.trim()) {
      try {
        config = JSON.parse(formData.config);
      } catch {
        toast({
          title: "Validation Error",
          description: "Config must be valid JSON",
          variant: "destructive"
        });
        return;
      }
    }

    const payload = {
      provider: formData.provider.trim(),
      apiKey: formData.apiKey.trim(),
      isActive: formData.isActive,
      modelPricing,
      config
    };

    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleApiKeyVisibility = (configId: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }));
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case "openai":
        return "bg-green-500/20 text-green-700 dark:text-green-400";
      case "anthropic":
        return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
      case "openrouter":
        return "bg-blue-500/20 text-blue-700 dark:text-blue-400";
      default:
        return "bg-gray-500/20 text-gray-700 dark:text-gray-400";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">Loading LLM configurations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 bg-background">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">LLM Configurations</h1>
        <p className="text-muted-foreground">
          Manage API keys and settings for LLM providers
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4 mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} data-testid="button-create-config">
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-config-form">
            <DialogHeader>
              <DialogTitle>{editingConfig ? "Edit Configuration" : "Add Configuration"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="provider">Provider *</Label>
                  <Select value={formData.provider} onValueChange={(value) => setFormData({ ...formData, provider: value })}>
                    <SelectTrigger data-testid="select-provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="isActive">Active</Label>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-active"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="apiKey">API Key *</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-..."
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    required
                    data-testid="input-api-key"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="modelPricing">Model Pricing (JSON)</Label>
                  <Textarea
                    id="modelPricing"
                    placeholder='{"gpt-4": 0.03, "gpt-3.5-turbo": 0.002}'
                    value={formData.modelPricing}
                    onChange={(e) => setFormData({ ...formData, modelPricing: e.target.value })}
                    rows={4}
                    className="font-mono text-sm"
                    data-testid="textarea-model-pricing"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="config">Additional Config (JSON)</Label>
                  <Textarea
                    id="config"
                    placeholder='{"baseURL": "https://api.openai.com/v1"}'
                    value={formData.config}
                    onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                    rows={4}
                    className="font-mono text-sm"
                    data-testid="textarea-config"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                  {editingConfig ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {configs.length === 0 ? (
        <Card className="p-12 text-center">
          <Cpu className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No LLM configurations</h3>
          <p className="text-muted-foreground mb-4">Add your first LLM provider configuration</p>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} data-testid="button-create-first">
            <Plus className="h-4 w-4 mr-2" />
            Add Configuration
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {configs.map((config) => (
            <Card key={config.id} className="shadow-sm hover-elevate" data-testid={`card-config-${config.id}`}>
              <CardHeader className="border-b pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Cpu className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold capitalize">{config.provider}</h3>
                      <Badge variant="secondary" className={getProviderBadgeColor(config.provider)}>
                        {config.provider}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(config)} data-testid={`button-edit-${config.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(config.id)} data-testid={`button-delete-${config.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${config.isActive ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                      <span className={`font-medium ${config.isActive ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-muted-foreground">API Key</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleApiKeyVisibility(config.id)}
                        data-testid={`button-toggle-key-${config.id}`}
                      >
                        {showApiKeys[config.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="font-mono text-xs break-all bg-muted/30 p-2 rounded">
                      {showApiKeys[config.id] ? config.apiKey : maskApiKey(config.apiKey)}
                    </div>
                  </div>
                  {(config.modelPricing && typeof config.modelPricing === 'object') ? (
                    <div className="pt-4 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Model Pricing</p>
                      <p className="text-xs font-mono bg-muted/30 p-2 rounded">
                        {JSON.stringify(config.modelPricing).slice(0, 50)}...
                      </p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this LLM configuration? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => configToDelete && deleteMutation.mutate(configToDelete)}
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
