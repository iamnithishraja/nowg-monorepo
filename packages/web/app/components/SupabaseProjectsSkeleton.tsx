import { Card, CardContent, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Database, Server, ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export function SupabaseProjectsSkeleton() {
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

      {/* Page Header Skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--gradient-mid)]/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)]/10 to-[var(--gradient-mid)]/5 border border-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)]/30 transition-all duration-300 hover:scale-105">
                <Database className="w-9 h-9 text-accent-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                Supabase Projects
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-subtle text-xs text-tertiary">
                  <Database className="w-3 h-3" />
                  Managed
                </span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-tertiary max-w-2xl">
          Manage Supabase projects provisioned per conversation. Each project
          includes a dedicated PostgreSQL database with authentication, storage,
          and real-time capabilities.
        </p>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}>
            <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
              <CardHeader className="pb-3 relative">
                {/* Status indicator */}
                <div className="absolute top-2 right-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="flex items-center justify-between pr-20">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-6 w-3/4 mb-1" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Project details */}
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

                {/* Action button */}
                <div className="pt-2 border-t border-subtle">
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
