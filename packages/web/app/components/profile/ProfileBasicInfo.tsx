import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Pencil, Check, X, Loader2 } from "lucide-react";

interface ProfileBasicInfoProps {
  name: string;
  email: string;
  onNameUpdate: (name: string) => Promise<void>;
}

export function ProfileBasicInfo({
  name,
  email,
  onNameUpdate,
}: ProfileBasicInfoProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      setError("Name cannot be empty");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onNameUpdate(editedName.trim());
      setIsEditingName(false);
    } catch (err: any) {
      setError(err.message || "Failed to update name");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelName = () => {
    setIsEditingName(false);
    setEditedName(name || "");
    setError(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Name Field */}
      <div>
        <label className="text-sm text-tertiary">Name</label>
        {isEditingName ? (
          <div className="mt-1 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="flex-1 bg-surface-2/50 border-subtle text-secondary"
                placeholder="Enter your name"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") handleCancelName();
                }}
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSaveName}
                disabled={isLoading}
                className="h-9 w-9 text-green-500 hover:text-green-400 hover:bg-green-500/10"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancelName}
                disabled={isLoading}
                className="h-9 w-9 text-red-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg border border-subtle bg-surface-2/50 text-secondary">
              {name || "—"}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setEditedName(name || "");
                setIsEditingName(true);
              }}
              className="h-9 w-9 text-tertiary hover:text-primary"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Email Field */}
      <div>
        <label className="text-sm text-tertiary">Email</label>
        <div className="mt-1">
          <div className="px-3 py-2 rounded-lg border border-subtle bg-surface-2/50 text-secondary">
            {email || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
