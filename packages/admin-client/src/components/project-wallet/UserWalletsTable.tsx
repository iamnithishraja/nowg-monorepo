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
import { Users, Edit, X, Check } from "lucide-react";
import { UserWallet, UserWalletsResponse } from "./types";
import { formatCurrency } from "./utils";
import { Pagination } from "./Pagination";

interface UserWalletsTableProps {
  data: UserWalletsResponse | undefined;
  isLoading: boolean;
  currentPage: number;
  isProjectAdmin: boolean;
  isOrgAdmin: boolean;
  editingLimit: {
    walletId: string;
    userId: string;
    currentLimit: number | null;
  } | null;
  limitValue: string;
  isUpdatingLimit: boolean;
  onPageChange: (page: number) => void;
  onEditLimit: (wallet: UserWallet) => void;
  onSaveLimit: () => void;
  onCancelEditLimit: () => void;
  onRemoveLimit: (userId: string) => void;
  onLimitValueChange: (value: string) => void;
  onViewDetails: (userId: string) => void;
  projectId: string;
}

export function UserWalletsTable({
  data,
  isLoading,
  currentPage,
  isProjectAdmin,
  isOrgAdmin,
  editingLimit,
  limitValue,
  isUpdatingLimit,
  onPageChange,
  onEditLimit,
  onSaveLimit,
  onCancelEditLimit,
  onRemoveLimit,
  onLimitValueChange,
  onViewDetails,
  projectId,
}: UserWalletsTableProps) {
  const wallets = data?.wallets || [];
  const pagination = data?.pagination;
  const canEdit = isProjectAdmin || isOrgAdmin;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Project Wallets
        </CardTitle>
        <CardDescription>
          Manage individual user wallets and spending limits for this project
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : wallets.length > 0 ? (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Spending</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.map((wallet) => (
                    <UserWalletRow
                      key={wallet.id}
                      wallet={wallet}
                      canEdit={canEdit}
                      editingLimit={editingLimit}
                      limitValue={limitValue}
                      isUpdatingLimit={isUpdatingLimit}
                      onEditLimit={onEditLimit}
                      onSaveLimit={onSaveLimit}
                      onCancelEditLimit={onCancelEditLimit}
                      onRemoveLimit={onRemoveLimit}
                      onLimitValueChange={onLimitValueChange}
                      onViewDetails={onViewDetails}
                      projectId={projectId}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                hasMore={pagination.hasMore}
                onPrevious={() => onPageChange(currentPage - 1)}
                onNext={() => onPageChange(currentPage + 1)}
                label="wallets"
              />
            )}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No user wallets yet</p>
            <p className="text-sm">
              User wallets will be created automatically when members use this
              project
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface UserWalletRowProps {
  wallet: UserWallet;
  canEdit: boolean;
  editingLimit: {
    walletId: string;
    userId: string;
    currentLimit: number | null;
  } | null;
  limitValue: string;
  isUpdatingLimit: boolean;
  onEditLimit: (wallet: UserWallet) => void;
  onSaveLimit: () => void;
  onCancelEditLimit: () => void;
  onRemoveLimit: (userId: string) => void;
  onLimitValueChange: (value: string) => void;
  onViewDetails: (userId: string) => void;
  projectId: string;
}

function UserWalletRow({
  wallet,
  canEdit,
  editingLimit,
  limitValue,
  isUpdatingLimit,
  onEditLimit,
  onSaveLimit,
  onCancelEditLimit,
  onRemoveLimit,
  onLimitValueChange,
  onViewDetails,
  projectId,
}: UserWalletRowProps) {
  const isEditing = editingLimit?.walletId === wallet.id;
  const hasLimit = wallet.limit !== null && wallet.limit !== undefined;
  const currentSpending = wallet.currentSpending || 0;
  const limit = wallet.limit || 0;
  const usagePercent = hasLimit ? (currentSpending / limit) * 100 : 0;

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium">{wallet.user?.name || "Unknown User"}</p>
          <p className="text-sm text-muted-foreground">
            {wallet.user?.email || wallet.userId}
          </p>
        </div>
      </TableCell>
      <TableCell className="font-mono">
        {formatCurrency(currentSpending)}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={limitValue}
              onChange={(e) => onLimitValueChange(e.target.value)}
              placeholder="No limit (leave empty to remove)"
              className="w-40"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSaveLimit();
                } else if (e.key === "Escape") {
                  onCancelEditLimit();
                }
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={onSaveLimit}
              disabled={isUpdatingLimit}
              title="Save limit (empty = no limit)"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelEditLimit}
              disabled={isUpdatingLimit}
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-mono">
              {hasLimit ? formatCurrency(wallet.limit!) : "No limit"}
            </span>
            {canEdit && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditLimit(wallet)}
                  disabled={isUpdatingLimit}
                  title="Edit limit"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {hasLimit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveLimit(wallet.userId)}
                    disabled={isUpdatingLimit}
                    title="Remove limit"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </TableCell>
      <TableCell>
        {hasLimit ? (
          currentSpending >= limit ? (
            <Badge variant="destructive">Limit Reached</Badge>
          ) : (
            <Badge variant="secondary">{usagePercent.toFixed(0)}% used</Badge>
          )
        ) : (
          <Badge variant="outline">No limit</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails(wallet.userId)}
        >
          View Details
        </Button>
      </TableCell>
    </TableRow>
  );
}
