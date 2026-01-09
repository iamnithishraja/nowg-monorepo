import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MicroserviceConfigComponent } from "@/components/microservice-config";
import { SiNetlify } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
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

interface NetlifyStats {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  pendingDeployments: number;
  uniqueUsers: number;
  successRate: string;
  dailyDeployments: Array<{ date: string; count: number; label: string }>;
  recentDeployments: Array<{
    id: string;
    userId: string;
    deploymentUrl: string;
    status: string;
    deployedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function NetlifyPage() {
  const [currentPage, setCurrentPage] = useState(1);

  const { data: stats, isLoading } = useQuery<NetlifyStats>({
    queryKey: ["/api/admin/netlify-stats", currentPage],
    queryFn: async () => {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5173";
      const response = await fetch(
        `${API_URL}/api/admin/netlify-stats?page=${currentPage}&limit=10`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to fetch Netlify stats");
      return response.json();
    },
  });

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Netlify
          </h1>
          <p className="text-muted-foreground">
            Deploy and host applications with Netlify integration
          </p>
        </div>

        {/* Stats Overview */}
        {!isLoading && stats && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Deployments
                      </p>
                      <p className="text-2xl font-bold">
                        {stats.totalDeployments}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Successful
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {stats.successfulDeployments}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Failed</p>
                      <p className="text-2xl font-bold text-red-600">
                        {stats.failedDeployments}
                      </p>
                    </div>
                    <XCircle className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Success Rate
                      </p>
                      <p className="text-2xl font-bold">{stats.successRate}%</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-primary" />
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
            </div>

            {/* Daily Deployments Chart */}
            {stats.dailyDeployments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Daily Deployments (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.dailyDeployments}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#00AD9F" name="Deployments" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Recent Deployments */}
            {stats.recentDeployments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Deployments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.recentDeployments.map((deployment) => (
                      <div
                        key={deployment.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <a
                            href={deployment.deploymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {deployment.deploymentUrl}
                          </a>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(deployment.deployedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="ml-4">
                          {deployment.status === "success" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              Success
                            </span>
                          )}
                          {deployment.status === "failed" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                              <XCircle className="h-4 w-4" />
                              Failed
                            </span>
                          )}
                          {deployment.status === "pending" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600">
                              <Clock className="h-4 w-4" />
                              Pending
                            </span>
                          )}
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
              name: "Netlify",
              icon: SiNetlify,
              description: "Deploy and host your applications with Netlify",
              color: "text-teal-600",
              bgColor: "bg-teal-600/10",
              docs: "https://docs.netlify.com",
            }}
          />
        </div>
      </div>
    </div>
  );
}
