import { useState } from "react";
import { Paperclip, ArrowUp } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface PromptInputProps {
  onSubmit: (prompt: string, model: string) => void;
  placeholder?: string;
  className?: string;
}

const AVAILABLE_MODELS = [
  { value: "claude-4.5-sonnet", label: "claude-4.5-sonnet" },
  { value: "claude-4-sonnet", label: "claude-4-sonnet" },
  { value: "gpt-4", label: "gpt-4" },
  { value: "gpt-3.5-turbo", label: "gpt-3.5-turbo" },
] as const;

interface PromptTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder: string;
}

function PromptTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
}: PromptTextareaProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-white placeholder-gray-500 px-6 py-4 pr-20 min-h-[120px] resize-none border-0 focus-visible:ring-0"
      onKeyDown={onKeyDown}
    />
  );
}

function AttachmentButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-white h-8 w-8"
      aria-label="Attach file"
    >
      <Paperclip className="w-5 h-5" />
    </Button>
  );
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  return (
    <Select value={selectedModel} onValueChange={onModelChange}>
      <SelectTrigger className="w-auto bg-transparent border-0 text-muted-foreground hover:text-foreground focus:ring-0 h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AVAILABLE_MODELS.map((model) => (
          <SelectItem key={model.value} value={model.value}>
            {model.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface SubmitButtonProps {
  disabled: boolean;
}

function SubmitButton({ disabled }: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={disabled}
      size="icon"
      className={cn(
        "h-8 w-8 rounded-lg",
        !disabled
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-muted text-muted-foreground cursor-not-allowed"
      )}
      aria-label="Submit prompt"
    >
      <ArrowUp className="w-5 h-5" />
    </Button>
  );
}

interface BottomBarProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  isSubmitDisabled: boolean;
}

function BottomBar({
  selectedModel,
  onModelChange,
  isSubmitDisabled,
}: BottomBarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-border">
      <div className="flex items-center space-x-4">
        <AttachmentButton />
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={onModelChange}
        />
      </div>
      <SubmitButton disabled={isSubmitDisabled} />
    </div>
  );
}

export default function PromptInput({
  onSubmit,
  placeholder = "build a collaborative project management app with real-time upd",
  className,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("claude-4.5-sonnet");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    onSubmit(prompt, selectedModel);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  const isSubmitDisabled = !prompt.trim();

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="relative bg-muted rounded-2xl border border-border overflow-auto">
        <PromptTextarea
          value={prompt}
          onChange={setPrompt}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />

        <BottomBar
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          isSubmitDisabled={isSubmitDisabled}
        />
      </div>
    </form>
  );
}
