import { useState } from "react";
import { Settings2, Loader2, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { OPENROUTER_MODELS } from "../consts/models";
import { cn } from "../lib/utils";

interface MessageModelSelectorProps {
  messageId: string;
  conversationId: string;
  currentModel?: string;
  onModelChange?: (messageId: string, newModel: string) => void;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Component to display and change the model for a specific message
 */
export function MessageModelSelector({
  messageId,
  conversationId,
  currentModel,
  onModelChange,
  className,
  size = "sm",
}: MessageModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState(currentModel || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleModelChange = async (newModel: string) => {
    if (newModel === currentModel) return;
    
    setSelectedModel(newModel);
    setIsUpdating(true);

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateMessageModel",
          conversationId,
          messageId,
          model: newModel,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update message model");
      }

      // Show success indicator
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

      // Call the callback if provided
      onModelChange?.(messageId, newModel);
    } catch (error) {
      console.error("Error updating message model:", error);
      // Revert to original model on error
      setSelectedModel(currentModel || "");
    } finally {
      setIsUpdating(false);
    }
  };

  // Format model name for display
  const getModelDisplayName = (modelId: string) => {
    const model = OPENROUTER_MODELS.find((m) => m.id === modelId);
    return model ? model.name : modelId.split("/").pop() || modelId;
  };

  if (!currentModel && !selectedModel) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select
        value={selectedModel}
        onValueChange={handleModelChange}
        disabled={isUpdating}
      >
        <SelectTrigger
          className={cn(
            "h-6 border-0 bg-transparent text-muted-foreground hover:text-foreground focus:ring-0 p-0",
            size === "sm" ? "text-[10px] px-1.5" : "text-xs px-2",
            isUpdating && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-1.5">
            {isUpdating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : showSuccess ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Settings2 className="w-3 h-3" />
            )}
            <SelectValue>
              {selectedModel ? getModelDisplayName(selectedModel) : "No model"}
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className="bg-background/95 border border-border/50 backdrop-blur-sm">
          {OPENROUTER_MODELS.map((model) => (
            <SelectItem
              key={model.id}
              value={model.id}
              className="text-foreground hover:bg-primary/20"
            >
              <div className="flex flex-col">
                <span className="text-sm">{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  {model.provider}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

