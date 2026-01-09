import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Save,
  RefreshCw,
  CreditCard,
  Globe,
  Plus,
  Edit,
  Trash2,
  Building2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { countries, getCountryName } from "@/utils/countries";
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

type PaymentSetting = {
  id: string;
  region: string;
  provider: "stripe" | "razorpay" | "payu";
  updatedAt: string;
  updatedBy: string | null;
};

type Organization = {
  id: string;
  name: string;
  paymentProvider: "stripe" | "razorpay" | "payu" | null;
  updatedAt: string;
};

export default function PaymentSettings() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<
    "stripe" | "razorpay" | "payu" | ""
  >("");
  const [editingSetting, setEditingSetting] = useState<PaymentSetting | null>(
    null
  );
  const [deletingRegion, setDeletingRegion] = useState<string | null>(null);
  
  // Org Payment Settings state
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedOrgProvider, setSelectedOrgProvider] = useState<
    "stripe" | "razorpay" | "payu" | "default"
  >("default");
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  const { data, isLoading, refetch } = useQuery<{
    success: boolean;
    settings: PaymentSetting[];
  }>({
    queryKey: ["/api/admin/payment-settings"],
  });

  const { data: defaultData, refetch: refetchDefault } = useQuery<{
    success: boolean;
    defaultProvider: "stripe" | "razorpay" | "payu";
    updatedAt?: string;
  }>({
    queryKey: ["/api/admin/payment-settings/default"],
  });

  // Fetch organizations
  const { data: orgsData, isLoading: orgsLoading, refetch: refetchOrgs, error: orgsError } = useQuery<{
    organizations: Organization[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    queryKey: ["/api/admin/organizations", "payment-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/organizations?page=1&limit=1000");
      return await response.json();
    },
    retry: 1,
  });

  const [defaultProvider, setDefaultProvider] = useState<
    "stripe" | "razorpay" | "payu" | ""
  >("");

  const updateDefaultMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await apiRequest(
        "PUT",
        "/api/admin/payment-settings/default",
        { provider }
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/payment-settings/default"],
      });
      toast({
        title: "Default Provider Updated",
        description: "Default payment provider has been updated successfully.",
      });
      setDefaultProvider("");
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
    mutationFn: async (data: { region: string; provider: string }) => {
      const response = await apiRequest("POST", "/api/admin/payment-settings", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-settings"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/payment-settings/default"],
      });
      toast({
        title: "Settings Saved",
        description: "Payment provider settings have been updated successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
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
    mutationFn: async (region: string) => {
      const response = await apiRequest(
        "DELETE",
        `/api/admin/payment-settings/${region}`
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-settings"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/payment-settings/default"],
      });
      toast({
        title: "Setting Deleted",
        description: "Payment setting has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setDeletingRegion(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Org Payment Provider mutation
  const updateOrgPaymentProviderMutation = useMutation({
    mutationFn: async (data: { organizationId: string; paymentProvider: "stripe" | "razorpay" | "payu" | null }) => {
      const response = await apiRequest(
        "PUT",
        `/api/admin/organizations/${data.organizationId}/payment-provider`,
        { paymentProvider: data.paymentProvider }
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      refetchOrgs();
      toast({
        title: "Organization Payment Provider Updated",
        description: "Payment provider has been updated successfully.",
      });
      setIsOrgDialogOpen(false);
      resetOrgForm();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setSelectedCountry("");
    setSelectedProvider("");
    setEditingSetting(null);
  };

  const resetOrgForm = () => {
    setSelectedOrgId("");
    setSelectedOrgProvider("default");
    setEditingOrg(null);
  };

  const handleAddCountry = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (setting: PaymentSetting) => {
    setEditingSetting(setting);
    setSelectedCountry(setting.region);
    setSelectedProvider(setting.provider);
    setIsDialogOpen(true);
  };

  const handleDelete = (region: string) => {
    setDeletingRegion(region);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = () => {
    const region = editingSetting?.region || selectedCountry;
    if (!region || !selectedProvider) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a country and payment provider",
      });
      return;
    }

    updateMutation.mutate({
      region,
      provider: selectedProvider,
    });
  };

  const handleConfirmDelete = () => {
    if (deletingRegion) {
      deleteMutation.mutate(deletingRegion);
    }
  };

  const handleSaveDefault = () => {
    if (!defaultProvider) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a default payment provider",
      });
      return;
    }

    updateDefaultMutation.mutate(defaultProvider);
  };

  const handleAddOrg = () => {
    resetOrgForm();
    setIsOrgDialogOpen(true);
  };

  const handleEditOrg = (org: Organization) => {
    setEditingOrg(org);
    setSelectedOrgId(org.id);
    setSelectedOrgProvider(org.paymentProvider || "default");
    setIsOrgDialogOpen(true);
  };

  const handleSaveOrg = () => {
    const orgId = editingOrg?.id || selectedOrgId;
    if (!orgId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an organization",
      });
      return;
    }

    // When adding, require a payment provider (not "default")
    // When editing, allow clearing (null) by selecting "default"
    if (!editingOrg && (selectedOrgProvider === "default" || !selectedOrgProvider)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a payment provider",
      });
      return;
    }

    // Convert "default" to null for the API
    const paymentProvider = selectedOrgProvider === "default" 
      ? null 
      : (selectedOrgProvider as "stripe" | "razorpay" | "payu");

    updateOrgPaymentProviderMutation.mutate({
      organizationId: orgId,
      paymentProvider,
    });
  };

  // Initialize default provider from query data
  const currentDefaultProvider =
    defaultProvider || defaultData?.defaultProvider || "stripe";

  // Get already configured countries
  const configuredRegions = new Set(
    data?.settings.map((s) => s.region) || []
  );

  // Filter out already configured countries from dropdown (unless editing)
  const availableCountries = countries.filter(
    (country) =>
      !configuredRegions.has(country.code) ||
      (editingSetting && country.code === editingSetting.region)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure payment providers for different countries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAddCountry}>
            <Plus className="h-4 w-4 mr-2" />
            Add Country
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              refetch();
              refetchDefault();
              refetchOrgs();
            }}
            disabled={isLoading || orgsLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading || orgsLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <Alert>
        <Globe className="h-4 w-4" />
        <AlertDescription>
          Configure payment providers for specific countries. Countries not
          explicitly configured will use the default provider below.
        </AlertDescription>
      </Alert>

      {/* Default Provider Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Default Payment Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-provider">
              Default Provider for Unconfigured Countries
            </Label>
            <Select
              value={currentDefaultProvider}
              onValueChange={(value) =>
                setDefaultProvider(value as "stripe" | "razorpay" | "payu")
              }
            >
              <SelectTrigger id="default-provider" className="w-full">
                <SelectValue placeholder="Select default payment provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="razorpay">Razorpay</SelectItem>
                <SelectItem value="payu">PayU</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This provider will be used for all countries that don't have a
              specific payment provider configured.
            </p>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleSaveDefault}
              disabled={
                updateDefaultMutation.isPending ||
                currentDefaultProvider === defaultData?.defaultProvider
              }
            >
              <Save className="h-4 w-4 mr-2" />
              {updateDefaultMutation.isPending
                ? "Saving..."
                : "Save Default Provider"}
            </Button>
          </div>

          {defaultData?.updatedAt && (
            <div className="pt-4 border-t text-sm text-muted-foreground">
              <p>
                Last updated:{" "}
                {new Date(defaultData.updatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Country Payment Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading settings...
            </div>
          ) : data?.settings && data.settings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Country Code</TableHead>
                  <TableHead>Payment Provider</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.settings.map((setting) => (
                  <TableRow key={setting.id}>
                    <TableCell className="font-medium">
                      {getCountryName(setting.region)}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{setting.region}</span>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{setting.provider}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(setting.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(setting)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(setting.region)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No payment settings configured. Click "Add Country" to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Org Payment Settings
            </CardTitle>
            <Button onClick={handleAddOrg} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {orgsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading organizations...
            </div>
          ) : orgsError ? (
            <div className="text-center py-8 text-destructive">
              Error loading organizations. Please try again.
            </div>
          ) : (() => {
            // Filter to only show organizations with paymentProvider set
            const orgsWithProvider = (orgsData?.organizations || []).filter(
              (org) => org.paymentProvider !== null && org.paymentProvider !== undefined
            );
            return orgsWithProvider.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Payment Provider</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgsWithProvider.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        <span className="capitalize">{org.paymentProvider}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(org.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditOrg(org)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No organization payment settings configured. Click "Add Organization" to get started.
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Keys Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Make sure to add the following API keys in the Environment
            Configuration:
          </p>
          <div className="space-y-2 text-sm">
            <div>
              <strong>For Razorpay:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>RAZORPAY_KEY_ID</li>
                <li>RAZORPAY_KEY_SECRET</li>
              </ul>
            </div>
            <div>
              <strong>For PayU:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>PAYU_KEY</li>
                <li>PAYU_SALT</li>
                <li>PAYU_MERCHANT_ID</li>
                <li>PAYU_MODE (optional: "sandbox" or "production")</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Country Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSetting ? "Edit Country Setting" : "Add Country"}
            </DialogTitle>
            <DialogDescription>
              {editingSetting
                ? "Update the payment provider for this country."
                : "Select a country and choose its payment provider."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={selectedCountry}
                onValueChange={setSelectedCountry}
                disabled={!!editingSetting}
              >
                <SelectTrigger id="country" className="w-full">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableCountries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider">Payment Provider</Label>
              <Select
                value={selectedProvider}
                onValueChange={(value) =>
                  setSelectedProvider(value as "stripe" | "razorpay" | "payu")
                }
              >
                <SelectTrigger id="provider" className="w-full">
                  <SelectValue placeholder="Select a payment provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                  <SelectItem value="payu">PayU</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || !selectedCountry || !selectedProvider}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the payment setting for{" "}
              <strong>{deletingRegion ? getCountryName(deletingRegion) : ""}</strong>.
              Users from this country will default to Stripe. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Org Payment Provider Dialog */}
      <Dialog open={isOrgDialogOpen} onOpenChange={setIsOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOrg ? "Edit Organization Payment Provider" : "Set Organization Payment Provider"}
            </DialogTitle>
            <DialogDescription>
              {editingOrg
                ? "Update the payment provider for this organization."
                : "Select an organization and choose its payment provider."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org">Organization</Label>
              {(() => {
                const allOrgs = orgsData?.organizations || [];
                // When editing, show only the org being edited
                // When adding, show all orgs that don't have a paymentProvider set
                const availableOrgs = editingOrg
                  ? allOrgs.filter((org) => org.id === editingOrg.id)
                  : allOrgs.filter((org) => !org.paymentProvider);
                
                if (availableOrgs.length === 0 && !editingOrg) {
                  return (
                    <div className="text-sm text-muted-foreground p-4 border rounded-md">
                      All organizations already have payment providers configured. Edit an existing organization to change its payment provider.
                    </div>
                  );
                }
                
                return (
                  <Select
                    value={selectedOrgId}
                    onValueChange={setSelectedOrgId}
                    disabled={!!editingOrg}
                  >
                    <SelectTrigger id="org" className="w-full">
                      <SelectValue placeholder="Select an organization" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {availableOrgs.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-provider">Payment Provider</Label>
              <Select
                value={selectedOrgProvider}
                onValueChange={(value) =>
                  setSelectedOrgProvider(value as "stripe" | "razorpay" | "payu" | "default")
                }
              >
                <SelectTrigger id="org-provider" className="w-full">
                  <SelectValue placeholder="Select a payment provider" />
                </SelectTrigger>
                <SelectContent>
                  {editingOrg && (
                    <SelectItem value="default">Use Default (Country/Global)</SelectItem>
                  )}
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                  <SelectItem value="payu">PayU</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {editingOrg
                  ? 'This provider will override country-specific and default settings for this organization. Select "Use Default" to remove the override.'
                  : "This provider will override country-specific and default settings for this organization."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOrgDialogOpen(false);
                resetOrgForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveOrg}
              disabled={
                updateOrgPaymentProviderMutation.isPending ||
                !selectedOrgId ||
                (!editingOrg && (selectedOrgProvider === "default" || !selectedOrgProvider))
              }
            >
              <Save className="h-4 w-4 mr-2" />
              {updateOrgPaymentProviderMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
