import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SearchInput } from "./SearchInput";
import { FilterOrganization, FilterProject } from "./types";
import { Checkbox } from "@/components/ui/checkbox";

interface TransactionFiltersProps {
  walletType: string;
  transactionType: string;
  organizationId: string;
  projectId: string;
  searchInput: string;
  startDate: string;
  endDate: string;
  whitelisted: boolean;
  organizations: FilterOrganization[] | undefined;
  projects: FilterProject[] | undefined;
  onWalletTypeChange: (value: string) => void;
  onTransactionTypeChange: (value: string) => void;
  onOrganizationChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onWhitelistedChange: (value: boolean) => void;
  onClearFilters: () => void;
}

export function TransactionFilters({
  walletType,
  transactionType,
  organizationId,
  projectId,
  searchInput,
  startDate,
  endDate,
  whitelisted,
  organizations,
  projects,
  onWalletTypeChange,
  onTransactionTypeChange,
  onOrganizationChange,
  onProjectChange,
  onSearchChange,
  onStartDateChange,
  onEndDateChange,
  onWhitelistedChange,
  onClearFilters,
}: TransactionFiltersProps) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const hasActiveFilters =
    walletType !== "all" ||
    transactionType !== "all" ||
    organizationId ||
    projectId ||
    searchInput ||
    startDate ||
    endDate ||
    whitelisted; // whitelisted filter is active when true (checkbox checked)

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              placeholder="Search transactions..."
              value={searchInput}
              onChange={onSearchChange}
            />
          </div>

          <Select value={walletType} onValueChange={onWalletTypeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Wallet Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wallets</SelectItem>
              <SelectItem value="organization">Organization</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="user_project">User Project</SelectItem>
            </SelectContent>
          </Select>

          <Select value={transactionType} onValueChange={onTransactionTypeChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
              <SelectItem value="debit">Debit</SelectItem>
            </SelectContent>
          </Select>

          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                More Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1">
                    Active
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Transactions</SheetTitle>
                <SheetDescription>
                  Apply filters to narrow down the transaction list
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div>
                  <Label>Organization</Label>
                  <Select
                    value={organizationId || "all"}
                    onValueChange={(v) => {
                      onOrganizationChange(v === "all" ? "" : v);
                      onProjectChange("");
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="All Organizations" />
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
                </div>

                <div>
                  <Label>Project</Label>
                  <Select
                    value={projectId || "all"}
                    onValueChange={(v) => {
                      onProjectChange(v === "all" ? "" : v);
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects?.map((proj) => (
                        <SelectItem key={proj.id} value={proj.id}>
                          {proj.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="whitelisted"
                    checked={whitelisted}
                    onCheckedChange={(checked) =>
                      onWhitelistedChange(checked === true)
                    }
                  />
                  <Label
                    htmlFor="whitelisted"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Include Whitelisted Transactions
                  </Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onClearFilters();
                      setFilterSheetOpen(false);
                    }}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                  <Button
                    onClick={() => setFilterSheetOpen(false)}
                    className="flex-1"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

