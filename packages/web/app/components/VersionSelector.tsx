import { SpinnerGap, ArrowCounterClockwise, ArrowRight } from "@phosphor-icons/react";
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
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

interface VersionSelectorProps {
  versions: Array<{ id: string; label: string }>;
  currentVersionId?: string | null;
  isRestoring?: boolean;
  onSelect?: (versionId: string) => void;
  onGoToLatest?: () => void;
  /** Revert to selected version - makes it the new latest */
  onRevertToVersion?: (versionId: string) => void;
}

export function VersionSelector({
  versions,
  currentVersionId,
  isRestoring = false,
  onSelect,
  onGoToLatest,
  onRevertToVersion,
}: VersionSelectorProps) {
  const fallbackValue =
    currentVersionId ??
    (versions.length > 0 ? versions[versions.length - 1]?.id : undefined);
  
  // Get current selected version info
  const selectedVersion = versions.find((v) => v.id === currentVersionId);
  const latestVersionId = versions.length > 0 ? versions[versions.length - 1]?.id : null;
  const isViewingOlderVersion = currentVersionId && currentVersionId !== latestVersionId;

  // Only show dropdown when viewing older version and has actions available
  const showActionsDropdown = isViewingOlderVersion && (onRevertToVersion || onGoToLatest);

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={fallbackValue}
        onValueChange={(value) => onSelect?.(value)}
        disabled={versions.length === 0 || isRestoring}
      >
        <SelectTrigger className="w-[120px] h-8 bg-[#1a1a1a]/80 border border-white/8 text-xs rounded-lg font-medium hover:bg-[#252525] transition-colors">
          <SelectValue placeholder="Version" />
        </SelectTrigger>
        <SelectContent
          align="end"
          className="bg-[#1a1a1a]/95 backdrop-blur-xl border-white/8 rounded-lg shadow-xl"
        >
          {versions.map((version, index) => (
            <SelectItem
              key={version.id}
              value={version.id}
              className="text-xs rounded-md"
            >
              {version.label}
              {index === versions.length - 1 && " (Latest)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {isRestoring && (
        <SpinnerGap className="w-4 h-4 animate-spin text-white/50" />
      )}
      
      {/* Version Actions - only show when viewing older version */}
      {showActionsDropdown && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-8 w-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-50"
              disabled={isRestoring}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[160px] bg-[#1a1a1a]/95 backdrop-blur-xl border-white/8 shadow-xl rounded-lg p-1"
          >
            {/* Revert to this version */}
            {onRevertToVersion && (
              <DropdownMenuItem
                onClick={() => onRevertToVersion(currentVersionId!)}
                className="gap-2 cursor-pointer rounded-md px-2 py-1.5 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 focus:bg-amber-500/10 focus:text-amber-300"
              >
                <ArrowCounterClockwise className="w-3.5 h-3.5" />
                <span>Revert to {selectedVersion?.label}</span>
              </DropdownMenuItem>
            )}
            
            {/* Go to latest */}
            {onGoToLatest && (
              <DropdownMenuItem
                onClick={() => onGoToLatest()}
                className="gap-2 cursor-pointer rounded-md px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/5 focus:bg-white/5 focus:text-white"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Go to Latest</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
