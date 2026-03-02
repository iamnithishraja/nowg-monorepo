import { Card, CardContent, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Activity } from "lucide-react";

export function AnalyticsSkeleton() {
  return (
    <div>
      {/* Page Header Skeleton - matches responsive analytics header */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 shrink-0">
              <Activity className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            </div>
            <div>
              <Skeleton className="h-8 w-40 sm:w-48" />
            </div>
          </div>
          <Skeleton className="h-9 w-full sm:w-24 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-56 mt-1" />
      </div>

      {/* Time Range Selector Skeleton - full width on mobile */}
      <div className="mb-4 sm:mb-6">
        <div className="w-full sm:w-64 grid grid-cols-3 gap-1 p-1 bg-muted/30 rounded-lg h-11 sm:h-9">
          <Skeleton className="h-full rounded-md" />
          <Skeleton className="h-full rounded-md" />
          <Skeleton className="h-full rounded-md" />
        </div>
      </div>

      {/* Summary Stats Grid Skeleton - 2 cols mobile, 3 cols desktop (6 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-6 lg:mb-8">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="p-px rounded-xl sm:rounded-2xl bg-border/30">
            <Card className="bg-muted/50 border-border/50 rounded-xl sm:rounded-2xl h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 sm:pb-3 pb-2">
                <Skeleton className="h-3 w-16 sm:w-24" />
                <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <Skeleton className="h-6 w-12 sm:h-8 sm:w-16" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Charts Grid Skeleton - responsive heights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {[
          { title: "h-4 w-32", desc: "w-40" },
          { title: "h-4 w-24", desc: "w-36" },
          { title: "h-4 w-20", desc: "w-32" },
          { title: "h-4 w-32", desc: "w-36" },
        ].map((item, index) => (
          <div
            key={index}
            className="p-px rounded-xl sm:rounded-2xl bg-border/30"
          >
            <Card className="bg-muted/50 border-border/50 rounded-xl sm:rounded-2xl h-full">
              <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
                <Skeleton className={`${item.title} mb-2`} />
                <Skeleton className={`h-3 ${item.desc}`} />
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <Skeleton className="h-[220px] sm:h-[280px] lg:h-[300px] w-full rounded-lg min-h-0" />
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Cost Over Time Skeleton - Full Width */}
        <div className="p-px rounded-xl sm:rounded-2xl bg-border/30 lg:col-span-2">
          <Card className="bg-muted/50 border-border/50 rounded-xl sm:rounded-2xl h-full">
            <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-28" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <Skeleton className="h-[220px] sm:h-[280px] lg:h-[300px] w-full rounded-lg min-h-0" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}