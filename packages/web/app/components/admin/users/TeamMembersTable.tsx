import {
    CaretUpDown,
    CreditCard,
    DotsThree,
    MagnifyingGlass,
    Trash,
    UserGear,
    UserPlus,
    Users,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  status: "active" | "pending";
  joinedAt?: string;
  image?: string;
  projects?: Array<{
    id: string;
    name: string;
    role: string;
    status?: string;
  }>;
  creditsUsed?: number;
  creditsAvailable?: number | null;
}

interface TeamMembersTableProps {
  members: TeamMember[];
  isLoading: boolean;
  organizationName?: string;
  onAddMember?: () => void;
  onManageCredits: (member: TeamMember) => void;
  onManageRole?: (member: TeamMember) => void;
  onRemoveUser?: (member: TeamMember) => void;
  showAddMember?: boolean;
  showRemoveUser?: boolean;
  showManageRole?: boolean;
}

type FilterTab = "all" | "active" | "pending";

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

// Helper to format role display
const formatRole = (role: string): string => {
  const roleMap: Record<string, string> = {
    org_admin: "Org Admin",
    org_user: "User",
    project_admin: "Project Admin",
    member: "User",
    user: "User",
    admin: "Admin",
  };
  return roleMap[role] || role;
};

// Helper to get role badge color
const getRoleBadgeClass = (role: string): string => {
  switch (role) {
    case "org_admin":
      return "bg-[#7b4cff]/20 text-[#a78bfa] border-[#7b4cff]/30";
    case "project_admin":
      return "bg-[#ec4899]/20 text-[#f472b6] border-[#ec4899]/30";
    default:
      return "bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/30";
  }
};

// Helper to format credits display
const formatCredits = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return "-";
  return `$${value.toFixed(2)}`;
};

