import { Warning, ArrowClockwise, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Pagination } from "./Pagination";
import { CreateProjectCard, ProjectCard } from "./ProjectCard";
import type { OrganizationType, ProjectsResponse, ProjectType } from "./types";

interface ProjectsGridProps {
  data: ProjectsResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  searchQuery: string;
  selectedOrgId: string;
  organizations: OrganizationType[];
  isProjectAdmin: boolean;
  isOrgAdmin: boolean;
  onSearchChange: (value: string) => void;
  onOrgFilterChange: (orgId: string) => void;
  onEdit: (project: ProjectType) => void;
  onAssignAdmin: (project: ProjectType) => void;
  onUnassignAdmin: (project: ProjectType) => void;
  onDelete: (project: ProjectType) => void;
  onManageMembers: (project: ProjectType) => void;
  onCreateClick: () => void;
  canCreate: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  isUnassigning: boolean;
  onRefresh?: () => void;
}

export function ProjectsGrid({
  data,
  isLoading,
  error,
  searchQuery,
  selectedOrgId,
  organizations,
  isProjectAdmin,
  isOrgAdmin,
  onSearchChange,
  onOrgFilterChange,
  onEdit,
  onAssignAdmin,
  onUnassignAdmin,
  onDelete,
  onManageMembers,
  onCreateClick,
  canCreate,
  currentPage,
  onPageChange,
  isUnassigning,
  onRefresh,
}: ProjectsGridProps) {
  const projects = data?.projects || [];
  const pagination = data?.pagination;

  // Filter controls
  const renderFilters = () => (
    <div className="flex items-center gap-3 mb-6">
      {!isOrgAdmin && !isProjectAdmin && (
        <Select
          value={selectedOrgId || "all"}
          onValueChange={(value) => {
            onOrgFilterChange(value === "all" ? "" : value);
          }}
        >
          <SelectTrigger className="w-64 bg-surface-2 border-subtle text-primary">
            <SelectValue placeholder="Filter by organization" />
          </SelectTrigger>
          <SelectContent className="bg-surface-1 border-subtle">
            <SelectItem value="all">All Organizations</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {isOrgAdmin && organizations.length > 0 && (
        <div className="text-[13px] text-secondary px-3 tracking-[-0.26px]">
          Organization: {organizations[0].name}
        </div>
      )}
      {!isProjectAdmin && (
        <>
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-active"
            />
          </div>
          {onRefresh && (
            <Button
              onClick={onRefresh}
              size="sm"
              variant="outline"
              disabled={isLoading}
              className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-active"
            >
              <ArrowClockwise className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </>
      )}
    </div>
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <>
        {renderFilters()}
        <div className="flex flex-wrap gap-5">
          {/* Create Project Card Skeleton */}
          <div className="w-[380px]">
            <Skeleton className="h-[246px] w-[380px] rounded-[12px] bg-surface-2" />
            <Skeleton className="h-5 w-32 mt-3 bg-surface-2" />
          </div>
          {/* Project Card Skeletons */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-[380px]">
              <Skeleton className="h-[246px] w-[380px] rounded-[12px] bg-surface-2" />
              <div className="mt-3 flex items-center justify-between pr-3">
                <div className="flex-1">
                  <Skeleton className="h-5 w-36 bg-surface-2" />
                  <Skeleton className="h-4 w-24 mt-1 bg-surface-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        {renderFilters()}
        <div className="text-center py-12 text-destructive">
          <Warning className="h-8 w-8 mx-auto mb-3" weight="fill" />
          <p className="text-lg font-medium">Error loading projects</p>
          <p className="text-secondary mt-1">
            {(error as Error)?.message || "Unknown error"}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {renderFilters()}
      <div className="flex flex-wrap gap-5">
        {/* Create Project Card - only show for non-project admins */}
        {!isProjectAdmin && (
          <CreateProjectCard onClick={onCreateClick} disabled={!canCreate} />
        )}
        
        {/* Project Cards */}
        {projects.length === 0 && isProjectAdmin ? (
          <div className="w-full text-center py-12 text-secondary">
            No projects found
          </div>
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isProjectAdmin={isProjectAdmin}
              onEdit={onEdit}
              onAssignAdmin={onAssignAdmin}
              onUnassignAdmin={onUnassignAdmin}
              onDelete={onDelete}
              onManageMembers={onManageMembers}
              isUnassigning={isUnassigning}
            />
          ))
        )}
      </div>

      {/* Empty state for non-project admins */}
      {projects.length === 0 && !isProjectAdmin && (
        <div className="text-center py-8 text-secondary">
          <p>No projects yet. Create your first project to get started.</p>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </>
  );
}
