import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Buildings,
  ImageSquare,
  FloppyDisk,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { adminClient } from "~/lib/adminClient";
import { AddCreditsDialog } from "./AddCreditsDialog";
import type { OrganizationType, WalletData } from "./types";

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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState<
    "stripe" | "razorpay" | "payu" | null | ""
  >("");
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form values when organization data loads
  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || "");
      setOrgDescription(organization.description || "");
      setLogoPreview(organization.logoUrl || null);
      setHasChanges(false);
    }
  }, [organization]);

  // Track changes
  useEffect(() => {
    if (organization) {
      const nameChanged = orgName !== (organization.name || "");
      const descChanged = orgDescription !== (organization.description || "");
      const logoChanged = logoFile !== null;
      setHasChanges(nameChanged || descChanged || logoChanged);
    }
  }, [orgName, orgDescription, logoFile, organization]);

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
      adminClient.get<{
        success: boolean;
        paymentProvider: "stripe" | "razorpay" | "payu" | null;
      }>(`/api/admin/organizations/${organization?.id}/payment-provider`),
    enabled: !!organization?.id,
  });

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await adminClient.put<{
        success: boolean;
        message: string;
        organization: OrganizationType;
      }>(`/api/admin/organizations/${organization?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations"],
      });
      toast.success("Organization settings have been updated successfully.");
      setLogoFile(null);
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update organization"
      );
    },
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return await adminClient.post<{
        success: boolean;
        url: string;
        message: string;
      }>("/api/admin/upload-image", {
        type: "organization",
        entityId: organization?.id,
        imageData: base64,
        imageName: file.name,
        imageType: file.type,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations"],
      });
      setLogoPreview(data.url);
      setLogoFile(null);
      toast.success("Organization logo has been updated successfully.");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to upload logo"
      );
    },
  });

  // Update payment provider mutation
  const updatePaymentProviderMutation = useMutation({
    mutationFn: async (provider: "stripe" | "razorpay" | "payu" | null) => {
      return await adminClient.put<{
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
      toast.success("Payment provider has been updated successfully.");
      setSelectedPaymentProvider("");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update payment provider"
      );
    },
  });

  // Handle file selection
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        // Validate file type
        const validTypes = [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/gif",
          "image/webp",
          "image/svg+xml",
        ];
        if (!validTypes.includes(file.type)) {
          toast.error("Please select a valid image file (PNG, JPEG, GIF, WebP, or SVG)");
          return;
        }
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error("Image size must be less than 5MB");
          return;
        }
        setLogoFile(file);
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    []
  );

  // Handle save
  const handleSave = async () => {
    if (!organization) return;

    // Upload logo first if there's a new one
    if (logoFile) {
      await uploadLogoMutation.mutateAsync(logoFile);
    }

    // Update organization details
    await updateOrgMutation.mutateAsync({
      name: orgName,
      description: orgDescription,
    });
  };

  // Handle cancel
  const handleCancel = () => {
    if (organization) {
      setOrgName(organization.name || "");
      setOrgDescription(organization.description || "");
      setLogoPreview(organization.logoUrl || null);
      setLogoFile(null);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>

        {/* Form skeleton */}
        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-16 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <Card className="bg-surface-1 border-subtle">
        <CardContent className="py-8">
          <div className="text-center text-tertiary">
            <Buildings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No organization found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-primary tracking-[-0.56px] leading-[1.2]">
          General Settings
        </h1>
        <p className="text-[15px] text-secondary mt-2 tracking-[-0.3px] leading-[1.5]">
          Manage your organization's profile and settings
        </p>
      </div>

      <div className="space-y-8 w-full">
        {/* Main Settings */}
        <div className="space-y-8">
          {/* Organization Settings Card */}
          <Card className="bg-surface-1 border border-subtle rounded-[16px] overflow-hidden">
            <CardContent className="p-8 space-y-8">
              {/* Organization Name */}
              <div className="space-y-3">
                <Label
                  htmlFor="org-name"
                  className="text-[14px] font-medium text-secondary tracking-[-0.28px]"
                >
                  Organization Name
                </Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter organization name"
                  className="h-12 bg-surface-2 border-subtle text-primary placeholder:text-tertiary text-[15px] rounded-lg focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                />
                <p className="text-[13px] text-tertiary tracking-[-0.26px]">
                  Your full Organization name, as visible to others.
                </p>
              </div>

              {/* Organization Icon */}
              <div className="space-y-3">
                <Label className="text-[14px] font-medium text-secondary tracking-[-0.28px]">
                  Organization Icon
                </Label>
                <div className="flex items-start gap-4">
                  {/* Logo Preview / Upload Area */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group w-[72px] h-[72px] rounded-xl overflow-hidden border-2 border-dashed border-subtle hover:border-[#7b4cff] transition-all duration-200 bg-surface-2 flex items-center justify-center cursor-pointer"
                  >
                    {logoPreview ? (
                      <>
                        <img
                          src={logoPreview}
                          alt="Organization logo"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageSquare className="h-5 w-5 text-white" weight="fill" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-tertiary group-hover:text-[#7b4cff] transition-colors">
                        <ImageSquare className="h-6 w-6" />
                      </div>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="flex-1">
                    <p className="text-[13px] text-tertiary tracking-[-0.26px] leading-[1.5]">
                      Upload an image or pick an emoji that best represents your
                      Organization. Recommended size is 256x256px.
                    </p>
                    {logoFile && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-[#7b4cff]/10 text-[#7b4cff] border-[#7b4cff]/20"
                        >
                          New image selected
                        </Badge>
                        <button
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview(organization.logoUrl || null);
                          }}
                          className="text-tertiary hover:text-error-500 transition-colors"
                        >
                          <X className="h-4 w-4" weight="bold" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Organization Description */}
              <div className="space-y-3">
                <Label
                  htmlFor="org-description"
                  className="text-[14px] font-medium text-secondary tracking-[-0.28px]"
                >
                  Organization Description
                </Label>
                <Textarea
                  id="org-description"
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Describe your organization..."
                  rows={3}
                  className="bg-surface-2 border-subtle text-primary placeholder:text-tertiary text-[15px] rounded-lg focus:border-[#7b4cff] focus:ring-[#7b4cff]/20 resize-none"
                />
                <p className="text-[13px] text-tertiary tracking-[-0.26px]">
                  Short description about your Organization or team.
                </p>
              </div>

              {/* Allowed Domains + Payment Provider (side-by-side on desktop) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Allowed Domains */}
                <div className="space-y-3">
                  <Label className="text-[14px] font-medium text-secondary tracking-[-0.28px]">
                    Allowed Domains
                  </Label>
                  <p className="text-[13px] text-tertiary tracking-[-0.26px]">
                    Email domains allowed for this organization
                  </p>
                  <div className="mt-3">
                    {organization.allowedDomains.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {organization.allowedDomains.map((domain, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-[13px] px-3 py-1.5 bg-surface-2 text-secondary border-subtle rounded-lg"
                          >
                            {domain}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[14px] text-tertiary">
                        No domain restrictions (all domains allowed)
                      </p>
                    )}
                  </div>
                </div>

                {/* Payment Provider */}
                <div className="space-y-3 lg:border-l lg:border-subtle lg:pl-8">
                  <Label
                    htmlFor="payment-provider"
                    className="text-[14px] font-medium text-secondary tracking-[-0.28px]"
                  >
                    Payment Provider
                  </Label>
                  <p className="text-[13px] text-tertiary tracking-[-0.26px]">
                    Select the payment provider for your organization
                  </p>

                  <div className="space-y-3 pt-1">
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
                      <SelectTrigger
                        id="payment-provider"
                        className="h-12 w-full bg-surface-2 border-subtle text-primary rounded-lg"
                      >
                        <SelectValue placeholder="Select payment provider" />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-1 border-subtle">
                        <SelectItem value="none">Use System Default</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="razorpay">Razorpay</SelectItem>
                        <SelectItem value="payu">PayU</SelectItem>
                      </SelectContent>
                    </Select>

                    <p className="text-[13px] text-tertiary tracking-[-0.26px]">
                      {paymentProviderData?.paymentProvider
                        ? `Current: ${
                            paymentProviderData.paymentProvider
                              .charAt(0)
                              .toUpperCase() +
                            paymentProviderData.paymentProvider.slice(1)
                          }`
                        : "Current: System Default"}
                    </p>

                    <Button
                      onClick={() => {
                        const currentProvider =
                          paymentProviderData?.paymentProvider ?? null;
                        const newProvider =
                          selectedPaymentProvider === ""
                            ? currentProvider
                            : selectedPaymentProvider;
                        if (newProvider !== currentProvider) {
                          updatePaymentProviderMutation.mutate(
                            newProvider ?? null
                          );
                        }
                      }}
                      disabled={
                        updatePaymentProviderMutation.isPending ||
                        selectedPaymentProvider === "" ||
                        selectedPaymentProvider ===
                          paymentProviderData?.paymentProvider
                      }
                      className="h-11 px-6 bg-[#7b4cff] hover:bg-[#8c63f2] text-white font-medium rounded-lg transition-all duration-200 w-fit"
                    >
                      <FloppyDisk className="h-4 w-4 mr-2" weight="fill" />
                      {updatePaymentProviderMutation.isPending
                        ? "Saving..."
                        : "Save Payment Provider"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4 border-t border-subtle">
                <Button
                  onClick={handleSave}
                  disabled={
                    !hasChanges ||
                    updateOrgMutation.isPending ||
                    uploadLogoMutation.isPending
                  }
                  className="h-11 px-8 bg-gradient-to-r from-[#7b4cff] to-[#a855f7] hover:from-[#8c63f2] hover:to-[#b566f8] text-white font-medium rounded-lg shadow-lg shadow-[#7b4cff]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateOrgMutation.isPending || uploadLogoMutation.isPending
                    ? "Saving..."
                    : "Save Changes"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={
                    !hasChanges ||
                    updateOrgMutation.isPending ||
                    uploadLogoMutation.isPending
                  }
                  className="h-11 px-6 text-secondary hover:text-primary hover:bg-surface-2 font-medium rounded-lg transition-all duration-200"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
