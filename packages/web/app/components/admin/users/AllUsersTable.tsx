import { getRoleBadgeVariant, UserRole } from "@nowgai/shared/types";
import {
    ArrowClockwise,
    ChartBar,
    Eye,
    MagnifyingGlass,
    Shield,
    ShieldSlash,
    User,
    UserPlus,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router";
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
import { Pagination } from "./Pagination";
import type { UsersResponse, UserType } from "./types";

interface AllUsersTableProps {
  data: UsersResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  searchQuery: string;
  currentPage: number;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onViewDetail: (user: UserType) => void;
  onToggleRole: (user: UserType) => void;
  onInviteAdmin: () => void;
  onRefresh?: () => void;
}

export function AllUsersTable({
  data,
  isLoading,
  isFetching,
  searchQuery,
  currentPage,
  onSearchChange,
  onPageChange,
  onViewDetail,
  onToggleRole,
  onInviteAdmin,
  onRefresh,
}: AllUsersTableProps) {
  const navigate = useNavigate();
  const users = data?.users || [];
  const pagination = data?.pagination;

  return (
    <Card className="bg-surface-1 border border-subtle rounded-[12px]">
      <CardHeader className="border-b border-subtle px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-[14px] flex items-center gap-2 text-primary font-medium tracking-[-0.28px]">
            <User className="h-5 w-5 text-[#7b4cff]" weight="fill" />
            All Users
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 w-64 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#555558]"
              />
            </div>
            {onRefresh && (
              <Button
                onClick={onRefresh}
                size="sm"
                variant="outline"
                disabled={isFetching}
                className="flex items-center gap-2 bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
              >
                <ArrowClockwise className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button
              onClick={onInviteAdmin}
              size="sm"
              className="flex items-center gap-2 accent-primary hover:bg-[#8c63f2] text-white"
            >
              <UserPlus className="h-4 w-4" weight="fill" />
              Invite Admin
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading || isFetching || !data ? (
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-subtle">
                  <TableHead className="text-secondary">Email</TableHead>
                  <TableHead className="text-secondary">Name</TableHead>
                  <TableHead className="text-secondary">Role</TableHead>
                  <TableHead className="text-secondary">Email Verified</TableHead>
                  <TableHead className="text-secondary">Created</TableHead>
                  <TableHead className="text-right text-secondary">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i} className="border-b border-subtle">
                    <TableCell><Skeleton className="h-4 w-32 bg-surface-2" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 bg-surface-2" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full bg-surface-2" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full bg-surface-2" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 bg-surface-2" /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-8 w-8 bg-surface-2" />
                        <Skeleton className="h-8 w-8 bg-surface-2" />
                        <Skeleton className="h-8 w-8 bg-surface-2" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User className="h-12 w-12 text-tertiary mb-4" weight="fill" />
            <h3 className="text-[16px] font-semibold mb-2 text-primary tracking-[-0.32px]">No users found</h3>
            <p className="text-secondary text-[13px] max-w-sm tracking-[-0.26px]">
              {searchQuery
                ? `No users match "${searchQuery}". Try a different search term.`
                : "Get started by adding your first user."}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-subtle hover:bg-surface-2/50">
                  <TableHead className="text-secondary">Email</TableHead>
                  <TableHead className="text-secondary">Name</TableHead>
                  <TableHead className="text-secondary">Role</TableHead>
                  <TableHead className="text-secondary">Email Verified</TableHead>
                  <TableHead className="text-secondary">Created</TableHead>
                  <TableHead className="text-right text-secondary">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-b border-subtle hover:bg-surface-2/50">
                    <TableCell className="font-medium text-primary">{user.email}</TableCell>
                    <TableCell className="text-primary">
                      {user.name || (user.firstName && user.lastName)
                        ? `${user.firstName} ${user.lastName}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)} className="accent-primary/20 text-[#8c63f2] border-[#7b4cff]/30">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.emailVerified ? "default" : "secondary"}
                        className={user.emailVerified ? "bg-success-500/20 text-[#22c55e] border-[#22c55e]/30" : "bg-surface-2 text-secondary border-subtle"}
                      >
                        {user.emailVerified ? "Verified" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-secondary">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/admin/analytics/user/${user.id}`)
                          }
                          title="View analytics"
                          className="text-secondary hover:text-primary hover:bg-surface-2"
                        >
                          <ChartBar className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetail(user)}
                          title="View details"
                          className="text-secondary hover:text-primary hover:bg-surface-2"
                        >
                          <Eye className="h-4 w-4" weight="fill" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleRole(user)}
                          title={
                            user.role === UserRole.ADMIN
                              ? "Remove admin"
                              : "Make admin"
                          }
                          className="text-secondary hover:text-primary hover:bg-surface-2"
                        >
                          {user.role === UserRole.ADMIN ? (
                            <ShieldSlash className="h-4 w-4 text-orange-500" weight="fill" />
                          ) : (
                            <Shield className="h-4 w-4 text-blue-500" weight="fill" />
                          )}
                        </Button>
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
                hasMore={pagination.hasMore}
                onPrevious={() => onPageChange(currentPage - 1)}
                onNext={() => onPageChange(currentPage + 1)}
                label="users"
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

