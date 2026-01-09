import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  User,
  Search,
  Eye,
  Shield,
  ShieldOff,
  UserPlus,
  BarChart3,
} from "lucide-react";
import { UsersResponse, UserType } from "./types";
import { getRoleBadgeVariant } from "@/types/roles";
import { UserRole } from "@/types/roles";
import { Pagination } from "./Pagination";
import { useLocation } from "wouter";

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
}: AllUsersTableProps) {
  const [, setLocation] = useLocation();
  const users = data?.users || [];
  const pagination = data?.pagination;

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            All Users
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button
              onClick={onInviteAdmin}
              size="sm"
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Invite Admin
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading || isFetching || !data ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No users found</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              {searchQuery
                ? `No users match "${searchQuery}". Try a different search term.`
                : "Get started by adding your first user."}
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
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setLocation(`/admin/analytics/user/${user.id}`)
                          }
                          title="View analytics"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetail(user)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
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
                        >
                          {user.role === UserRole.ADMIN ? (
                            <ShieldOff className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Shield className="h-4 w-4 text-blue-500" />
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
