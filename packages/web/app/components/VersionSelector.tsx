import { SpinnerGap, Rocket, ArrowCounterClockwise, ArrowRight } from "@phosphor-icons/react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

interface VersionSelectorProps {
  versions: Array<{ id: string; label: string }>;
  currentVersionId?: string | null;
  isRestoring?: boolean;
  onSelect?: (versionId: string) => void;
  onRestore?: () => void;
  onGoToLatest?: () => void;
  canRestore?: boolean;
  isOnLatest?: boolean;
  /** Revert to selected version - makes it the new latest */
  onRevertToVersion?: (versionId: string) => void;
  /** Deploy a specific version */
  onDeployVersion?: (versionId: string) => void;
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
  onRevertToVersion,
  onDeployVersion,
}: VersionSelectorProps) {
  const fallbackValue =
    currentVersionId ??
    (versions.length > 0 ? versions[versions.length - 1]?.id : undefined);
  const showRestoreControls =
    !isOnLatest && versions.length > 0 && (onRestore || onGoToLatest);
  
  // Get current selected version info
  const selectedVersion = versions.find((v) => v.id === currentVersionId);
  const latestVersionId = versions.length > 0 ? versions[versions.length - 1]?.id : null;
  const isViewingOlderVersion = currentVersionId && currentVersionId !== latestVersionId;

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
          {versions.map((version, index) => (
            <SelectItem
              key={version.id}
              value={version.id}
              className="rounded-lg"
            >
              {version.label}
              {index === versions.length - 1 && " (Latest)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {isRestoring && (
        <SpinnerGap className="w-4 h-4 animate-spin text-purple-400" />
      )}
      
      {/* Version Actions Dropdown */}
      {versions.length > 0 && currentVersionId && (onRevertToVersion || onDeployVersion) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
              disabled={isRestoring}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-surface-1/95 backdrop-blur-xl border-border/50 shadow-xl shadow-black/20 rounded-xl"
          >
            {/* Deploy this version to Vercel */}
            {onDeployVersion && (
              <DropdownMenuItem
                onClick={() => onDeployVersion(currentVersionId)}
                className="gap-2 cursor-pointer rounded-md mx-1 my-0.5 text-sm"
              >
                <Rocket className="w-4 h-4 text-green-400" />
                <span>Deploy to Vercel</span>
              </DropdownMenuItem>
            )}
            
            {/* Revert to this version (only show for older versions) */}
            {isViewingOlderVersion && onRevertToVersion && (
              <>
                <DropdownMenuSeparator className="bg-border/30" />
                <DropdownMenuItem
                  onClick={() => onRevertToVersion(currentVersionId)}
                  className="gap-2 cursor-pointer rounded-md mx-1 my-0.5 text-sm text-amber-400 hover:text-amber-300"
                >
                  <ArrowCounterClockwise className="w-4 h-4" />
                  <span>Revert to {selectedVersion?.label}</span>
                </DropdownMenuItem>
              </>
            )}
            
            {/* Go to latest (only show for older versions) */}
            {isViewingOlderVersion && onGoToLatest && (
              <DropdownMenuItem
                onClick={() => onGoToLatest()}
                className="gap-2 cursor-pointer rounded-md mx-1 my-0.5 text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Go to Latest</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      {/* Legacy restore controls (can be removed if dropdown is sufficient) */}
      {showRestoreControls && !onRevertToVersion && (
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
