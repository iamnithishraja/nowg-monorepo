import { SpinnerGap, Upload, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { adminClient } from "~/lib/adminClient";
import type { OrganizationType } from "./types";

// Step indicator component
function StepIndicator({
  step,
  currentStep,
  label,
}: {
  step: number;
  currentStep: number;
  label: string;
}) {
  const isActive = step === currentStep;
  const isCompleted = step < currentStep;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-full typography-tiny font-medium transition-colors",
          isActive && "bg-accent-primary text-primary",
          isCompleted && "bg-accent-primary/20 text-accent-primary",
          !isActive && !isCompleted && "bg-surface-2 text-tertiary"
        )}
      >
        {step}
      </div>
      <span
        className={cn(
          "typography-small font-medium transition-colors",
          isActive && "text-primary",
          !isActive && "text-tertiary"
        )}
      >
        {label}
      </span>
    </div>
  );
}

interface AvailableUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectDescription: string;
  organizationId: string;
  organizations: OrganizationType[];
  isOrgAdmin: boolean;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onOrganizationIdChange: (value: string) => void;
  onSubmit: (data: {
    imageData?: string;
    imageName?: string;
    imageType?: string;
    projectAdminId: string;
    initialFunding: number;
  }) => void;
  onReset: () => void;
  isLoading: boolean;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  projectName,
  projectDescription,
  organizationId,
  organizations,
  isOrgAdmin,
  onProjectNameChange,
  onProjectDescriptionChange,
  onOrganizationIdChange,
  onSubmit,
  onReset,
  isLoading,
}: CreateProjectDialogProps) {
  // Wizard step state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 - Credits state
  const [loadProjectCredits, setLoadProjectCredits] = useState("");
  
  // Step 3 - Project Admin state
  const [projectAdminId, setProjectAdminId] = useState("");

  // Fetch org wallet balance
  const { data: orgWalletData } = useQuery({
    queryKey: ["/api/admin/org-wallets", organizationId],
    queryFn: () =>
      adminClient.get<{ wallet: { balance: number } }>(
        `/api/admin/org-wallets/${organizationId}`
      ),
    enabled: !!organizationId && open,
  });

  const totalAvailableCredits = orgWalletData?.wallet?.balance || 0;
  const creditsRemaining = totalAvailableCredits - (parseFloat(loadProjectCredits) || 0);

  // Fetch available users for project admin assignment
  const { data: availableUsersData, isLoading: isLoadingUsers } = useQuery<{
    users: AvailableUser[];
  }>({
    queryKey: [
      "/api/admin/organizations/:organizationId/available-users",
      "for-admin",
      organizationId,
    ],
    queryFn: () =>
      adminClient.get<{ users: AvailableUser[] }>(
        `/api/admin/organizations/${organizationId}/available-users`,
        {
          params: {
            forAdmin: "true",
          },
        }
      ),
    enabled: !!organizationId && open,
  });

  const selectedAdmin = availableUsersData?.users?.find(
    (u) => u.id === projectAdminId
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      alert("Please select a valid image file (PNG, JPEG, GIF, or WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      setImageData(result);
      setImageName(file.name);
      setImageType(file.type);
      setIsUploadingImage(false);
    };
    reader.onerror = () => {
      setIsUploadingImage(false);
      alert("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageData(null);
    setImageName(null);
    setImageType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      onReset();
      handleRemoveImage();
      setCurrentStep(1);
      setLoadProjectCredits("");
      setProjectAdminId("");
    }, 200);
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    const initialFunding = parseFloat(loadProjectCredits) || 0;
    
    if (!projectAdminId) {
      return; // Should not happen due to validation, but safety check
    }

    onSubmit({
      imageData: imageData || undefined,
      imageName: imageName || undefined,
      imageType: imageType || undefined,
      projectAdminId,
      initialFunding,
    });
  };

  const canProceedStep1 =
    projectName.trim().length > 0 && (isOrgAdmin || organizationId);
  
  const canProceedStep2 = 
    loadProjectCredits === "" || 
    (parseFloat(loadProjectCredits) >= 0 && parseFloat(loadProjectCredits) <= totalAvailableCredits);
  
  const canProceedStep3 = !!projectAdminId;
  
  const canSubmit = canProceedStep1 && canProceedStep2 && canProceedStep3;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[560px] p-0 bg-surface-1 border-subtle rounded-xl overflow-hidden"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex flex-col gap-4 px-6 pt-6">
          <div className="flex items-start justify-between">
            <DialogTitle className="typography-display text-primary">
              Create Project
            </DialogTitle>
            <button
              onClick={handleClose}
              className="p-1 text-secondary hover:text-primary transition-colors"
            >
              <X className="w-5 h-5" weight="bold" />
            </button>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center gap-4">
            <StepIndicator step={1} currentStep={currentStep} label="Details" />
            <div className="w-6 h-px bg-border-subtle" />
            <StepIndicator step={2} currentStep={currentStep} label="Credits" />
            <div className="w-6 h-px bg-border-subtle" />
            <StepIndicator
              step={3}
              currentStep={currentStep}
              label="Project Admin"
            />
          </div>

          <div className="h-px bg-border-subtle" />
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto max-h-[50vh]">
          {/* Step 1: Details */}
          {currentStep === 1 && (
            <>
              {/* Organization Select - only for non-org admins */}
              {!isOrgAdmin && (
                <div className="flex flex-col gap-1.5">
                  <Label className="typography-tiny text-secondary px-1">
                    Organization *
                  </Label>
                  <Select
                    value={organizationId}
                    onValueChange={onOrganizationIdChange}
                  >
                    <SelectTrigger className="bg-surface-2 border-subtle h-10 px-3 typography-body text-primary rounded-lg">
                      <SelectValue placeholder="Select an organization" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-1 border-subtle">
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Organization display for org admins */}
              {isOrgAdmin && organizations.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label className="typography-tiny text-secondary px-1">
                    Organization
                  </Label>
                  <div className="bg-surface-2 border border-subtle h-10 px-3 flex items-center rounded-lg">
                    <span className="typography-body text-primary">
                      {organizations[0].name}
                    </span>
                  </div>
                </div>
              )}

              {/* Project Name */}
              <div className="flex flex-col gap-1.5">
                <Label className="typography-tiny text-secondary px-1">
                  Name *
                </Label>
                <Input
                  value={projectName}
                  onChange={(e) => onProjectNameChange(e.target.value)}
                  placeholder="Enter project name"
                  className="bg-surface-2 border-subtle h-10 px-3 typography-body text-primary placeholder:text-tertiary rounded-lg"
                />
              </div>

              {/* Project Description */}
              <div className="flex flex-col gap-1.5">
                <Label className="typography-tiny text-secondary px-1">
                  Description
                </Label>
                <Input
                  value={projectDescription}
                  onChange={(e) => onProjectDescriptionChange(e.target.value)}
                  placeholder="Short description about your project"
                  className="bg-surface-2 border-subtle h-10 px-3 typography-body text-primary placeholder:text-tertiary rounded-lg"
                />
              </div>

              {/* Project Image Upload */}
              <div className="flex flex-col gap-1.5">
                <Label className="typography-tiny text-secondary px-1">
                  Project Image
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border border-subtle">
                    <img
                      src={imagePreview}
                      alt="Project preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-canvas/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-surface-1/90 typography-small text-primary rounded-md hover:bg-surface-2 transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="px-3 py-1.5 bg-error-500/90 typography-small text-primary rounded-md hover:bg-error-400 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 w-full h-32 rounded-lg border-2 border-dashed border-active",
                      "bg-surface-2 hover:border-accent-primary/50 hover:bg-surface-2/80 transition-colors",
                      isUploadingImage && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {isUploadingImage ? (
                      <SpinnerGap className="w-6 h-6 text-secondary animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-secondary" weight="fill" />
                        <span className="typography-small text-secondary">
                          Click to upload image
                        </span>
                        <span className="typography-tiny text-tertiary">
                          PNG, JPEG, GIF, WebP (max 5MB)
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Helper text */}
              <p className="typography-small text-tertiary px-1">
                Build your app in minutes using AI-based Nowg tools and
                frameworks.
              </p>

              {/* File browser link */}
              <div className="flex items-center gap-2 px-1">
                <Upload className="w-4 h-4 text-accent-primary" weight="fill" />
                <span className="typography-small text-accent-primary cursor-pointer hover:underline">
                  Upload from File Browser
                </span>
              </div>
            </>
          )}

          {/* Step 2: Credits */}
          {currentStep === 2 && (
            <>
              {/* Project Name */}
              <div className="flex items-center justify-between py-3 px-2">
                <Label className="typography-body text-secondary">
                  Project Name
                </Label>
                <span className="typography-body text-accent-primary font-medium">
                  {projectName || "-"}
                </span>
              </div>

              <div className="h-px bg-border-subtle" />

              {/* Net Credits Available */}
              <div className="flex items-center justify-between py-3 px-2">
                <Label className="typography-body text-secondary">
                  Net Credits Available
                </Label>
                <span className="typography-body text-primary font-medium">
                  ${totalAvailableCredits.toLocaleString()}
                </span>
              </div>
              
              {totalAvailableCredits === 0 && (
                <div className="px-2 py-2 bg-warning-500/10 border border-warning-500/20 rounded-lg">
                  <p className="typography-small text-warning-500">
                    Organization wallet has no credits. You can still create the project and add credits later.
                  </p>
                </div>
              )}

              <div className="h-px bg-border-subtle" />

              {/* Load Project Credits */}
              <div className="flex flex-col gap-3 py-3">
                <Label className="typography-body text-secondary px-1">
                  Load Project Credits (Optional)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={loadProjectCredits}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string or valid number
                      if (value === "" || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                        setLoadProjectCredits(value);
                      }
                    }}
                    type="number"
                    min="0"
                    max={totalAvailableCredits}
                    placeholder="0"
                    className="flex-1 bg-surface-2 border-subtle h-10 px-3 typography-body text-primary placeholder:text-tertiary rounded-lg text-right"
                  />
                </div>

                {/* Quick select buttons */}
                {totalAvailableCredits > 0 && (
                  <div className="flex items-center gap-2 px-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setLoadProjectCredits("500")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg typography-small font-medium transition-colors",
                        loadProjectCredits === "500"
                          ? "bg-accent-primary text-primary"
                          : "bg-surface-2 text-secondary hover:text-primary"
                      )}
                    >
                      500
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoadProjectCredits("1000")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg typography-small font-medium transition-colors",
                        loadProjectCredits === "1000"
                          ? "bg-accent-primary text-primary"
                          : "bg-surface-2 text-secondary hover:text-primary"
                      )}
                    >
                      1000
                    </button>
                    {totalAvailableCredits > 1000 && (
                      <button
                        type="button"
                        onClick={() => setLoadProjectCredits(String(totalAvailableCredits))}
                        className={cn(
                          "px-3 py-1.5 rounded-lg typography-small font-medium transition-colors",
                          loadProjectCredits === String(totalAvailableCredits)
                            ? "bg-accent-primary text-primary"
                            : "bg-surface-2 text-secondary hover:text-primary"
                        )}
                      >
                        Max
                      </button>
                    )}
                  </div>
                )}
                
                {loadProjectCredits && parseFloat(loadProjectCredits) > totalAvailableCredits && (
                  <p className="typography-small text-error-500 px-1">
                    Amount exceeds available credits
                  </p>
                )}
              </div>

              <div className="h-px bg-border-subtle" />

              {/* Credits Remaining */}
              <div className="flex items-center justify-between py-3 px-2">
                <Label className="typography-body text-secondary">
                  Credits Remaining
                </Label>
                <span className="typography-body text-primary font-medium">
                  {creditsRemaining.toLocaleString()}
                </span>
              </div>
            </>
          )}

          {/* Step 3: Project Admin Assignment */}
          {currentStep === 3 && (
            <>
              <div className="flex flex-col gap-4 py-3">
                <Label className="typography-body text-secondary font-medium px-1">
                  Assign Project Admin *
                </Label>
                
                <p className="typography-small text-tertiary px-1">
                  Select a team member from your organization to assign as project admin. 
                  The project admin can manage users and credit usage for this project.
                </p>

                {isLoadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <SpinnerGap className="w-6 h-6 text-secondary animate-spin" />
                  </div>
                ) : (
                  <>
                    {availableUsersData?.users && availableUsersData.users.length > 0 ? (
                      <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                        {availableUsersData.users.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => setProjectAdminId(user.id)}
                            className={cn(
                              "flex items-center gap-3 w-full px-3 py-3 rounded-lg border transition-all text-left",
                              projectAdminId === user.id
                                ? "border-accent-primary bg-accent-primary/10"
                                : "border-subtle bg-surface-2 hover:border-active hover:bg-surface-2/80"
                            )}
                          >
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarFallback className="bg-surface-3 text-xs">
                                {(user.name || user.email).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="typography-body text-primary font-medium truncate">
                                {user.name || user.email}
                              </span>
                              <span className="typography-small text-tertiary truncate">
                                {user.email}
                              </span>
                            </div>
                            {projectAdminId === user.id && (
                              <div className="w-5 h-5 rounded-full bg-accent-primary flex items-center justify-center shrink-0">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"/>
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-6 text-center">
                        <p className="typography-small text-tertiary">
                          No team members available. Please add members to your organization first.
                        </p>
                      </div>
                    )}

                    {!projectAdminId && (
                      <p className="typography-small text-error-500 px-1">
                        Project admin assignment is required
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-t border-subtle">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={isLoading}
                className="flex items-center justify-center h-10 px-5 rounded-lg typography-body font-medium text-secondary hover:text-primary transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="flex items-center justify-center h-10 px-5 rounded-lg typography-body font-medium text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>
            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !canProceedStep1) ||
                  (currentStep === 2 && !canProceedStep2)
                }
                className={cn(
                  "flex items-center justify-center h-10 px-5 rounded-lg typography-body font-medium text-primary transition-all",
                  "bg-gradient-primary",
                  "hover:opacity-90",
                  ((currentStep === 1 && !canProceedStep1) ||
                    (currentStep === 2 && !canProceedStep2)) &&
                    "opacity-50 cursor-not-allowed"
                )}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                className={cn(
                  "flex items-center justify-center h-10 px-5 rounded-lg typography-body font-medium text-primary transition-all",
                  "bg-gradient-primary",
                  "hover:opacity-90",
                  (!canSubmit || isLoading) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <>
                    <SpinnerGap className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
