import { useQuery } from "@tanstack/react-query";
import { Plus, Folder, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@shared/schema";

export default function Projects() {
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  return (
    <div className="flex-1 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            My Projects
          </h1>
          <Button data-testid="button-create-project">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="hover-elevate cursor-pointer"
                data-testid={`card-project-${project.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Folder className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                    </div>
                    {project.isPublished && (
                      <Globe className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {project.description || "No description"}
                  </p>
                  <div className="flex items-center gap-2">
                    {project.framework && (
                      <Badge variant="secondary">{project.framework}</Badge>
                    )}
                    <Badge
                      variant={
                        project.visibility === "public"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {project.visibility}
                    </Badge>
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-24">
              <Folder className="h-20 w-20 text-muted-foreground mb-6" />
              <h3 className="text-xl font-medium mb-2">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Create your first project to get started building amazing
                applications.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