export function TeamMembersTable({
  members,
  isLoading,
  organizationName,
  onAddMember,
  onManageCredits,
  onManageRole,
  onRemoveUser,
  showAddMember = true,
  showRemoveUser = true,
  showManageRole = true,
}: TeamMembersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Filter members based on search query and active tab
  const filteredMembers = members.filter((member) => {
    // Filter by search
    const matchesSearch =
      !searchQuery ||
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase());

    // Filter by tab
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "active" && member.status === "active") ||
      (activeTab === "pending" && member.status === "pending");

    return matchesSearch && matchesTab;
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "pending", label: "Pending" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-24 mb-2 bg-surface-2" />
            <Skeleton className="h-4 w-64 bg-surface-2" />
          </div>
        </div>

        {/* Search and controls skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-20 bg-surface-2" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-80 bg-surface-2" />
            <Skeleton className="h-10 w-32 bg-surface-2" />
          </div>
          <Skeleton className="h-8 w-48 bg-surface-2" />
        </div>

        {/* Table skeleton */}
        <div className="border border-subtle rounded-xl overflow-hidden">
          <div className="bg-surface-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 border-b border-subtle last:border-0"
              >
                <Skeleton className="h-10 w-10 rounded-full bg-surface-2" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1 bg-surface-2" />
                  <Skeleton className="h-3 w-48 bg-surface-2" />
                </div>
                <Skeleton className="h-6 w-20 bg-surface-2" />
                <Skeleton className="h-6 w-16 bg-surface-2" />
                <Skeleton className="h-4 w-24 bg-surface-2" />
                <Skeleton className="h-4 w-24 bg-surface-2" />
                <Skeleton className="h-4 w-16 bg-surface-2" />
                <Skeleton className="h-4 w-16 bg-surface-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-[28px] font-semibold text-primary tracking-[-0.56px] leading-[1.2]">
          Team
        </h1>
        <p className="text-[15px] text-secondary mt-2 tracking-[-0.3px] leading-[1.5]">
          Manage your team members and their access to Organization.
        </p>
      </div>

      {/* Members Section */}
      <div className="space-y-4">
        {/* Section Label + Actions */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-secondary tracking-[-0.28px]">
            Members
          </span>
          {showAddMember && onAddMember && (
            <Button
              onClick={onAddMember}
              className="h-9 px-4 bg-transparent border border-subtle hover:bg-surface-2 text-primary font-medium text-[13px] rounded-lg transition-all duration-200 gap-2"
              variant="outline"
            >
              <UserPlus className="h-4 w-4" />
              Add Members
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlass className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
          <Input
            placeholder="Search members by name or email.."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-11 bg-surface-1 border-subtle text-primary placeholder:text-tertiary text-[14px] rounded-lg focus:border-[#7b4cff] focus:ring-[#7b4cff]/20 w-full"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200",
                activeTab === tab.key
                  ? "bg-[#7b4cff] text-white"
                  : "bg-surface-2 text-secondary hover:bg-surface-3 hover:text-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Members Table */}
      <div className="border border-subtle rounded-xl overflow-hidden bg-surface-1">
        {filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center mb-4">
              <Users className="h-7 w-7 text-tertiary" />
            </div>
            <h3 className="text-[16px] font-medium mb-2 text-primary tracking-[-0.32px]">
              {searchQuery ? "No members found" : "No team members yet"}
            </h3>
            <p className="text-secondary text-[13px] max-w-sm tracking-[-0.26px]">
              {searchQuery
                ? `No members match "${searchQuery}". Try a different search term.`
                : "Get started by adding your first team member."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-subtle hover:bg-transparent bg-surface-2/50">
                <TableHead className="text-[12px] font-medium text-secondary tracking-[-0.24px] uppercase py-3 px-4">
                  <div className="flex items-center gap-1">
                    Member
                    <CaretUpDown size={12} color="#727279" />
                  </div>
                </TableHead>
                <TableHead className="text-[12px] font-medium text-secondary tracking-[-0.24px] uppercase py-3 px-4">
                  <div className="flex items-center gap-1">
                    Role
                    <CaretUpDown size={12} color="#727279" />
                  </div>
                </TableHead>
                <TableHead className="text-[12px] font-medium text-secondary tracking-[-0.24px] uppercase py-3 px-4">
                  <div className="flex items-center gap-1">
                    Status
                    <CaretUpDown size={12} color="#727279" />
                  </div>
                </TableHead>
                <TableHead className="text-[12px] font-medium text-secondary tracking-[-0.24px] uppercase py-3 px-4">
                  <div className="flex items-center gap-1">
                    Joined
                    <CaretUpDown size={12} color="#727279" />
                  </div>
                </TableHead>
                <TableHead className="text-[12px] font-medium text-secondary tracking-[-0.24px] uppercase py-3 px-4">
                  <div className="flex items-center gap-1">
                    Projects
                    <CaretUpDown size={12} color="#727279" />
                  </div>
                </TableHead>
                <TableHead className="text-[12px] font-medium text-secondary tracking-[-0.24px] uppercase py-3 px-4">
                  <div className="flex items-center gap-1">
                    Credits Used
                    <CaretUpDown size={12} color="#727279" />
                  </div>
                </TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow
                  key={member.id}
                  className="border-b border-subtle hover:bg-surface-2/30 transition-colors"
                >
                  {/* Member */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-subtle">
                        <AvatarImage src={member.image} alt={member.name} />
                        <AvatarFallback className="bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white text-[12px] font-medium">
                          {getUserInitials(member.name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-[14px] font-medium text-primary tracking-[-0.28px]">
                          {member.name || "No name"}
                        </p>
                        <p className="text-[12px] text-tertiary tracking-[-0.24px]">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell className="py-4 px-4">
                    <Badge
                      className={cn(
                        "text-[12px] font-medium px-2.5 py-0.5 rounded-md border",
                        getRoleBadgeClass(member.role)
                      )}
                    >
                      {formatRole(member.role)}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-4 px-4">
                    <Badge
                      className={cn(
                        "text-[12px] font-medium px-2.5 py-0.5 rounded-md border",
                        member.status === "active"
                          ? "bg-[#22c55e]/20 text-[#4ade80] border-[#22c55e]/30"
                          : "bg-[#f59e0b]/20 text-[#fbbf24] border-[#f59e0b]/30"
                      )}
                    >
                      {member.status === "active" ? "Active" : "Pending"}
                    </Badge>
                  </TableCell>

                  {/* Joined */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[13px] text-secondary tracking-[-0.26px]">
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )
                        : "-"}
                    </span>
                  </TableCell>

                  {/* Projects */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {member.projects && member.projects.length > 0 ? (
                        <>
                          {member.projects.slice(0, 2).map((project) => (
                            <Badge
                              key={project.id}
                              className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface-3 text-secondary border-0"
                            >
                              {project.name}
                            </Badge>
                          ))}
                          {member.projects.length > 2 && (
                            <Badge className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface-3 text-secondary border-0">
                              +{member.projects.length - 2}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-[13px] text-tertiary">-</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Credits Used */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[13px] text-primary font-medium tracking-[-0.26px]">
                      {formatCredits(member.creditsUsed)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-4 px-4">
                    {member.role !== "org_admin" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-tertiary hover:text-primary hover:bg-surface-2"
                          >
                            <DotsThree className="h-4 w-4" weight="bold" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 bg-surface-1 border-subtle"
                        >
                          <DropdownMenuItem
                            onClick={() => onManageCredits(member)}
                            className="text-[13px] text-primary hover:bg-surface-2 cursor-pointer gap-2"
                          >
                            <CreditCard className="h-4 w-4" />
                            Manage Credits
                          </DropdownMenuItem>
                          {showManageRole && onManageRole && (
                            <DropdownMenuItem
                              onClick={() => onManageRole(member)}
                              className="text-[13px] text-primary hover:bg-surface-2 cursor-pointer gap-2"
                            >
                              <UserGear size={16} />
                              Manage Role
                            </DropdownMenuItem>
                          )}
                          {showRemoveUser && onRemoveUser && (
                            <>
                              <DropdownMenuSeparator className="bg-subtle" />
                              <DropdownMenuItem
                                onClick={() => onRemoveUser(member)}
                                className="text-[13px] text-[#ef4444] hover:bg-[#ef4444]/10 hover:text-[#ef4444] cursor-pointer gap-2"
                                variant="destructive"
                              >
                                <Trash className="h-4 w-4" weight="fill" />
                                Remove User
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
