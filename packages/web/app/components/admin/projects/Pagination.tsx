import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between mt-4 px-4 py-3 border-t border-subtle">
      <div className="text-[13px] text-secondary tracking-[-0.26px]">
        Showing {(currentPage - 1) * limit + 1} to{" "}
        {Math.min(currentPage * limit, total)} of {total} projects
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
        >
          <CaretLeft className="h-4 w-4" weight="bold" />
        </Button>
        <span className="text-[13px] text-secondary">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
        >
          <CaretRight className="h-4 w-4" weight="bold" />
        </Button>
      </div>
    </div>
  );
}

