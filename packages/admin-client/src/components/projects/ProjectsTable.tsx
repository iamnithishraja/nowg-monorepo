import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Users,
  Wallet,
  Edit,
  UserPlus,
  Trash2,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { useLocation } from "wouter";
import { ProjectsResponse, ProjectType, OrganizationType } from "./types";
import { getInvitationStatusBadge } from "./utils";
import { Pagination } from "./Pagination";

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
}: ProjectsTableProps) {
  const [, setLocation] = useLocation();
  const projects = data?.projects || [];
  const pagination = data?.pagination;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>All Projects</CardTitle>
            <CardDescription>View and manage all projects</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isOrgAdmin && !isProjectAdmin && (
              <Select
                value={selectedOrgId || "all"}
                onValueChange={(value) => {
                  onOrgFilterChange(value === "all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Filter by organization" />
                </SelectTrigger>
                <SelectContent>
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
              <div className="text-sm text-muted-foreground px-3">
                Organization: {organizations[0].name}
              </div>
            )}
            {!isProjectAdmin && (
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-8 text-destructive">
            <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
            <p>
              Error loading projects:{" "}
              {(error as Error)?.message || "Unknown error"}
            </p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No projects found
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Project Admin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className={
                      isProjectAdmin ? "cursor-pointer hover:bg-muted/50" : ""
                    }
                    onClick={
                      isProjectAdmin
                        ? () =>
                            setLocation(`/admin/projects/${project.id}/members`)
                        : undefined
                    }
                  >
                    <TableCell className="font-medium">
                      {project.name}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {project.description || "-"}
                    </TableCell>
                    <TableCell>{project.organization?.name || "-"}</TableCell>
                    <TableCell>
                      {project.projectAdmin ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
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
                              className="text-destructive hover:text-destructive"
                              title="Unassign Project Admin"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Not assigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          project.status === "active" ? "default" : "secondary"
                        }
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
                            setLocation(
                              `/admin/analytics/project/${project.id}`
                            );
                          }}
                          title="View Analytics"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(
                              `/admin/projects/${project.id}/members`
                            );
                          }}
                          title="Manage Team Members"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/admin/projects/${project.id}/wallet`);
                          }}
                          title="View Project Wallet"
                        >
                          <Wallet className="h-4 w-4" />
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
                            >
                              <Edit className="h-4 w-4" />
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
                              >
                                <UserPlus className="h-4 w-4" />
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
                            >
                              <Trash2 className="h-4 w-4" />
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
