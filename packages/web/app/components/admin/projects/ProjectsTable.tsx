import {
    Warning,
    ChartBar,
    PencilSimple,
    ArrowClockwise,
    MagnifyingGlass,
    Trash,
    UserPlus,
    Users,
    Wallet,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import type { OrganizationType, ProjectsResponse, ProjectType } from "./index";
import { Pagination } from "./Pagination";
import { getInvitationStatusBadge } from "./utils";

interface ProjectsTableProps {
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
  currentPage: number;
  onPageChange: (page: number) => void;
  isUnassigning: boolean;
  onRefresh?: () => void;
}

export function ProjectsTable({
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
  currentPage,
  onPageChange,
  isUnassigning,
  onRefresh,
}: ProjectsTableProps) {
  const navigate = useNavigate();
  const projects = data?.projects || [];
  const pagination = data?.pagination;

  return (
    <Card className="bg-surface-1 border border-subtle rounded-[12px]">
      <CardHeader className="border-b border-subtle px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[14px] font-medium text-primary tracking-[-0.28px]">All Projects</CardTitle>
            <CardDescription className="text-[13px] text-secondary tracking-[-0.26px]">View and manage all projects</CardDescription>
          </div>
          <div className="flex items-center gap-2">
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
                <div className="relative">
                  <MagnifyingGlass className="absolute left-2 top-2.5 h-4 w-4 text-tertiary pointer-events-none" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-8 w-64 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#555558]"
                  />
                </div>
                {onRefresh && (
                  <Button
                    onClick={onRefresh}
                    size="sm"
                    variant="outline"
                    disabled={isLoading}
                    className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
                  >
                    <ArrowClockwise className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="text-center py-8 text-destructive">
            <Warning className="h-5 w-5 mx-auto mb-2" weight="fill" />
            <p>
              Error loading projects:{" "}
              {(error as Error)?.message || "Unknown error"}
            </p>
          </div>
        ) : isLoading ? (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-subtle">
                <TableHead className="text-secondary">Name</TableHead>
                <TableHead className="text-secondary">Description</TableHead>
                <TableHead className="text-secondary">Organization</TableHead>
                <TableHead className="text-secondary">Project Admin</TableHead>
                <TableHead className="text-secondary">Status</TableHead>
                <TableHead className="text-secondary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i} className="border-b border-subtle">
                  <TableCell><Skeleton className="h-4 w-32 bg-surface-2" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48 bg-surface-2" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28 bg-surface-2" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 bg-surface-2" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full bg-surface-2" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 bg-surface-2" />
                      <Skeleton className="h-8 w-8 bg-surface-2" />
                      <Skeleton className="h-8 w-8 bg-surface-2" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-secondary">
            No projects found
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-subtle">
                  <TableHead className="text-secondary">Name</TableHead>
                  <TableHead className="text-secondary">Description</TableHead>
                  <TableHead className="text-secondary">Organization</TableHead>
                  <TableHead className="text-secondary">Project Admin</TableHead>
                  <TableHead className="text-secondary">Status</TableHead>
                  <TableHead className="text-secondary">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className={`border-b border-subtle ${
                      isProjectAdmin ? "cursor-pointer hover:bg-surface-2/50" : "hover:bg-surface-2/50"
                    }`}
                    onClick={
                      isProjectAdmin
                        ? () =>
                            navigate(`/admin/projects/${project.id}/members`)
                        : undefined
                    }
                  >
                    <TableCell className="font-medium text-primary">
                      {project.name}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-secondary">
                      {project.description || "-"}
                    </TableCell>
                    <TableCell className="text-secondary">{project.organization?.name || "-"}</TableCell>
                    <TableCell>
                      {project.projectAdmin ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="text-[13px] font-medium text-primary">
                              {project.projectAdmin.name ||
                                project.projectAdmin.email}
                            </span>
                            {getInvitationStatusBadge(project.invitationStatus)}
                          </div>
                          {!isProjectAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnassignAdmin(project);
                              }}
                              disabled={isUnassigning}
                              className="text-destructive hover:text-destructive hover:bg-surface-2"
                              title="Unassign Project Admin"
                            >
                              <Trash className="h-4 w-4" weight="fill" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-tertiary text-[13px]">
                          Not assigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          project.status === "active" ? "default" : "secondary"
                        }
                        className={project.status === "active" ? "bg-success-500/20 text-[#22c55e] border-[#22c55e]/30" : "bg-surface-2 text-secondary border-subtle"}
                      >
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(
                              `/admin/analytics/project/${project.id}`
                            );
                          }}
                          title="View Analytics"
                          className="text-secondary hover:text-primary hover:bg-surface-2"
                        >
                          <ChartBar className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(
                              `/admin/projects/${project.id}/members`
                            );
                          }}
                          title="Manage Team Members"
                          className="text-secondary hover:text-primary hover:bg-surface-2"
                        >
                          <Users className="h-4 w-4" weight="fill" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/projects/${project.id}/wallet`);
                          }}
                          title="View Project Wallet"
                          className="text-secondary hover:text-primary hover:bg-surface-2"
                        >
                          <Wallet className="h-4 w-4" weight="fill" />
                        </Button>
                        {!isProjectAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(project);
                              }}
                              title="Edit Project"
                              className="text-secondary hover:text-primary hover:bg-surface-2"
                            >
                              <PencilSimple className="h-4 w-4" />
                            </Button>
                            {!project.projectAdmin ||
                            project.invitationStatus !== "accepted" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAssignAdmin(project);
                                }}
                                title="Assign Project Admin"
                                className="text-secondary hover:text-primary hover:bg-surface-2"
                              >
                                <UserPlus className="h-4 w-4" weight="fill" />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(project);
                              }}
                              title="Archive Project"
                              className="text-secondary hover:text-destructive hover:bg-surface-2"
                            >
                              <Trash className="h-4 w-4" weight="fill" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pagination && pagination.totalPages > 1 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={onPageChange}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

