import { ChevronDown, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select";

type Step = "details" | "credits" | "configuration";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  image?: string;
  joinedAt?: Date | string;
}

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: {
    name: string;
    description: string;
    projectAdminId?: string;
    credits: number;
    imageData?: string;
    imageName?: string;
    imageType?: string;
  }) => void;
  teamMembers?: TeamMember[];
  availableCredits?: number;
  isLoading?: boolean;
}

interface StepIndicatorProps {
  step: Step;
  currentStep: Step;
  label: string;
}

function StepIndicator({ step, currentStep, label }: StepIndicatorProps) {
  const steps: Step[] = ["details", "credits", "configuration"];
  const currentIndex = steps.indexOf(currentStep);
  const stepIndex = steps.indexOf(step);
  const isActive = step === currentStep;

  return (
    <div
      className={cn(
        "flex items-center justify-center px-4 py-1 rounded-[20px] transition-colors",
        isActive && "bg-accent-primary/15",
        !isActive && "bg-transparent"
      )}
    >
      <span
        className={cn(
          "text-base font-medium tracking-[-0.32px] leading-[1.4]",
          isActive && "text-accent-hover",
          !isActive && "text-tertiary opacity-50"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function StepConnector() {
  return <div className="w-8 h-0.5 bg-linear-to-r from-subtle to-subtle" />;
}

export function CreateProjectModal({
  open,
  onOpenChange,
  onSubmit,
  teamMembers = [],
  availableCredits = 0,
  isLoading,
}: CreateProjectModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectAdminId, setProjectAdminId] = useState<string>("");
  const [credits, setCredits] = useState(500);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAdmin = teamMembers.find((m) => m.id === projectAdminId);

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

  const handleNext = () => {
    if (currentStep === "details") {
      setCurrentStep("credits");
    } else if (currentStep === "credits") {
      setCurrentStep("configuration");
    } else {
      onSubmit?.({
        name,
        description,
        projectAdminId: projectAdminId || undefined,
        credits,
        imageData: imageData || undefined,
        imageName: imageName || undefined,
        imageType: imageType || undefined,
      });
    }
  };

  const handlePrev = () => {
    if (currentStep === "credits") {
      setCurrentStep("details");
    } else if (currentStep === "configuration") {
      setCurrentStep("credits");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setCurrentStep("details");
      setName("");
      setDescription("");
      setProjectAdminId("");
      setCredits(500);
      setImagePreview(null);
      setImageData(null);
      setImageName(null);
      setImageType(null);
    }, 200);
  };

  const canProceed = () => {
    if (currentStep === "details") return name.trim().length > 0;
    if (currentStep === "credits") return true;
    return true;
  };

  const formatTimeAgo = (date: Date | string | undefined): string => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 1) return "Joined today";
    if (diffDays === 1) return "Joined 1d ago";
    return `Joined ${diffDays}d ago`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[790px] h-[672px] p-0 bg-surface-1 border-subtle rounded-[20px] overflow-hidden"
        showCloseButton={false}
      >
        <div className="flex flex-col gap-3 px-12 pt-10">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-4">
              <DialogTitle className="text-2xl font-medium text-primary tracking-[-0.48px] leading-[1.2]">
                Create Project
              </DialogTitle>

              <div className="flex items-center gap-2">
                <StepIndicator
                  step="details"
                  currentStep={currentStep}
                  label="Details"
                />
                <StepConnector />
                <StepIndicator
                  step="credits"
                  currentStep={currentStep}
                  label="Credits"
                />
                <StepConnector />
                <StepIndicator
                  step="configuration"
                  currentStep={currentStep}
                  label="Configuration"
                />
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1 text-secondary hover:text-primary transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="h-px bg-linear-to-r from-subtle via-subtle to-transparent" />
        </div>

        <div className="flex-1 px-12 py-8 overflow-y-auto">
          {currentStep === "details" && (
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-1.5">
                <Label className="px-1.5 text-xs font-medium text-secondary tracking-[-0.24px] leading-[1.2]">
                  Project Name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter project name"
                  className="bg-surface-2 border-subtle h-11 px-3 text-sm font-medium text-primary placeholder:text-tertiary rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="px-1.5 text-xs font-medium text-secondary tracking-[-0.24px] leading-[1.2]">
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
                  <div className="relative w-full h-[140px] rounded-xl overflow-hidden border border-subtle">
                    <img
                      src={imagePreview}
                      alt="Project preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-surface-1/90 text-sm text-primary rounded-lg hover:bg-surface-2 transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="px-3 py-1.5 bg-red-500/90 text-sm text-white rounded-lg hover:bg-red-600 transition-colors"
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
                      "flex flex-col items-center justify-center gap-2 w-full h-[140px] rounded-xl border-2 border-dashed border-subtle",
                      "bg-surface-2 hover:border-accent-primary/50 hover:bg-surface-2/80 transition-colors",
                      isUploadingImage && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {isUploadingImage ? (
                      <Loader2 className="w-8 h-8 text-secondary animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="w-8 h-8 text-secondary" />
                        <span className="text-sm text-secondary">
                          Click to upload image
                        </span>
                        <span className="text-xs text-tertiary">
                          PNG, JPEG, GIF, WebP (max 5MB)
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="px-1.5 text-xs font-medium text-secondary tracking-[-0.24px] leading-[1.2]">
                  Project Description
                </Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description about your project"
                  className="bg-surface-2 border-subtle h-11 px-3 text-sm font-medium text-primary placeholder:text-tertiary rounded-xl"
                />
                <p className="px-1.5 text-xs font-medium text-tertiary tracking-[-0.24px] leading-[1.2]">
                  Short description about your project.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="px-1.5 text-xs font-medium text-secondary tracking-[-0.24px] leading-[1.2]">
                  Assign Project Admin
                </Label>
                <Select value={projectAdminId} onValueChange={setProjectAdminId}>
                  <SelectTrigger className="bg-surface-2 border-subtle h-11 px-1.5 rounded-xl">
                    {selectedAdmin ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarImage
                            src={selectedAdmin.image}
                            alt={selectedAdmin.name}
                          />
                          <AvatarFallback className="bg-surface-3 text-xs">
                            {selectedAdmin.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-primary">
                          {selectedAdmin.name}
                        </span>
                        {selectedAdmin.joinedAt && (
                          <Badge className="bg-warning-500/20 text-warning-500 text-xs font-medium px-1.5 py-0.5 rounded-lg border-0">
                            {formatTimeAgo(selectedAdmin.joinedAt)}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-tertiary">
                        Select a team member
                      </span>
                    )}
                  </SelectTrigger>
                  <SelectContent className="bg-surface-1 border-subtle">
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={member.image} alt={member.name} />
                            <AvatarFallback className="bg-surface-3 text-xs">
                              {member.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{member.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="px-1.5 text-xs font-medium text-tertiary tracking-[-0.24px] leading-[1.2]">
                  Project admin can add users and manage credit usage
                </p>
              </div>
            </div>
          )}

          {currentStep === "credits" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary tracking-[-0.28px] leading-normal">
                    Project Name
                  </span>
                  <Badge className="bg-accent-primary/15 text-accent-primary text-sm px-1.5 py-0.5 rounded-lg border-0">
                    {name || "Unnamed Project"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary tracking-[-0.28px] leading-normal">
                    Net Credits Available
                  </span>
                  <span className="text-sm text-primary tracking-[-0.28px] leading-normal">
                    ${availableCredits.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-start justify-between">
                  <span className="text-sm text-secondary tracking-[-0.28px] leading-normal">
                    Load Project Credits
                  </span>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={credits}
                        onChange={(e) => setCredits(Number(e.target.value))}
                        className="w-[78px] h-[45px] bg-surface-2 border-subtle text-sm font-bold text-primary text-right px-3 rounded-xl"
                      />
                      <ChevronDown className="w-5 h-5 text-secondary" />
                    </div>
                    <div className="flex items-center gap-1">
                      {[500, 1000].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setCredits(amount)}
                          className="bg-secondary/10 text-secondary text-xs font-medium px-2 py-1 rounded-lg hover:bg-secondary/20 transition-colors"
                        >
                          {amount}
                        </button>
                      ))}
                      <button
                        onClick={() => setCredits(availableCredits)}
                        className="bg-secondary/10 text-secondary text-xs font-medium px-2 py-1 rounded-lg hover:bg-secondary/20 transition-colors"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-linear-to-r from-subtle via-subtle to-transparent" />

              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary tracking-[-0.28px] leading-normal">
                  Credits Remaining
                </span>
                <span className="text-sm font-bold text-primary tracking-[-0.28px] leading-normal">
                  {(availableCredits - credits).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {currentStep === "configuration" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary tracking-[-0.28px] leading-normal">
                    Project Name
                  </span>
                  <span className="text-sm font-medium text-primary tracking-[-0.28px] leading-normal">
                    {name}
                  </span>
                </div>

                {description && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-secondary tracking-[-0.28px] leading-normal">
                      Description
                    </span>
                    <span className="text-sm text-primary tracking-[-0.28px] leading-normal max-w-[400px] truncate">
                      {description}
                    </span>
                  </div>
                )}

                {imagePreview && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-secondary tracking-[-0.28px] leading-normal">
                      Project Image
                    </span>
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-subtle">
                      <img
                        src={imagePreview}
                        alt="Project preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}

                {selectedAdmin && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-secondary tracking-[-0.28px] leading-normal">
                      Project Admin
                    </span>
                    <span className="text-sm font-medium text-primary tracking-[-0.28px] leading-normal">
                      {selectedAdmin.name}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary tracking-[-0.28px] leading-normal">
                    Initial Credits
                  </span>
                  <span className="text-sm font-bold text-primary tracking-[-0.28px] leading-normal">
                    {credits.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 px-8 py-6 border-t border-subtle">
          <button
            onClick={handlePrev}
            disabled={currentStep === "details"}
            className={cn(
              "flex items-center justify-center h-11 w-36 rounded-xl text-base font-medium tracking-[-0.32px] leading-[1.4] transition-colors",
              currentStep === "details"
                ? "text-secondary/50 cursor-not-allowed"
                : "text-secondary hover:text-primary"
            )}
          >
            Prev
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed() || isLoading}
            className={cn(
              "flex items-center justify-center h-11 w-[217px] rounded-xl text-base font-medium text-primary tracking-[-0.32px] leading-[1.4] transition-all",
              "bg-linear-to-r from-[#4208ff] via-[#611bf3] via-[#d30dff] to-[#ff76b9]",
              "border border-accent-primary/15",
              "hover:opacity-90",
              (!canProceed() || isLoading) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isLoading
              ? "Creating..."
              : currentStep === "configuration"
                ? "Create Project"
                : "Next"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


