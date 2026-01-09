import { SpinnerGap } from "@phosphor-icons/react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface VersionSelectorProps {
  versions: Array<{ id: string; label: string }>;
  currentVersionId?: string | null;
  isRestoring?: boolean;
  onSelect?: (versionId: string) => void;
  onRestore?: () => void;
  onGoToLatest?: () => void;
  canRestore?: boolean;
  isOnLatest?: boolean;
}

export function VersionSelector({
  versions,
  currentVersionId,
  isRestoring = false,
  onSelect,
  onRestore,
  onGoToLatest,
  canRestore = false,
  isOnLatest = true,
}: VersionSelectorProps) {
  const fallbackValue =
    currentVersionId ??
    (versions.length > 0 ? versions[versions.length - 1]?.id : undefined);
  const showRestoreControls =
    !isOnLatest && versions.length > 0 && (onRestore || onGoToLatest);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={fallbackValue}
        onValueChange={(value) => onSelect?.(value)}
        disabled={versions.length === 0 || isRestoring}
      >
        <SelectTrigger className="w-32 h-9 bg-surface-2/60 border border-border/30 text-xs rounded-xl font-medium hover:bg-surface-3/50 transition-colors">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent
          align="end"
          className="bg-surface-1 border-border/30 rounded-xl"
        >
          {versions.map((version) => (
            <SelectItem
              key={version.id}
              value={version.id}
              className="rounded-lg"
            >
              {version.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isRestoring && (
        <SpinnerGap className="w-4 h-4 animate-spin text-purple-400" />
      )}
      {showRestoreControls && (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 px-3 text-xs whitespace-nowrap rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
            onClick={() => onRestore?.()}
            disabled={!canRestore || isRestoring}
          >
            Restore
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs whitespace-nowrap rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
            onClick={() => onGoToLatest?.()}
            disabled={isRestoring || !onGoToLatest}
          >
            Go to Latest
          </Button>
        </div>
      )}
    </div>
  );
}
