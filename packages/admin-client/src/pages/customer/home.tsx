import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code, Zap, Wallet, Settings, Plus, Clock, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import type { User, Project } from "@shared/schema";

type DashboardStats = {
  totalProjects: number;
  activeProjects: number;
  tokenUsage: number;
  walletBalance: number;
};

export default function CustomerHome() {
  const { user } = useAuth();

  const {
    data: stats = {
      totalProjects: 0,
      activeProjects: 0,
      tokenUsage: 0,
      walletBalance: 0,
    },
  } = useQuery<DashboardStats>({
    queryKey: ["/api/customer/dashboard/stats"],
  });

  const { data: recentProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", "recent", { limit: 5 }],
  });

  const quickActions = [
    {
      icon: Plus,
      title: "New Project",
      description: "Start a new project",
      href: "/projects",
      variant: "default" as const,
    },
    {
      icon: Wallet,
      title: "Add Credits",
      description: "Top up your wallet",
      href: "/wallet",
      variant: "outline" as const,
    },
    {
      icon: Settings,
      title: "Settings",
      description: "Manage your account",
      href: "/settings",
      variant: "outline" as const,
    },
  ];

  return (
    <div className="flex-1 p-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-welcome">
              Welcome back, {user?.firstName || "Developer"}!
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your projects today
            </p>
          </div>
          <Link href="/projects" data-testid="link-new-project-hero">
            <Button size="lg" data-testid="button-new-project">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <section className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Projects
              </CardTitle>
              <Code className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold"
                data-testid="stat-total-projects"
              >
                {stats?.totalProjects ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All your projects
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Projects
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold"
                data-testid="stat-active-projects"
              >
                {stats?.activeProjects ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently running
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
              <Code className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold"
                data-testid="stat-token-usage"
              >
                {(stats?.tokenUsage ?? 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Wallet Balance
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold"
                data-testid="stat-wallet-balance"
              >
                ${(stats?.walletBalance ?? 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Available credits
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            const actionSlug = action.title.toLowerCase().replace(/\s+/g, "-");
            return (
              <Link
                key={i}
                href={action.href}
                data-testid={`link-quick-action-${actionSlug}`}
              >
                <Card
                  className="hover-elevate cursor-pointer"
                  data-testid={`card-quick-action-${actionSlug}`}
                >
                  <CardHeader>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {action.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Projects */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-xl font-semibold">Recent Projects</h2>
          <Link href="/projects" data-testid="link-view-all-projects">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-view-all-projects"
            >
              View All
            </Button>
          </Link>
        </div>

        {recentProjects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Get started by creating your first project
              </p>
              <Link href="/projects" data-testid="link-create-first-project">
                <Button data-testid="button-create-first-project">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {recentProjects.map((project) => (
              <Card key={project.id} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <CardTitle
                          className="text-lg"
                          data-testid={`project-name-${project.id}`}
                        >
                          {project.name}
                        </CardTitle>
                        {project.framework && (
                          <Badge
                            variant="outline"
                            data-testid={`project-framework-${project.id}`}
                          >
                            {project.framework}
                          </Badge>
                        )}
                        {project.visibility === "public" && (
                          <Badge
                            variant="secondary"
                            data-testid={`project-visibility-${project.id}`}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Public
                          </Badge>
                        )}
                        {project.isPublished && (
                          <Badge
                            variant="default"
                            data-testid={`project-published-${project.id}`}
                          >
                            Published
                          </Badge>
                        )}
                      </div>
                      {project.description && (
                        <p
                          className="text-sm text-muted-foreground line-clamp-2"
                          data-testid={`project-description-${project.id}`}
                        >
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                        <div
                          className="flex items-center gap-1"
                          data-testid={`project-updated-${project.id}`}
                        >
                          <Clock className="h-3 w-3" />
                          Updated{" "}
                          {format(new Date(project.updatedAt), "MMM d, yyyy")}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/projects?view=${project.id}`}
                      data-testid={`link-view-project-${project.id}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-view-project-${project.id}`}
                      >
                        View Project
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
