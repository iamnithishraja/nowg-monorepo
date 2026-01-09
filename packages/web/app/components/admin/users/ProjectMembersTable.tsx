import { FolderSimple, MagnifyingGlass, User, UserPlus } from "@phosphor-icons/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { getRoleBadgeVariant } from "~/lib/types/roles";
import { Pagination } from "./Pagination";
import type { UsersResponse } from "./types";

interface ProjectMembersTableProps {
  data: UsersResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  searchQuery: string;
  currentPage: number;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onInviteToProject: () => void;
}

export function ProjectMembersTable({
  data,
  isLoading,
  isFetching,
  searchQuery,
  currentPage,
  onSearchChange,
  onPageChange,
  onInviteToProject,
}: ProjectMembersTableProps) {
  const users = data?.users || [];
  const pagination = data?.pagination;

  return (
    <Card className="shadow-sm bg-surface-1 border-subtle">
      <CardHeader className="border-b border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <FolderSimple className="h-5 w-5 text-[#7b4cff]" weight="fill" />
            Project Members
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 w-64 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff]"
              />
            </div>
            <Button
              onClick={onInviteToProject}
              size="sm"
              className="flex items-center gap-2 accent-primary hover:bg-[#8c63f2] text-white"
            >
              <UserPlus className="h-4 w-4" />
              Invite from Org
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading || isFetching || !data ? (
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email Verified</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User className="h-12 w-12 text-tertiary mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-primary">
              No project members found
            </h3>
            <p className="text-tertiary text-sm max-w-sm">
              {searchQuery
                ? `No members match "${searchQuery}". Try a different search term.`
                : "No members have been added to this project yet."}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email Verified</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      {user.name || (user.firstName && user.lastName)
                        ? `${user.firstName} ${user.lastName}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.emailVerified ? "default" : "secondary"}
                      >
                        {user.emailVerified ? "Verified" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "-"}
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
                hasMore={pagination.hasMore}
                onPrevious={() => onPageChange(currentPage - 1)}
                onNext={() => onPageChange(currentPage + 1)}
                label="members"
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

