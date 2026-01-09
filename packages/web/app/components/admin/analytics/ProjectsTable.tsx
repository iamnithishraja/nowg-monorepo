import { CaretDown, ArrowSquareOut, DotsThree, Users, Wallet } from "@phosphor-icons/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip";

export type ProjectStatus = "active" | "completed" | "archived" | "draft";

export interface ProjectTableRow {
  id: string;
  name: string;
  status: ProjectStatus;
  team: { id: string; name?: string; avatar?: string }[];
  createdAt: string;
  creditsUsage: {
    current: number;
    max: number;
    cost: number;
  };
  costToDate: number;
  lastUpdated: string;
  conversationId?: string | null;
}

interface ProjectsTableProps {
  projects: ProjectTableRow[];
  onProjectClick?: (project: ProjectTableRow) => void;
  onRequestRefill?: (project: ProjectTableRow) => void;
}

const statusConfig: Record<ProjectStatus, { label: string; bgColor: string; textColor: string }> = {
  active: {
    label: "Active",
    bgColor: "bg-green-500/15",
    textColor: "text-green-400",
  },
  completed: {
    label: "Completed",
    bgColor: "bg-blue-500/15",
    textColor: "text-blue-400",
  },
  archived: {
    label: "Archived",
    bgColor: "bg-red-500/15",
    textColor: "text-red-400",
  },
  draft: {
    label: "Draft",
    bgColor: "bg-zinc-500/15",
    textColor: "text-zinc-400",
  },
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = statusConfig[status];
  return (
    <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md ${config.bgColor}`}>
      <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
    </div>
  );
}

interface ProgressMeterProps {
  current: number;
  max: number;
  onRequestRefill?: () => void;
}

function ProgressMeter({ current, max, onRequestRefill }: ProgressMeterProps) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  
  // Handle zero usage - show different visual indicator
  if (current === 0 || current < 0.01) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative h-1.5 w-[100px] bg-surface-3 rounded-full overflow-hidden border border-dashed border-subtle">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[2px] h-[2px] rounded-full bg-tertiary"></div>
          </div>
        </div>
      </div>
    );
  }
  
  // For small amounts, use scaling to make them more visible
  let displayPercentage = percentage;
  if (percentage > 0 && percentage < 1) {
    displayPercentage = 15 + (percentage / 1) * 15;
  } else if (percentage >= 1 && percentage < 5) {
    displayPercentage = 30 + ((percentage - 1) / 4) * 20;
  } else if (percentage >= 5 && percentage < 10) {
    displayPercentage = 50 + ((percentage - 5) / 5) * 10;
  } else if (percentage >= 10 && percentage < 20) {
    displayPercentage = 60 + ((percentage - 10) / 10) * 15;
  }
  displayPercentage = Math.min(displayPercentage, 100);
  
  // Color coding based on actual usage percentage
  let barColor = "bg-purple-500";
  let showRefill = false;
  
  if (percentage >= 90) {
    barColor = "bg-red-500";
    showRefill = true;
  } else if (percentage >= 70) {
    barColor = "bg-orange-500";
    showRefill = true;
  } else if (percentage >= 50) {
    barColor = "bg-blue-500";
  }
  
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <div className="relative h-1.5 w-[100px] bg-surface-3 rounded-full overflow-hidden">
              <div
                className={`absolute h-full ${barColor} rounded-full transition-all`}
                style={{ width: `${displayPercentage}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-surface-2 border-subtle">
          <div className="text-xs">
            <p className="text-primary font-medium">${current.toFixed(2)} / ${max.toFixed(2)}</p>
            <p className="text-tertiary">{percentage.toFixed(1)}% Used</p>
          </div>
        </TooltipContent>
      </Tooltip>
      
      {showRefill && onRequestRefill && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRequestRefill();
          }}
          className="text-[10px] font-medium text-purple-400 hover:text-purple-300 whitespace-nowrap px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
        >
          Request Refill
        </button>
      )}
    </div>
  );
}

