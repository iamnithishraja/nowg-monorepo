import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, AlertCircle, ExternalLink, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import type { ComponentType } from "react";
import type { IconType } from "react-icons";

interface MicroserviceConfig {
  id: string;
  serviceName: string;
  apiKey: string;
  apiSecret?: string;
  webhookUrl?: string;
  isActive: boolean;
  lastSynced?: string;
}

interface ServiceInfo {
  name: string;
  icon: IconType;
  description: string;
  color: string;
  bgColor: string;
  docs: string;
}

interface MicroserviceConfigProps {
  service: ServiceInfo;
}

export function MicroserviceConfigComponent({ service }: MicroserviceConfigProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
    webhookUrl: '',
  });

  const { data: configs, isLoading } = useQuery<MicroserviceConfig[]>({
    queryKey: ['/api/admin/microservices'],
  });

  const config = configs?.find(c => c.serviceName === service.name);

  // Initialize form data when config is loaded
  useEffect(() => {
    if (config && !isEditing) {
      setFormData({
        apiKey: config.apiKey || '',
        apiSecret: config.apiSecret || '',
        webhookUrl: config.webhookUrl || '',
      });
    }
  }, [config, isEditing]);

  const createConfigMutation = useMutation({
    mutationFn: async (data: { serviceName: string; apiKey: string; apiSecret?: string; webhookUrl?: string; isActive: boolean }) => {
      return await apiRequest("POST", `/api/admin/microservices`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/microservices'] });
      toast({
        title: "Success",
        description: `${service.name} integration created successfully`,
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create configuration",
        variant: "destructive",
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: Partial<MicroserviceConfig> & { id: string }) => {
      return await apiRequest("PATCH", `/api/admin/microservices/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/microservices'] });
      toast({
        title: "Success",
        description: `${service.name} configuration updated successfully`,
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive",
      });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/microservices/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/microservices'] });
      toast({
        title: "Success",
        description: `${service.name} integration deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete configuration",
        variant: "destructive",
      });
    },
  });

  const handleToggleService = (isActive: boolean) => {
    if (config) {
      updateConfigMutation.mutate({ id: config.id, isActive });
    }
  };

  const handleSaveConfig = () => {
    if (config) {
      updateConfigMutation.mutate({
        id: config.id,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        webhookUrl: formData.webhookUrl,
      });
    } else {
      createConfigMutation.mutate({
        serviceName: service.name,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        webhookUrl: formData.webhookUrl,
        isActive: false,
      });
    }
  };

  const handleDelete = () => {
    if (config && confirm(`Are you sure you want to delete the ${service.name} integration?`)) {
      deleteConfigMutation.mutate(config.id);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 bg-background">
        <div className="max-w-4xl mx-auto">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-6 w-32 bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-40 bg-muted rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const Icon = service.icon;

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className={`h-16 w-16 rounded-lg ${service.bgColor} flex items-center justify-center`} data-testid="icon-service">
              <Icon className={`h-8 w-8 ${service.color}`} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-semibold mb-1" data-testid="text-page-title">{service.name}</h1>
              <p className="text-muted-foreground" data-testid="text-description">{service.description}</p>
            </div>
            {config && (
              <Badge variant={config.isActive ? "default" : "secondary"} className="gap-1" data-testid="badge-status">
                {config.isActive ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {config.isActive ? "Active" : "Inactive"}
              </Badge>
            )}
            {!config && <Badge variant="outline" data-testid="badge-not-configured">Not Configured</Badge>}
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Manage your {service.name} integration settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isEditing && config ? (
              <>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b">
                    <Label className="text-sm text-muted-foreground">API Key</Label>
                    <span className="text-xs font-mono" data-testid="text-api-key-masked">
                      {config.apiKey ? "••••••••••••" : "Not set"}
                    </span>
                  </div>
                  {config.apiSecret && (
                    <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b">
                      <Label className="text-sm text-muted-foreground">API Secret</Label>
                      <span className="text-xs font-mono" data-testid="text-api-secret-masked">••••••••••••</span>
                    </div>
                  )}
                  {config.webhookUrl && (
                    <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b">
                      <Label className="text-sm text-muted-foreground">Webhook URL</Label>
                      <span className="text-xs font-mono truncate max-w-xs" data-testid="text-webhook-url">
                        {config.webhookUrl}
                      </span>
                    </div>
                  )}
                  {config.lastSynced && (
                    <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b">
                      <Label className="text-sm text-muted-foreground">Last Synced</Label>
                      <span className="text-xs" data-testid="text-last-synced">
                        {new Date(config.lastSynced).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2" data-testid="toggle-section">
                    <Switch
                      checked={config.isActive}
                      onCheckedChange={handleToggleService}
                      data-testid="switch-active"
                    />
                    <Label className="text-sm cursor-pointer" data-testid="label-toggle-status">
                      {config.isActive ? "Enabled" : "Disabled"}
                    </Label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      data-testid="button-edit"
                    >
                      Edit Configuration
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteConfigMutation.isPending}
                      data-testid="button-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleteConfigMutation.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {!config && (
                  <div className="p-4 bg-muted/50 rounded-lg mb-4" data-testid="info-setup-message">
                    <p className="text-sm text-muted-foreground">
                      Connect your {service.name} account to enable deployment and integration features.{" "}
                      <a 
                        href={service.docs} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                        data-testid="link-docs"
                      >
                        View documentation
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key *</Label>
                  <Input
                    id="api-key"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => updateFormData('apiKey', e.target.value)}
                    placeholder="Enter API key"
                    data-testid="input-api-key"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-secret">API Secret</Label>
                  <Input
                    id="api-secret"
                    type="password"
                    value={formData.apiSecret}
                    onChange={(e) => updateFormData('apiSecret', e.target.value)}
                    placeholder="Enter API secret (optional)"
                    data-testid="input-api-secret"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    value={formData.webhookUrl}
                    onChange={(e) => updateFormData('webhookUrl', e.target.value)}
                    placeholder="https://your-app.com/webhooks"
                    data-testid="input-webhook-url"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveConfig}
                    disabled={!formData.apiKey.trim() || updateConfigMutation.isPending || createConfigMutation.isPending}
                    data-testid="button-save"
                  >
                    {(updateConfigMutation.isPending || createConfigMutation.isPending) ? "Saving..." : "Save Configuration"}
                  </Button>
                  {config && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
