import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Key,
  Save,
  Plus,
  Search,
  Eye,
  EyeOff,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { client } from "@/lib/client";

interface EnvConfig {
  id: string;
  key: string;
  value: string;
}

interface EnvConfigRequest {
  key: string;
  value: string;
}

interface EnvConfigResponse {
  envConfigs: EnvConfig[];
}

interface SaveResponse {
  success: boolean;
  message: string;
  results?: {
    created: number;
    updated: number;
    errors: string[];
  };
}

export default function ApiKeys() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState({ key: "", value: "" });
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [editingValues, setEditingValues] = useState<Record<string, string>>(
    {}
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch environment variables
  const { data, isLoading, error } = useQuery<EnvConfigResponse>({
    queryKey: ["/api/admin/env-configs"],
    queryFn: () => client.get<EnvConfigResponse>("/api/admin/env-configs"),
    retry: 2,
  });

  // Save mutations
  const saveMutation = useMutation<SaveResponse, Error, EnvConfigRequest[]>({
    mutationFn: async (envConfigs: EnvConfigRequest[]) => {
      return client.post<SaveResponse>("/api/admin/env-configs", {
        envConfigs,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/env-configs"] });
      toast({
        title: "Success",
        description:
          data.message || "Environment variables updated successfully",
        variant: "default",
      });
      setEditingValues({});
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update environment variables",
        variant: "destructive",
      });
    },
  });

  // Handle save
  const handleSave = () => {
    const envConfigs = Object.entries(editingValues).map(([key, value]) => ({
      key,
      value,
    }));

    if (envConfigs.length === 0) {
      toast({
        title: "No changes",
        description: "No changes to save",
        variant: "default",
      });
      return;
    }

    saveMutation.mutate(envConfigs);
  };

  // Handle add new key
  const handleAddNew = () => {
    if (!newKey.key || !newKey.value) {
      toast({
        title: "Validation Error",
        description: "Both key and value are required",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate([newKey], {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        setNewKey({ key: "", value: "" });
      },
    });
  };

  // Toggle visibility
  const toggleVisibility = (key: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(key)) {
      newVisible.delete(key);
    } else {
      newVisible.add(key);
    }
    setVisibleKeys(newVisible);
  };

  // Mask sensitive values
  const maskValue = (value: string) => {
    if (value.length <= 8) return "••••••••";
    return (
      value.substring(0, 4) +
      "•".repeat(Math.min(value.length - 8, 20)) +
      value.substring(value.length - 4)
    );
  };

  // Filter env configs
  const filteredConfigs =
    data?.envConfigs.filter((config) =>
      config.key.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-lg font-medium">Loading API keys...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <div className="text-lg font-medium text-destructive">
            Failed to load API keys
          </div>
          <p className="text-muted-foreground mt-2">
            {(error as Error).message || "Unknown error occurred"}
          </p>
        </div>
      </div>
    );
  }

  const hasChanges = Object.keys(editingValues).length > 0;

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">
              API Key Management
            </h1>
            <p className="text-muted-foreground">
              Manage environment variables and API keys for the platform
            </p>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            )}
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add New Key
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Changes take effect immediately
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Environment variables are cached and reloaded automatically
                  after saving. No server restart required.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search environment variables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Environment Variables Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Environment Variables ({filteredConfigs.length})
            </CardTitle>
            <CardDescription>
              {hasChanges && (
                <span className="text-amber-600 dark:text-amber-400">
                  You have unsaved changes
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredConfigs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No environment variables found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConfigs.map((config) => {
                      const isVisible = visibleKeys.has(config.key);
                      const isEditing = config.key in editingValues;
                      const displayValue = isEditing
                        ? editingValues[config.key]
                        : config.value;
                      const showMasked = !isVisible && !isEditing;

                      return (
                        <TableRow key={config.id}>
                          <TableCell className="font-mono text-sm">
                            {config.key}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {showMasked ? (
                                <span className="font-mono text-sm text-muted-foreground">
                                  {maskValue(displayValue)}
                                </span>
                              ) : (
                                <Input
                                  value={displayValue}
                                  onChange={(e) => {
                                    setEditingValues({
                                      ...editingValues,
                                      [config.key]: e.target.value,
                                    });
                                  }}
                                  className="font-mono text-sm"
                                  type={isVisible ? "text" : "password"}
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleVisibility(config.key)}
                                title={isVisible ? "Hide" : "Show"}
                              >
                                {isVisible ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                              {isEditing && (
                                <Badge variant="secondary" className="text-xs">
                                  Edited
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add New Key Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Environment Variable</DialogTitle>
              <DialogDescription>
                Add a new environment variable. Changes take effect immediately
                after saving.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Key</label>
                <Input
                  placeholder="API_KEY_NAME"
                  value={newKey.key}
                  onChange={(e) =>
                    setNewKey({ ...newKey, key: e.target.value.toUpperCase() })
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Value</label>
                <Input
                  placeholder="your-secret-value"
                  value={newKey.value}
                  onChange={(e) =>
                    setNewKey({ ...newKey, value: e.target.value })
                  }
                  type="password"
                  className="font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setNewKey({ key: "", value: "" });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddNew} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
