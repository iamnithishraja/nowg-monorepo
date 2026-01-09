import { CaretDown, DotsThree, Trash, Wallet } from "@phosphor-icons/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

export type MemberRole = "Org Admin" | "Project Admin" | "User";

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: MemberRole;
  creditsUsed: number;
  creditsMax: number;
  tokens: number;
  tokensUsed: number;
  lastAction: string;
  lastActionDate: string;
}

interface TeamMembersTableProps {
  members: TeamMemberRow[];
  onMemberClick?: (member: TeamMemberRow) => void;
  onRefill?: (member: TeamMemberRow) => void;
  onRemoveMember?: (memberId: string, memberName: string) => void;
  onManageCredits?: (member: TeamMemberRow) => void;
}

const roleConfig: Record<MemberRole, { textColor: string; bgColor: string }> = {
  "Org Admin": {
    textColor: "text-accent-primary",
    bgColor: "bg-accent-primary/10",
  },
  "Project Admin": {
    textColor: "text-sky-400",
    bgColor: "bg-sky-400/10",
  },
  User: {
    textColor: "text-secondary",
    bgColor: "bg-surface-3",
  },
};

export function TeamMembersTable({
  members,
  onMemberClick,
  onRefill,
  onRemoveMember,
  onManageCredits,
}: TeamMembersTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const needsRefill = (current: number, max: number) => {
    return max > 0 && current >= max;
  };

  return (
    <div className="flex flex-col w-full rounded-xl border border-subtle overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-surface-2/50">
        <div className="flex items-center gap-2 flex-[1.5] min-w-0 px-4 py-3">
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide">Member</span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-3">
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide">Role</span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-3">
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide">
            Credits Used
          </span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-3">
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide">
            Tokens
          </span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-3">
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide">
            Cost
          </span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-3">
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide">
            Last Action
          </span>
        </div>
        <div className="w-12 px-2 py-3" />
      </div>

      {/* Rows */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-surface-1">
          <div className="h-12 w-12 rounded-full bg-surface-2 flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <span className="text-sm text-secondary">No team members found</span>
          <span className="text-xs text-tertiary mt-1">Add members to see them here</span>
        </div>
      ) : (
        members.map((member, index) => (
          <div
            key={member.id}
            className={`flex items-center bg-surface-1 hover:bg-surface-2/50 transition-colors cursor-pointer border-t border-subtle/50 ${
              index === members.length - 1 ? "" : ""
            }`}
            onClick={() => onMemberClick?.(member)}
          >
            {/* Member */}
            <div className="flex items-center gap-3 flex-[1.5] min-w-0 px-4 py-3">
              <Avatar className="size-9 border-2 border-surface-3 shrink-0">
                {member.avatar ? (
                  <AvatarImage src={member.avatar} alt={member.name} />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-accent-primary/20 text-primary text-xs font-medium">
                    {member.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-primary truncate">
                  {member.name}
                </span>
                <span className="text-xs text-tertiary truncate">
                  {member.email}
                </span>
              </div>
            </div>

            {/* Role */}
            <div className="flex-1 min-w-0 px-3 py-3">
              <span
                className={`text-xs font-medium px-2 py-1 rounded-md ${roleConfig[member.role].textColor} ${roleConfig[member.role].bgColor}`}
              >
                {member.role}
              </span>
            </div>

            {/* Credits Used */}
            <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-3">
              {member.role === "Org Admin" ? (
                <span className="text-sm text-tertiary">—</span>
              ) : (
                <>
                  <span className="text-sm text-primary font-medium">
                    ${member.creditsUsed.toFixed(0)}
                    <span className="text-tertiary font-normal">/${member.creditsMax > 0 ? `$${member.creditsMax}` : '∞'}</span>
                  </span>
                  {needsRefill(member.creditsUsed, member.creditsMax) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRefill?.(member);
                      }}
                      className="text-[10px] font-medium text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-amber-400/10 hover:bg-amber-400/20 transition-colors"
                    >
                      Refill
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Tokens */}
            <div className="flex-1 min-w-0 px-3 py-3">
              <span className="text-sm text-primary">
                {member.tokens.toLocaleString()}
              </span>
            </div>

            {/* Cost */}
            <div className="flex-1 min-w-0 px-3 py-3">
              <span className="text-sm text-emerald-400 font-medium">
                ${member.tokensUsed.toFixed(2)}
              </span>
            </div>

            {/* Last Action */}
            <div className="flex-1 min-w-0 px-3 py-3">
              <span className="text-sm text-tertiary">
                {member.lastAction}{" "}
                <span className="text-tertiary/60">{formatRelativeTime(member.lastActionDate)}</span>
              </span>
            </div>

            {/* Actions */}
            <div className="w-12 px-2 py-3 flex justify-center">
              {member.role !== "Org Admin" && (
                <DropdownMenu
                  open={openMenuId === member.id}
                  onOpenChange={(open) =>
                    setOpenMenuId(open ? member.id : null)
                  }
                >
                  <DropdownMenuTrigger
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center size-8 rounded-lg hover:bg-surface-3 transition-colors"
                  >
                    <DotsThree className="size-4 text-tertiary" weight="bold" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-surface-2 border-subtle min-w-[160px]"
                  >
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onManageCredits?.(member);
                        setOpenMenuId(null);
                      }}
                      className="text-primary focus:bg-surface-3 cursor-pointer flex items-center gap-2 py-2"
                    >
                      <Wallet className="size-4 text-accent-primary" />
                      <span>Manage Credits</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-subtle" />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveMember?.(member.id, member.name);
                        setOpenMenuId(null);
                      }}
                      className="text-rose-400 focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer flex items-center gap-2 py-2"
                    >
                      <Trash className="size-4" weight="fill" />
                      <span>Remove User</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
