import { Card, CardContent, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Activity } from "lucide-react";

export function AnalyticsSkeleton() {
  return (
    <div>
      {/* Page Header Skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors duration-300">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Analytics Dashboard
              </h1>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground">
          Track your usage, performance, and insights
        </p>
      </div>

      {/* Time Range Selector Skeleton */}
      <div className="mb-6">
        <div className="flex gap-2 p-1 bg-muted/30 rounded-lg w-64">
          <Skeleton className="flex-1 h-8" />
          <Skeleton className="flex-1 h-8" />
          <Skeleton className="flex-1 h-8" />
        </div>
      </div>

      {/* Summary Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="p-[1px] rounded-2xl bg-border/30">
            <Card className="bg-muted/50 border-border/50 rounded-2xl h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <Skeleton className="h-4 w-24" />
                <div className="p-2 rounded-lg bg-muted/50">
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

      {/* Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Activity Over Time Skeleton */}
        <div className="p-[1px] rounded-2xl bg-border/30">
          <Card className="bg-muted/50 border-border/50 rounded-2xl h-full">
            <CardHeader className="pb-4">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>

        {/* Token Usage Skeleton */}
        <div className="p-[1px] rounded-2xl bg-border/30">
          <Card className="bg-muted/50 border-border/50 rounded-2xl h-full">
            <CardHeader className="pb-4">
              <Skeleton className="h-6 w-24 mb-2" />
              <Skeleton className="h-4 w-36" />
            </CardHeader>
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>

        {/* Model Usage Skeleton */}
        <div className="p-[1px] rounded-2xl bg-border/30">
          <Card className="bg-muted/50 border-border/50 rounded-2xl h-full">
            <CardHeader className="pb-4">
              <Skeleton className="h-6 w-20 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>

        {/* Conversations Over Time Skeleton */}
        <div className="p-[1px] rounded-2xl bg-border/30">
          <Card className="bg-muted/50 border-border/50 rounded-2xl h-full">
            <CardHeader className="pb-4">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-36" />
            </CardHeader>
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>

        {/* Cost Over Time Skeleton - Full Width */}
        <div className="p-[1px] rounded-2xl bg-border/30 lg:col-span-2">
          <Card className="bg-muted/50 border-border/50 rounded-2xl h-full">
            <CardHeader className="pb-4">
              <Skeleton className="h-6 w-24 mb-2" />
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}