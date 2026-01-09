import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "./SearchInput";
import { FilterOrganization } from "./types";

interface BalanceFiltersProps {
  searchInput: string;
  organizationId: string;
  sortBy: string;
  sortOrder: string;
  organizations: FilterOrganization[] | undefined;
  onSearchChange: (value: string) => void;
  onOrganizationChange: (value: string) => void;
  onSortByChange: (value: string) => void;
  onSortOrderChange: (value: string) => void;
}

export function BalanceFilters({
  searchInput,
  organizationId,
  sortBy,
  sortOrder,
  organizations,
  onSearchChange,
  onOrganizationChange,
  onSortByChange,
  onSortOrderChange,
}: BalanceFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              placeholder="Search users, projects..."
              value={searchInput}
              onChange={onSearchChange}
            />
          </div>

          <Select
            value={organizationId || "all"}
            onValueChange={(v) => onOrganizationChange(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations?.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={onSortByChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balance">Balance</SelectItem>
              <SelectItem value="userName">User Name</SelectItem>
              <SelectItem value="projectName">Project</SelectItem>
              <SelectItem value="transactionCount">Transactions</SelectItem>
              <SelectItem value="createdAt">Created</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={onSortOrderChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

