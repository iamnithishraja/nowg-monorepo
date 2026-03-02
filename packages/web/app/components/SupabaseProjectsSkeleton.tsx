import { Card, CardContent, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Database, Server, ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export function SupabaseProjectsSkeleton() {
  return (
    <div>
      {/* Back Button - matches responsive layout */}
      <Link
        to="/home"
        className="inline-flex gap-2 text-sm text-tertiary hover:text-primary transition-colors mb-4 sm:mb-6 min-h-[44px] min-w-[44px] -ml-2 items-center justify-center sm:justify-start sm:min-w-0"
      >
        <ArrowLeft className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Back to Home</span>
      </Link>

      {/* Page Header Skeleton - responsive stack */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <Skeleton className="h-14 w-14 sm:h-[52px] sm:w-[52px] rounded-xl sm:rounded-2xl" />
            </div>
            <div className="min-w-0">
              <Skeleton className="h-8 w-48 sm:h-9 sm:w-56 mb-2" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-[44px] w-[44px] sm:h-9 sm:w-24 rounded-lg" />
            <Skeleton className="h-[44px] w-[44px] sm:h-9 sm:w-20 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-4 w-full max-w-2xl mt-1 rounded" />
      </div>

      {/* Projects Grid - same breakpoints as main page */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}>
            <Card className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px] h-full">
              <CardHeader className="pb-3 relative p-4 sm:p-6 sm:pb-3">
                <div className="absolute top-3 right-3">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="flex items-center justify-between pr-20">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-5 w-3/4 mb-1" />
                    <Skeleton className="h-4 w-32 mt-1" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                <div className="pt-2 border-t border-subtle">
                  <Skeleton className="h-[44px] sm:h-9 w-full rounded-lg" />
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
