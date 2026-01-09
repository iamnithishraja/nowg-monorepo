import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MicroserviceConfigComponent } from "@/components/microservice-config";
import { SiSupabase } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Database,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SupabaseStats {
  totalProjects: number;
  uniqueUsers: number;
  dailyProjects: Array<{ date: string; count: number; label: string }>;
  recentProjects: Array<{
    id: string;
    userId: string;
    title: string;
    projectId?: string;
    supabaseUrl?: string;
    ref?: string;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function SupabasePage() {
  const [currentPage, setCurrentPage] = useState(1);

  const { data: stats, isLoading } = useQuery<SupabaseStats>({
    queryKey: ["/api/admin/supabase-stats", currentPage],
    queryFn: async () => {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5173";
      const response = await fetch(
        `${API_URL}/api/admin/supabase-stats?page=${currentPage}&limit=10`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to fetch Supabase stats");
      return response.json();
    },
  });

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Supabase
          </h1>
          <p className="text-muted-foreground">
            Database and backend services with Supabase integration
          </p>
        </div>

        {/* Stats Overview */}
        {!isLoading && stats && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Projects
                      </p>
                      <p className="text-2xl font-bold">
                        {stats.totalProjects}
                      </p>
                    </div>
                    <Database className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Unique Users
                      </p>
                      <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Avg Per User
                      </p>
                      <p className="text-2xl font-bold">
                        {stats.uniqueUsers > 0
                          ? (stats.totalProjects / stats.uniqueUsers).toFixed(1)
                          : "0"}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily Projects Chart */}
            {stats.dailyProjects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Daily Projects Created (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.dailyProjects}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3ECF8E" name="Projects" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Recent Projects */}
            {stats.recentProjects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.recentProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{project.title}</p>
                          {project.supabaseUrl && (
                            <a
                              href={project.supabaseUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              {project.supabaseUrl}
                            </a>
                          )}
                          {project.ref && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Ref: {project.ref}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(project.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="ml-4">
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/20 dark:text-green-400 rounded-full">
                            <Database className="h-3 w-3" />
                            Active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {stats.pagination && stats.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {stats.pagination.page} of{" "}
                        {stats.pagination.totalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={!stats.pagination.hasMore}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Configuration Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Configuration</h2>
          <MicroserviceConfigComponent
            service={{
              name: "Supabase",
              icon: SiSupabase,
              description:
                "Open source Firebase alternative with PostgreSQL database",
              color: "text-green-600",
              bgColor: "bg-green-600/10",
              docs: "https://supabase.com/docs",
            }}
          />
        </div>
      </div>
    </div>
  );
}