function TeamAvatars({ team }: { team: ProjectTableRow["team"] }) {
  const displayTeam = team.slice(0, 3);
  const remaining = team.length - 3;
  
  return (
    <div className="flex items-center">
      {displayTeam.map((member, index) => {
        const displayName = member.name || member.id || "?";
        const initials = displayName.charAt(0).toUpperCase();
        return (
          <Avatar
            key={member.id}
            className="size-7 border-2 border-surface-1"
            style={{ marginLeft: index > 0 ? "-10px" : 0, zIndex: displayTeam.length - index }}
          >
            {member.avatar ? (
              <AvatarImage src={member.avatar} alt={displayName} />
            ) : (
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-medium">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
        );
      })}
      {remaining > 0 && (
        <div 
          className="size-7 rounded-full bg-surface-3 border-2 border-surface-1 flex items-center justify-center text-xs text-secondary font-medium"
          style={{ marginLeft: "-10px", zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

export function ProjectsTable({ projects, onProjectClick, onRequestRefill }: ProjectsTableProps) {
  const navigate = useNavigate();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateStr);
  };

  const handleManageMembers = (projectId: string) => {
    navigate(`/admin/projects/${projectId}/members`);
    setOpenMenuId(null);
  };

  const handleManageWallet = (projectId: string) => {
    navigate(`/admin/projects/${projectId}/wallet`);
    setOpenMenuId(null);
  };

  return (
    <div className="flex flex-col w-full border border-subtle rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-surface-2/50">
        <div className="flex items-center gap-2 flex-[1.2] min-w-0 px-4 py-3">
          <span className="text-xs font-medium text-secondary">Project Name</span>
          <CaretDown className="size-3 text-tertiary" weight="bold" />
        </div>
        <div className="flex items-center gap-2 w-24 px-3 py-3">
          <span className="text-xs font-medium text-secondary">Status</span>
          <CaretDown className="size-3 text-tertiary" weight="bold" />
        </div>
        <div className="flex items-center gap-2 w-28 px-3 py-3">
          <span className="text-xs font-medium text-secondary">Team</span>
          <CaretDown className="size-3 text-tertiary" weight="bold" />
        </div>
        <div className="flex items-center gap-2 w-28 px-3 py-3">
          <span className="text-xs font-medium text-secondary">Joined</span>
          <CaretDown className="size-3 text-tertiary" weight="bold" />
        </div>
        <div className="flex items-center gap-2 flex-[1.5] min-w-0 px-3 py-3">
          <span className="text-xs font-medium text-secondary">Credits Usage</span>
          <CaretDown className="size-3 text-tertiary" weight="bold" />
        </div>
        <div className="flex items-center gap-2 w-28 px-3 py-3">
          <span className="text-xs font-medium text-secondary">Cost to-date</span>
          <CaretDown className="size-3 text-tertiary" weight="bold" />
        </div>
        <div className="flex items-center gap-2 w-28 px-3 py-3">
          <span className="text-xs font-medium text-secondary">Last Updated</span>
          <CaretDown className="size-3 text-tertiary" weight="bold" />
        </div>
        <div className="w-10" />
      </div>

      {/* Rows */}
      {projects.map((project, index) => (
        <div
          key={project.id}
          className={`flex items-center hover:bg-surface-2/30 transition-colors ${
            index !== projects.length - 1 ? "border-b border-subtle" : ""
          }`}
        >
          {/* Project Name */}
          <div
            className="flex items-center gap-1.5 flex-[1.2] min-w-0 px-4 py-3 cursor-pointer group"
            onClick={() => onProjectClick?.(project)}
          >
            <span className="text-sm text-primary truncate group-hover:text-purple-400 transition-colors">
              {project.name}
            </span>
            <ArrowSquareOut className="size-3 text-tertiary group-hover:text-purple-400 transition-colors flex-shrink-0" />
          </div>

          {/* Status */}
          <div className="flex items-center w-24 px-3 py-3">
            <StatusBadge status={project.status} />
          </div>

          {/* Team */}
          <div className="flex items-center w-28 px-3 py-3">
            <TeamAvatars team={project.team} />
          </div>

          {/* Created */}
          <div className="flex items-center w-28 px-3 py-3">
            <span className="text-xs text-secondary truncate">{formatDate(project.createdAt)}</span>
          </div>

          {/* Credits Usage */}
          <div className="flex items-center flex-[1.5] min-w-0 px-3 py-3">
            <ProgressMeter 
              current={project.creditsUsage.current} 
              max={project.creditsUsage.max}
              onRequestRefill={onRequestRefill ? () => onRequestRefill(project) : undefined}
            />
          </div>

          {/* Cost to-date */}
          <div className="flex items-center w-28 px-3 py-3">
            <span className="text-sm font-medium text-primary">
              ${project.costToDate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Last Updated */}
          <div className="flex items-center w-28 px-3 py-3">
            <span className="text-xs text-secondary">{formatRelativeTime(project.lastUpdated)}</span>
          </div>

          {/* More Options */}
          <div className="flex items-center justify-center w-10 py-3">
            <DropdownMenu open={openMenuId === project.id} onOpenChange={(open) => setOpenMenuId(open ? project.id : null)}>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-md hover:bg-surface-3 transition-colors">
                  <DotsThree className="size-4 text-secondary hover:text-primary transition-colors" weight="bold" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-surface-2 border-subtle w-48">
                <DropdownMenuItem
                  className="text-secondary hover:text-primary hover:bg-surface-3 cursor-pointer text-sm flex items-center gap-2"
                  onClick={() => handleManageMembers(project.id)}
                >
                  <Users className="size-4" />
                  Manage Team
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-secondary hover:text-primary hover:bg-surface-3 cursor-pointer text-sm flex items-center gap-2"
                  onClick={() => handleManageWallet(project.id)}
                >
                  <Wallet className="size-4" />
                  Manage Credits
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="size-12 rounded-full bg-surface-3 flex items-center justify-center mb-4">
            <Users className="size-6 text-tertiary" />
          </div>
          <p className="text-sm font-medium text-secondary mb-1">No projects found</p>
          <p className="text-xs text-tertiary">Try adjusting your filters or search query</p>
        </div>
      )}
    </div>
  );
}
