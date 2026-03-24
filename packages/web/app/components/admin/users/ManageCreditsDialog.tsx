import { CreditCard, FolderOpen, Minus, Plus } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import type { TeamMember } from "./TeamMembersTable";

interface ProjectCredits {
  projectId: string;
  projectName: string;
  currentLimit: number;
  creditsUsed: number;
  creditsAvailable: number;
}

interface ManageCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  projectCredits: ProjectCredits[];
  isLoading?: boolean;
  isSaving?: boolean;
  onSave: (data: {
    memberId: string;
    projectCredits: Array<{ projectId: string; creditLimit: number }>;
  }) => void;
}

// Helper to get user initials
const getUserInitials = (name?: string, email?: string): string => {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "U";
};

export function ManageCreditsDialog({
  open,
  onOpenChange,
  member,
  projectCredits,
  isLoading = false,
  isSaving = false,
  onSave,
}: ManageCreditsDialogProps) {
  const [creditLimits, setCreditLimits] = useState<Record<string, number>>({});

  // Initialize credit limits from projectCredits
  useEffect(() => {
    const limits: Record<string, number> = {};
    projectCredits.forEach((pc) => {
      limits[pc.projectId] = pc.currentLimit;
    });
    setCreditLimits(limits);
  }, [projectCredits]);

  const handleSave = () => {
    if (!member) return;

    onSave({
      memberId: member.id,
      projectCredits: Object.entries(creditLimits).map(
        ([projectId, creditLimit]) => ({
          projectId,
          creditLimit,
        })
      ),
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleCreditChange = (projectId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCreditLimits((prev) => ({
      ...prev,
      [projectId]: Math.max(0, numValue),
    }));
  };

  const adjustCredit = (projectId: string, delta: number) => {
    setCreditLimits((prev) => ({
      ...prev,
      [projectId]: Math.max(0, (prev[projectId] || 0) + delta),
    }));
  };

  if (!member) return null;

  // Calculate totals
  const totalCreditsUsed = projectCredits.reduce(
    (sum, pc) => sum + (pc.creditsUsed || 0),
    0
  );
  const totalCreditsAvailable = projectCredits.reduce(
    (sum, pc) => sum + (pc.creditsAvailable || 0),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 bg-surface-1 border-subtle overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-subtle">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#22c55e]/20 to-[#10b981]/20 border border-[#22c55e]/30 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-[#4ade80]" weight="fill" />
              </div>
              <div>
                <DialogTitle className="text-[18px] font-semibold text-primary tracking-[-0.36px]">
                  Manage Credits
                </DialogTitle>
                <p className="text-[13px] text-secondary tracking-[-0.26px]">
                  Set credit limits for this team member
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* User Info Card */}
          <div className="mt-4 p-3 bg-surface-2 rounded-lg border border-subtle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-subtle">
                  <AvatarImage src={member.image} alt={member.name} />
                  <AvatarFallback className="bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white text-[12px] font-medium">
                    {getUserInitials(member.name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-primary tracking-[-0.28px] truncate">
                    {member.name || "No name"}
                  </p>
                  <p className="text-[12px] text-tertiary tracking-[-0.24px] truncate">
                    {member.email}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-tertiary uppercase tracking-wider">
                  Total Available
                </p>
                <p className="text-[16px] font-semibold text-[#4ade80]">
                  ${totalCreditsAvailable.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[400px]">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full bg-surface-2" />
              <Skeleton className="h-24 w-full bg-surface-2" />
            </div>
          ) : projectCredits.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3">
                <FolderOpen size={20} color="#727279" />
              </div>
              <p className="text-[14px] text-tertiary">
                No projects assigned to this user
              </p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-2 rounded-lg border border-subtle">
                  <p className="text-[11px] text-tertiary uppercase tracking-wider mb-1">
                    Credits Used
                  </p>
                  <p className="text-[18px] font-semibold text-primary">
                    ${totalCreditsUsed.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-surface-2 rounded-lg border border-subtle">
                  <p className="text-[11px] text-tertiary uppercase tracking-wider mb-1">
                    Credits Available
                  </p>
                  <p className="text-[18px] font-semibold text-[#4ade80]">
                    ${totalCreditsAvailable.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Per-Project Credits */}
              <div className="space-y-3">
                <Label className="text-[13px] font-medium text-secondary tracking-[-0.26px]">
                  Project Credit Limits
                </Label>
                <div className="space-y-3">
                  {projectCredits.map((pc) => {
                    const currentLimit =
                      creditLimits[pc.projectId] ?? pc.currentLimit;
                    const hasChanges = currentLimit !== pc.currentLimit;

                    return (
                      <div
                        key={pc.projectId}
                        className={cn(
                          "p-4 rounded-lg border transition-all",
                          hasChanges
                            ? "bg-[#7b4cff]/5 border-[#7b4cff]/30"
                            : "bg-surface-2 border-subtle"
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-surface-3 flex items-center justify-center">
                              <FolderOpen
                                size={16}
                                color="#727279"
                              />
                            </div>
                            <div>
                              <p className="text-[13px] font-medium text-primary tracking-[-0.26px]">
                                {pc.projectName}
                              </p>
                              <p className="text-[11px] text-tertiary">
                                Used: ${pc.creditsUsed.toFixed(2)} / Available:
                                ${pc.creditsAvailable.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-[12px] text-secondary w-16 flex-shrink-0">
                            Limit:
                          </Label>
                          <div className="flex items-center gap-2 flex-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => adjustCredit(pc.projectId, -10)}
                              className="h-9 w-9 p-0 bg-surface-1 border-subtle hover:bg-surface-3"
                            >
                              <Minus className="h-4 w-4" weight="bold" />
                            </Button>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-[14px]">
                                $
                              </span>
                              <Input
                                type="number"
                                value={currentLimit}
                                onChange={(e) =>
                                  handleCreditChange(
                                    pc.projectId,
                                    e.target.value
                                  )
                                }
                                min={0}
                                step={1}
                                className="h-9 pl-7 bg-surface-1 border-subtle text-primary text-[14px] rounded-lg focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => adjustCredit(pc.projectId, 10)}
                              className="h-9 w-9 p-0 bg-surface-1 border-subtle hover:bg-surface-3"
                            >
                              <Plus className="h-4 w-4" weight="bold" />
                            </Button>
                          </div>
                        </div>

                        {hasChanges && (
                          <p className="text-[11px] text-[#a78bfa] mt-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#7b4cff]"></span>
                            Changed from ${pc.currentLimit.toFixed(2)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-subtle bg-surface-2">
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isSaving}
              className="h-10 px-5 text-secondary hover:text-primary hover:bg-surface-2 font-medium rounded-lg transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || projectCredits.length === 0}
              className="h-10 px-6 bg-gradient-to-r from-[#7b4cff] to-[#a855f7] hover:from-[#8c63f2] hover:to-[#b566f8] text-white font-medium rounded-lg shadow-lg shadow-[#7b4cff]/25 transition-all duration-200 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

