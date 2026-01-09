import { SpinnerGap, Upload, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
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
import { cn } from "~/lib/utils";
import type { ProjectType } from "./index";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectType | null;
  projectName: string;
  projectDescription: string;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onStatusChange: (status: string) => void;
  onSubmit: (imageData?: {
    imageData: string;
    imageName: string;
    imageType: string;
  }) => void;
  onReset: () => void;
  isLoading: boolean;
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  projectName,
  projectDescription,
  onProjectNameChange,
  onProjectDescriptionChange,
  onStatusChange,
  onSubmit,
  onReset,
  isLoading,
}: EditProjectDialogProps) {
  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(project?.imageUrl || null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    }, 200);
  };

  const handleSubmit = () => {
    if (imageData && imageName && imageType) {
      onSubmit({
        imageData,
        imageName,
        imageType,
      });
    } else {
      onSubmit();
    }
  };

  const canSubmit = projectName.trim().length > 0;

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
              Edit Project
            </DialogTitle>
            <button
              onClick={handleClose}
              className="p-1 text-secondary hover:text-primary transition-colors"
            >
              <X className="w-5 h-5" weight="bold" />
            </button>
          </div>
          <div className="h-px bg-border-subtle" />
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto max-h-[50vh]">
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
            {imagePreview ? (
              <div className="relative group">
                <img
                  src={imagePreview}
                  alt="Project preview"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg hover:bg-black/70 transition-colors"
                >
                  <X size={16} className="text-white" weight="bold" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className={cn(
                  "w-full h-32 rounded-lg border-2 border-dashed border-subtle",
                  "flex flex-col items-center justify-center gap-2",
                  "bg-surface-2 hover:bg-surface-1 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isUploadingImage ? (
                  <>
                    <SpinnerGap size={24} className="text-secondary animate-spin" />
                    <span className="typography-body text-secondary">
                      Uploading...
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-secondary" weight="fill" />
                    <span className="typography-body text-secondary">
                      Click to upload image
                    </span>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <Label className="typography-tiny text-secondary px-1">
              Status
            </Label>
            <Select
              value={project?.status || "active"}
              onValueChange={onStatusChange}
            >
              <SelectTrigger className="bg-surface-2 border-subtle h-10 px-3 typography-body text-primary rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-1 border-subtle">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-subtle">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex items-center justify-center h-10 px-5 rounded-lg typography-body font-medium text-secondary hover:text-primary transition-colors"
          >
            Cancel
          </button>
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
                Updating...
              </>
            ) : (
              "Update"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

