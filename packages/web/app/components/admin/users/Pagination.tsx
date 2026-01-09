import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  hasMore: boolean;
  onPrevious: () => void;
  onNext: () => void;
  label?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
  hasMore,
  onPrevious,
  onNext,
  label = "items",
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-subtle">
      <div className="text-[13px] text-secondary tracking-[-0.26px]">
        Showing page {currentPage} of {totalPages} ({total} total {label})
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={currentPage === 1}
          className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
        >
          <CaretLeft className="h-4 w-4 mr-1" weight="bold" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasMore}
          className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
        >
          Next
          <CaretRight className="h-4 w-4 ml-1" weight="bold" />
        </Button>
      </div>
    </div>
  );
}

