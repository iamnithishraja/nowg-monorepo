import { useQuery } from "@tanstack/react-query";
import { Buildings, FolderSimple } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { adminClient } from "~/lib/adminClient";
import type { OrganizationType, ProjectType } from "./types";

interface ProjectAdminGeneralSettingsProps {
  projects: ProjectType[];
  isLoading: boolean;
}

export function ProjectAdminGeneralSettings({
  projects,
  isLoading,
}: ProjectAdminGeneralSettingsProps) {
  const navigate = useNavigate();

  // Get organization ID from the first project (all projects should have the same org for project_admin)
  const organizationId =
    projects.length > 0 ? projects[0]?.organizationId : undefined;

  // Fetch organization details
  const { data: organizationData, isLoading: orgLoading } = useQuery<{
    success: boolean;
    organization: OrganizationType;
  }>({
    queryKey: ["/api/admin/organizations", organizationId],
    queryFn: () =>
      adminClient.get<{
        success: boolean;
        organization: OrganizationType;
      }>(`/api/admin/organizations/${organizationId}`),
    enabled: !!organizationId && projects.length > 0,
  });

  const organization = organizationData?.organization;

  if (isLoading || orgLoading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>

        {/* Form skeleton */}
        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-16 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <Card className="bg-surface-1 border-subtle">
        <CardContent className="py-8">
          <div className="text-center text-tertiary">
            <Buildings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No organization found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-primary tracking-[-0.56px] leading-[1.2]">
          General Settings
        </h1>
        <p className="text-[15px] text-secondary mt-2 tracking-[-0.3px] leading-[1.5]">
          View your organization's profile and projects
        </p>
      </div>

      <div className="space-y-8 w-full">
        {/* Main Settings */}
        <div className="space-y-8">
          {/* Organization Settings Card */}
          <Card className="bg-surface-1 border border-subtle rounded-[16px] overflow-hidden">
            <CardContent className="p-8 space-y-8">
              {/* Organization Name */}
              <div className="space-y-3">
                <Label className="text-[14px] font-medium text-secondary tracking-[-0.28px]">
                  Company Name
                </Label>
                <div className="h-12 bg-surface-2 border border-subtle text-primary text-[15px] rounded-lg px-4 flex items-center">
                  {organization.name || "N/A"}
                </div>
                <p className="text-[13px] text-tertiary tracking-[-0.26px]">
                  Your full Company name, as visible to others.
                </p>
              </div>

              {/* Organization Icon */}
              <div className="space-y-3">
                <Label className="text-[14px] font-medium text-secondary tracking-[-0.28px]">
                  Organization Icon
                </Label>
                <div className="flex items-start gap-4">
                  {/* Logo Preview */}
                  <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden border-2 border-subtle bg-surface-2 flex items-center justify-center">
                    {organization.logoUrl ? (
                      <img
                        src={organization.logoUrl}
                        alt="Organization logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Buildings className="h-8 w-8 text-tertiary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] text-tertiary tracking-[-0.26px] leading-[1.5]">
                      Upload an image or pick an emoji that best represents your
                      Organization. Recommended size is 256x256px.
                    </p>
                  </div>
                </div>
              </div>

              {/* Organization Description */}
              <div className="space-y-3">
                <Label className="text-[14px] font-medium text-secondary tracking-[-0.28px]">
                  Company Description
                </Label>
                <div className="min-h-[72px] bg-surface-2 border border-subtle text-primary text-[15px] rounded-lg px-4 py-3">
                  {organization.description || "No description provided"}
                </div>
                <p className="text-[13px] text-tertiary tracking-[-0.26px]">
                  Short description about your company or team.
                </p>
              </div>

              {/* Allowed Domains */}
              <div className="space-y-3">
                <Label className="text-[14px] font-medium text-secondary tracking-[-0.28px]">
                  Allowed Domains
                </Label>
                <p className="text-[13px] text-tertiary tracking-[-0.26px]">
                  Email domains allowed for this organization
                </p>
                <div className="mt-3">
                  {organization.allowedDomains &&
                  organization.allowedDomains.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {organization.allowedDomains.map((domain, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-[13px] px-3 py-1.5 bg-surface-2 text-secondary border-subtle rounded-lg"
                        >
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[14px] text-tertiary">
                      No domain restrictions (all domains allowed)
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Projects List Card */}
          <Card className="bg-surface-1 border border-subtle rounded-[16px] overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-3">
                <Label className="text-[14px] font-medium text-secondary tracking-[-0.28px]">
                  Your Projects
                </Label>
                <p className="text-[13px] text-tertiary tracking-[-0.26px]">
                  Projects where you are a project administrator
                </p>
              </div>

              {projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-4 bg-surface-2 border border-subtle rounded-lg hover:border-[#7b4cff]/30 transition-colors cursor-pointer group"
                      onClick={() =>
                        navigate(`/admin/projects/${project.id}/wallet`)
                      }
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-[#7b4cff]/10 flex items-center justify-center group-hover:bg-[#7b4cff]/20 transition-colors">
                          <FolderSimple
                            className="h-5 w-5 text-[#7b4cff]"
                            weight="fill"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-[15px] font-medium text-primary">
                            {project.name}
                          </div>
                          <div className="text-[13px] text-tertiary mt-0.5">
                            {project.description || "No description"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            project.status === "active"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            project.status === "active"
                              ? "bg-success-500/20 text-[#22c55e] border-[#22c55e]/30"
                              : "bg-surface-2 text-secondary border-subtle"
                          }
                        >
                          {project.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-tertiary">
                  <FolderSimple className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No projects found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
