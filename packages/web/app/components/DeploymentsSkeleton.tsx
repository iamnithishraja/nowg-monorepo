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
        className="inline-flex items-center gap-2 text-sm text-tertiary hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
              <Rocket className="w-8 h-8 text-accent-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                Deployments
              </h1>
            </div>
          </div>
        </div>
        <p className="text-tertiary">
          Manage and monitor all your project deployments
        </p>
      </div>

      {/* Summary Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index}>
            <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <Skeleton className="h-4 w-24" />
                <div className="p-2 rounded-lg bg-surface-2">
                  <Skeleton className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 bg-surface-2/50 border border-subtle rounded-lg w-80">
          <Skeleton className="flex-1 h-8" />
          <Skeleton className="flex-1 h-8" />
          <Skeleton className="flex-1 h-8" />
          <Skeleton className="flex-1 h-8" />
        </div>
      </div>

      {/* Deployments Grid Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}>
            <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
              <CardHeader className="pb-4">
                {/* Header with title and platform */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Skeleton className="h-6 w-3/4 mb-3" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <Skeleton className="w-8 h-8" />
                  </div>
                </div>
                {/* Status Badge */}
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent>
                {/* Details */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
                {/* Action Button */}
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
