import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, Plus, CreditCard, Save } from "lucide-react";
import { DashboardHeader } from "./DashboardHeader";
import { AddCreditsDialog } from "./AddCreditsDialog";
import { OrganizationType, WalletData } from "./types";
import { client } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface OrgAdminDashboardProps {
  organization: OrganizationType | undefined;
  walletData: WalletData | undefined;
  isLoading: boolean;
  addCreditsDialogOpen: boolean;
  creditAmount: string;
  onAddCreditsDialogChange: (open: boolean) => void;
  onCreditAmountChange: (value: string) => void;
  onAddCredits: () => void;
  isAddingCredits: boolean;
}

export function OrgAdminDashboard({
  organization,
  walletData,
  isLoading,
  addCreditsDialogOpen,
  creditAmount,
  onAddCreditsDialogChange,
  onCreditAmountChange,
  onAddCredits,
  isAddingCredits,
}: OrgAdminDashboardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState<
    "stripe" | "razorpay" | "payu" | null | ""
  >("");

  // Fetch payment provider
  const { data: paymentProviderData } = useQuery<{
    success: boolean;
    paymentProvider: "stripe" | "razorpay" | "payu" | null;
  }>({
    queryKey: [
      "/api/admin/organizations",
      organization?.id,
      "payment-provider",
    ],
    queryFn: () =>
      client.get<{
        success: boolean;
        paymentProvider: "stripe" | "razorpay" | "payu" | null;
      }>(`/api/admin/organizations/${organization?.id}/payment-provider`),
    enabled: !!organization?.id,
  });

  // Update payment provider mutation
  const updatePaymentProviderMutation = useMutation({
    mutationFn: async (provider: "stripe" | "razorpay" | "payu" | null) => {
      return await client.put<{
        success: boolean;
        message: string;
        paymentProvider: "stripe" | "razorpay" | "payu" | null;
      }>(`/api/admin/organizations/${organization?.id}/payment-provider`, {
        paymentProvider: provider,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "/api/admin/organizations",
          organization?.id,
          "payment-provider",
        ],
      });
      toast({
        title: "Payment Provider Updated",
        description: "Payment provider has been updated successfully.",
      });
      setSelectedPaymentProvider("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to update payment provider",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading organization...</div>;
  }

  if (!organization) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <p>No organization found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <DashboardHeader subtitle={organization.name} />
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Organization Details */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>
              Basic information about your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              <p className="text-base font-medium mt-1">{organization.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Description
              </label>
              <p className="text-base mt-1">
                {organization.description || "No description provided"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Status
              </label>
              <div className="mt-1">
                <Badge
                  variant={
                    organization.status === "active" ? "default" : "secondary"
                  }
                >
                  {organization.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Wallet Balance</CardTitle>
                <CardDescription>
                  Current credits available for your organization
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLocation(`/admin/organizations/${organization.id}/wallet`)
                }
              >
                <Wallet className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-3xl font-bold text-primary">
                  ${walletData?.balance?.toFixed(2) || "0.00"}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {walletData?.balance || 0} credits available
                </p>
              </div>
              <Button onClick={() => onAddCreditsDialogChange(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Credits
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Provider Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Provider
            </CardTitle>
            <CardDescription>
              Select the payment provider for your organization. If not set, the
              system default will be used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-provider">Payment Provider</Label>
              <Select
                value={
                  selectedPaymentProvider ||
                  paymentProviderData?.paymentProvider ||
                  ""
                }
                onValueChange={(value) => {
                  if (value === "none") {
                    setSelectedPaymentProvider(null);
                  } else {
                    setSelectedPaymentProvider(
                      value as "stripe" | "razorpay" | "payu"
                    );
                  }
                }}
              >
                <SelectTrigger id="payment-provider" className="w-full">
                  <SelectValue placeholder="Select payment provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use System Default</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                  <SelectItem value="payu">PayU</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {paymentProviderData?.paymentProvider
                  ? `Current: ${paymentProviderData.paymentProvider.charAt(0).toUpperCase() + paymentProviderData.paymentProvider.slice(1)}`
                  : "Current: System Default"}
              </p>
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={() => {
                  const currentProvider = paymentProviderData?.paymentProvider ?? null;
                  const newProvider =
                    selectedPaymentProvider === ""
                      ? currentProvider
                      : selectedPaymentProvider;
                  if (newProvider !== currentProvider) {
                    updatePaymentProviderMutation.mutate(newProvider ?? null);
                  }
                }}
                disabled={
                  updatePaymentProviderMutation.isPending ||
                  selectedPaymentProvider === "" ||
                  selectedPaymentProvider === paymentProviderData?.paymentProvider
                }
              >
                <Save className="h-4 w-4 mr-2" />
                {updatePaymentProviderMutation.isPending
                  ? "Saving..."
                  : "Save Payment Provider"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Allowed Domains */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Allowed Domains</CardTitle>
            <CardDescription>
              Email domains allowed for this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {organization.allowedDomains.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {organization.allowedDomains.map((domain, idx) => (
                  <Badge key={idx} variant="secondary" className="text-sm">
                    {domain}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No domain restrictions (all domains allowed)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <AddCreditsDialog
        open={addCreditsDialogOpen}
        onOpenChange={onAddCreditsDialogChange}
        amount={creditAmount}
        onAmountChange={onCreditAmountChange}
        isLoading={isAddingCredits}
        onSubmit={onAddCredits}
      />
    </>
  );
}

