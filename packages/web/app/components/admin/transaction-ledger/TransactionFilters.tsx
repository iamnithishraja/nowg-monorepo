import { X } from "@phosphor-icons/react";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Input } from "../../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../ui/select";
import { SearchInput } from "./SearchInput";
import type { FilterOrganization, FilterProject } from "./index";

interface TransactionFiltersProps {
  walletType: string;
  transactionType: string;
  organizationId: string;
  projectId: string;
  searchInput: string;
  startDate: string;
  endDate: string;
  organizations: FilterOrganization[] | undefined;
  projects: FilterProject[] | undefined;
  onWalletTypeChange: (value: string) => void;
  onTransactionTypeChange: (value: string) => void;
  onOrganizationChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
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
  organizations,
  projects,
  onWalletTypeChange,
  onTransactionTypeChange,
  onOrganizationChange,
  onProjectChange,
  onSearchChange,
  onStartDateChange,
  onEndDateChange,
  onClearFilters,
}: TransactionFiltersProps) {
  const hasActiveFilters =
    walletType !== "all" ||
    transactionType !== "all" ||
    organizationId ||
    projectId ||
    searchInput ||
    startDate ||
    endDate;

  return (
    <Card className="bg-surface-1 border border-subtle rounded-[12px]">
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
            <SelectTrigger className="w-[180px] bg-surface-2 border-subtle text-primary">
              <SelectValue placeholder="Wallet Type" />
            </SelectTrigger>
            <SelectContent className="bg-surface-1 border-subtle">
              <SelectItem value="all">All Wallets</SelectItem>
              <SelectItem value="organization">Organization</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="user_project">User Project</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={transactionType}
            onValueChange={onTransactionTypeChange}
          >
            <SelectTrigger className="w-[180px] bg-surface-2 border-subtle text-primary">
              <SelectValue placeholder="Transaction Type" />
            </SelectTrigger>
            <SelectContent className="bg-surface-1 border-subtle">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="credit">Credits</SelectItem>
              <SelectItem value="debit">Debits</SelectItem>
            </SelectContent>
          </Select>

          {organizations && organizations.length > 0 && (
            <Select
              value={organizationId}
              onValueChange={onOrganizationChange}
            >
              <SelectTrigger className="w-[200px] bg-surface-2 border-subtle text-primary">
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent className="bg-surface-1 border-subtle">
                <SelectItem value="">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {projects && projects.length > 0 && (
            <Select value={projectId} onValueChange={onProjectChange}>
              <SelectTrigger className="w-[200px] bg-surface-2 border-subtle text-primary">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent className="bg-surface-1 border-subtle">
                <SelectItem value="">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-[150px] bg-surface-2 border-subtle text-primary"
              placeholder="Start Date"
            />
            <span className="text-secondary">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-[150px] bg-surface-2 border-subtle text-primary"
              placeholder="End Date"
            />
          </div>

          {hasActiveFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearFilters}
              className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
            >
              <X className="h-4 w-4 mr-2" weight="bold" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

