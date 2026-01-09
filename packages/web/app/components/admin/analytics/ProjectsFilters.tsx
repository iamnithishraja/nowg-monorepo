import { Check, Download, MagnifyingGlass } from "@phosphor-icons/react";
import { type ChangeEvent } from "react";
import { Input } from "../../ui/input";

type TimeFilter = "all" | "30d" | "6m" | "1y";
type StatusFilter = "active" | "completed" | "archived" | "draft";

interface ProjectsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTimeFilter: TimeFilter;
  onTimeFilterChange: (filter: TimeFilter) => void;
  activeStatusFilters: StatusFilter[];
  onStatusFilterChange: (status: StatusFilter) => void;
  onExport?: () => void;
}

const timeFilters: { value: TimeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "30d", label: "Last 30D" },
  { value: "6m", label: "Last 6M" },
  { value: "1y", label: "Last 1Y" },
];

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
  { value: "draft", label: "Draft" },
];

export function ProjectsFilters({
  searchQuery,
  onSearchChange,
  activeTimeFilter,
  onTimeFilterChange,
  activeStatusFilters,
  onStatusFilterChange,
  onExport,
}: ProjectsFiltersProps) {
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Search and Export Row */}
      <div className="flex items-start justify-between w-full">
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-secondary" />
            <Input
              placeholder="Search projects by name or date.."
              value={searchQuery}
              onChange={handleSearchChange}
              className="h-[45px] pl-10 bg-surface-2 border-subtle rounded-lg text-sm text-secondary placeholder:text-secondary"
            />
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center justify-between px-2 w-full">
        {/* Time Filters */}
        <div className="flex items-center gap-1">
          {timeFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => onTimeFilterChange(filter.value)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                activeTimeFilter === filter.value
                  ? "bg-accent-primary text-primary"
                  : "bg-[rgba(161,161,170,0.1)] text-secondary hover:text-primary"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Status Filters and Export */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-tertiary">Filter by status</span>
          <div className="flex items-center gap-2">
            {statusFilters.map((status) => {
              const isActive = activeStatusFilters.includes(status.value);
              return (
                <button
                  key={status.value}
                  onClick={() => onStatusFilterChange(status.value)}
                  className="flex items-center gap-0.5"
                >
                  <div
                    className={`size-4 rounded flex items-center justify-center border ${
                      isActive
                        ? "bg-accent-primary border-accent-primary"
                        : "border-subtle bg-transparent"
                    }`}
                  >
                    {isActive && <Check className="size-3 text-white" weight="bold" />}
                  </div>
                  <span className="text-xs font-medium text-primary">{status.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProjectsHeaderProps {
  onExport?: () => void;
}

export function ProjectsHeader({ onExport }: ProjectsHeaderProps) {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center px-1.5">
        <span className="text-xs font-medium text-secondary">All Projects</span>
      </div>
      <div className="flex items-center">
        <button
          onClick={onExport}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[rgba(244,244,245,0.1)] hover:bg-[rgba(244,244,245,0.15)] transition-colors"
        >
          <Download className="size-4 text-primary" weight="fill" />
          <span className="text-xs font-medium text-primary">Export</span>
        </button>
      </div>
    </div>
  );
}

interface DateSelectorProps {
  value: string;
  onChange?: (value: string) => void;
}

export function DateSelector({ value }: DateSelectorProps) {
  return (
    <button className="flex items-center gap-1 px-2 py-1.5 rounded bg-surface-3">
      <span className="text-xs font-medium text-primary">{value}</span>
      <svg className="size-4 text-primary" fill="none" viewBox="0 0 16 16">
        <path
          d="M4.5 6L8 9.5L11.5 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export type { StatusFilter, TimeFilter };

