import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Globe,
  Plus,
  Edit,
  Trash2,
  Palette,
  RefreshCw,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { format } from "date-fns";

type WhiteLabelConfig = {
  id: string;
  userId: string;
  domain: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandName: string | null;
  primaryColor: string | null;
  isActive: boolean;
  customCss: string | null;
  createdAt: string;
  updatedAt: string;
};

type User = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

const whiteLabelSchema = z.object({
  userId: z.string().min(1, "Customer is required"),
  domain: z.string().min(3, "Domain is required").regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i, "Invalid domain format"),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  faviconUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  brandName: z.string().min(1, "Brand name is required").max(100),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g., #7367F0)").optional().or(z.literal("")),
  customCss: z.string().optional(),
  isActive: z.boolean().default(false),
});

type WhiteLabelInput = z.infer<typeof whiteLabelSchema>;

export default function WhiteLabel() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WhiteLabelConfig | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);

  const { data: configs = [], isLoading } = useQuery<WhiteLabelConfig[]>({
    queryKey: ["/api/white-label"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<WhiteLabelInput>({
    resolver: zodResolver(whiteLabelSchema),
    defaultValues: {
      userId: "",
      domain: "",
      logoUrl: "",
      faviconUrl: "",
      brandName: "",
      primaryColor: "#7367F0",
      customCss: "",
      isActive: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: WhiteLabelInput) => {
      return await apiRequest("/api/white-label", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/white-label"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "White Label Created",
        description: "The white label configuration has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WhiteLabelInput> }) => {
      return await apiRequest(`/api/white-label/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/white-label"] });
      setDialogOpen(false);
      setEditingConfig(null);
      form.reset();
      toast({
        title: "White Label Updated",
        description: "The white label configuration has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/white-label/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/white-label"] });
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
      toast({
        title: "White Label Deleted",
        description: "The white label configuration has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleOpenDialog = (config?: WhiteLabelConfig) => {
    if (config) {
      setEditingConfig(config);
      form.reset({
        userId: config.userId,
        domain: config.domain,
        logoUrl: config.logoUrl || "",
        faviconUrl: config.faviconUrl || "",
        brandName: config.brandName || "",
        primaryColor: config.primaryColor || "#7367F0",
        customCss: config.customCss || "",
        isActive: config.isActive,
      });
    } else {
      setEditingConfig(null);
      form.reset({
        userId: "",
        domain: "",
        logoUrl: "",
        faviconUrl: "",
        brandName: "",
        primaryColor: "#7367F0",
        customCss: "",
        isActive: false,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = (data: WhiteLabelInput) => {
    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getUserDisplay = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return userId.slice(0, 8);
    return user.email || `${user.firstName || ''} ${user.lastName || ''}`.trim() || userId.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">White Label</h1>
          <p className="text-muted-foreground mt-1">
            Manage custom domain configurations
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/white-label"] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => handleOpenDialog()}
            data-testid="button-create-config"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Configuration
          </Button>
        </div>
      </div>

      {/* Configurations Table */}
      <Card className="shadow-sm hover-elevate">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Configurations</h2>
                <p className="text-sm text-muted-foreground">
                  {configs.length} configuration{configs.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading configurations...
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No white label configurations found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-configs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Domain</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Brand Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Primary Color</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Updated</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((config) => {
                    return (
                      <tr
                        key={config.id}
                        className="border-b hover-elevate"
                        data-testid={`row-config-${config.id}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{config.domain}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {getUserDisplay(config.userId)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {config.brandName || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {config.primaryColor ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="h-6 w-6 rounded border"
                                style={{ backgroundColor: config.primaryColor }}
                              />
                              <span className="text-sm font-mono">{config.primaryColor}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={config.isActive ? "default" : "secondary"}
                            data-testid={`badge-status-${config.id}`}
                          >
                            {config.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(config.updatedAt), "MMM dd, yyyy")}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(config)}
                              data-testid={`button-edit-${config.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setConfigToDelete(config.id);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-${config.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-config-form">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Edit Configuration" : "Create Configuration"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!editingConfig}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-user">
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.email || `User ${user.id.slice(0, 8)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the customer this configuration belongs to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., mycustom.com"
                        data-testid="input-domain"
                      />
                    </FormControl>
                    <FormDescription>
                      The custom domain for this white label configuration
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brandName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., My Company"
                        data-testid="input-brand-name"
                      />
                    </FormControl>
                    <FormDescription>
                      The brand name displayed in the application
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="url"
                          placeholder="https://example.com/logo.png"
                          data-testid="input-logo-url"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="faviconUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Favicon URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="url"
                          placeholder="https://example.com/favicon.ico"
                          data-testid="input-favicon-url"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <div className="flex gap-3 items-center">
                      <FormControl>
                        <Input
                          {...field}
                          type="color"
                          className="w-20 h-10"
                          data-testid="input-primary-color"
                        />
                      </FormControl>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="#7367F0"
                          className="flex-1"
                        />
                      </FormControl>
                    </div>
                    <FormDescription>
                      The primary brand color (hex format)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customCss"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom CSS</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder=".header { background: #000; }"
                        className="font-mono text-sm min-h-[120px]"
                        data-testid="input-custom-css"
                      />
                    </FormControl>
                    <FormDescription>
                      Optional custom CSS overrides for advanced branding
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Enable this white label configuration
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingConfig ? "Update" : "Create"} Configuration
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this white label configuration? This action cannot be undone
              and the custom domain will stop working.
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
