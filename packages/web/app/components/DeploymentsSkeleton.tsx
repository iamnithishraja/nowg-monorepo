import { Rocket, ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function DeploymentsSkeleton() {
  return (
    <div>
      {/* Back Button */}
      <Link
        to="/home"
        className="inline-flex items-center justify-center sm:justify-start gap-2 text-sm text-tertiary hover:text-primary transition-colors mb-4 sm:mb-6 min-h-[44px] min-w-[44px] -ml-2 sm:min-w-0"
      >
        <ArrowLeft className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Back to Home</span>
      </Link>

      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10">
              <Rocket className="w-7 h-7 sm:w-8 sm:h-8 text-accent-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">
                Deployments
              </h1>
            </div>
          </div>
        </div>
        <p className="text-tertiary text-sm sm:text-base hidden sm:block mt-1">
          Manage and monitor all your project deployments
        </p>
      </div>

      {/* Summary Stats Grid Skeleton - 2x2 on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index}>
            <Card className="bg-surface-1 border border-subtle rounded-xl h-full">
              <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 sm:pb-3">
                <Skeleton className="h-3 sm:h-4 w-16 sm:w-24 flex-1 max-w-[80%]" />
                <div className="p-1.5 sm:p-2 rounded-lg bg-surface-2 shrink-0">
                  <Skeleton className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <Skeleton className="h-8 sm:h-9 w-12 sm:w-16" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Filter Tabs Skeleton - scrollable on mobile */}
      <div className="mb-4 sm:mb-6 overflow-x-hidden">
        <div className="inline-flex gap-1 p-1.5 sm:p-[3px] bg-surface-2/50 border border-subtle rounded-lg w-full sm:w-auto min-w-0">
          <Skeleton className="h-[42px] sm:h-8 w-16 sm:w-14 shrink-0 rounded-md" />
          <Skeleton className="h-[42px] sm:h-8 w-16 sm:w-14 shrink-0 rounded-md" />
          <Skeleton className="h-[42px] sm:h-8 w-14 sm:w-14 shrink-0 rounded-md" />
          <Skeleton className="h-[42px] sm:h-8 w-14 sm:w-14 shrink-0 rounded-md" />
          <Skeleton className="h-[42px] sm:h-8 w-20 sm:w-24 shrink-0 rounded-md" />
        </div>
      </div>

      {/* Deployments Grid Skeleton */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}>
            <Card className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px] h-full">
              <CardHeader className="p-4 sm:pb-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-5 sm:h-6 w-3/4 mb-2 sm:mb-3" />
                    <Skeleton className="h-5 w-20 sm:w-24" />
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                    <Skeleton className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg shrink-0" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 sm:w-24 rounded-lg" />
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="space-y-2 sm:space-y-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <Skeleton className="h-4 w-20 flex-1 max-w-[120px]" />
                    <Skeleton className="h-4 w-24 sm:w-32 flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <Skeleton className="h-4 w-12 shrink-0" />
                    <Skeleton className="h-4 w-20 sm:w-28 flex-1" />
                  </div>
                </div>
                <Skeleton className="h-12 sm:h-12 w-full rounded-xl min-h-[48px]" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
