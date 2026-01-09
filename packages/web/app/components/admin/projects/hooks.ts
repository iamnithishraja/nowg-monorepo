import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminClient } from "~/lib/adminClient";
import type {
    AvailableUser,
    OrganizationsResponse,
    OrgWalletData,
    ProjectsResponse,
} from "./index";

export function useProjects(
  page: number,
  searchQuery: string,
  organizationId: string
) {
  return useQuery<ProjectsResponse>({
    queryKey: ["/api/admin/projects", page, searchQuery, organizationId],
    queryFn: () =>
      adminClient.get<ProjectsResponse>("/api/admin/projects", {
        params: {
          page,
          limit: 10,
          ...(searchQuery && { search: searchQuery }),
          ...(organizationId && { organizationId }),
        },
      }),
    retry: 1,
  });
}

export function useOrganizations(enabled: boolean) {
  return useQuery<OrganizationsResponse>({
    queryKey: ["/api/admin/organizations"],
    queryFn: () =>
      adminClient.get<OrganizationsResponse>("/api/admin/organizations"),
    enabled,
  });
}

export function useOrgAdminOrganization(enabled: boolean) {
  return useQuery<OrganizationsResponse>({
    queryKey: ["/api/admin/organizations", "org-admin"],
    queryFn: () =>
      adminClient.get<OrganizationsResponse>("/api/admin/organizations", {
        params: {
          page: 1,
          limit: 1,
        },
      }),
    enabled,
    retry: 1,
  });
}

export function useAvailableAdminUsers(
  organizationId: string | undefined,
  projectId: string | undefined,
  enabled: boolean
) {
  return useQuery<{ users: AvailableUser[] }>({
    queryKey: [
      "/api/admin/organizations/:organizationId/available-users",
      "for-admin",
      organizationId,
      projectId,
    ],
    queryFn: () =>
      adminClient.get<{ users: AvailableUser[] }>(
        `/api/admin/organizations/${organizationId}/available-users`,
        {
          params: {
            forAdmin: "true",
            projectId: projectId || "",
          },
        }
      ),
    enabled: !!(organizationId && projectId && enabled),
  });
}

export function useOrgWallet(
  organizationId: string | undefined,
  enabled: boolean
) {
  return useQuery<OrgWalletData>({
    queryKey: ["/api/admin/org-wallets", organizationId],
    queryFn: () =>
      adminClient.get<OrgWalletData>(
        `/api/admin/org-wallets/${organizationId}`
      ),
    enabled: !!organizationId && enabled,
  });
}

export function useSearchUser() {
  return useMutation({
    mutationFn: async (email: string) => {
      return adminClient.get<{
        user: {
          id: string;
          email: string;
          name: string;
          role: string;
        };
      }>("/api/admin/organizations/search-user", {
        params: { email },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "No user found with this email");
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      organizationId: string;
      projectAdminId: string;
      initialFunding?: number;
      imageData?: string;
      imageName?: string;
      imageType?: string;
    }) => {
      return adminClient.post("/api/admin/projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/org-wallets"] });
      toast.success("Project created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      description?: string;
      status?: string;
    }) => {
      return adminClient.put(`/api/admin/projects/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast.success("Project updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAssignProjectAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { projectId: string; email: string }) => {
      return adminClient.post(
        `/api/admin/projects/${data.projectId}/assign-admin`,
        {
          email: data.email,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast.success("Project admin assigned successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUnassignProjectAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      return adminClient.delete(`/api/admin/projects/${projectId}/admin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast.success("Project admin unassigned successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return adminClient.delete(`/api/admin/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast.success("Project archived successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useTransferFunds(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      amount: number;
      description: string;
    }) => {
      return adminClient.post(
        `/api/admin/project-wallets/${data.projectId}/transfer-from-org`,
        {
          amount: data.amount,
          description: data.description,
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId],
      });
      toast.success(
        `Successfully transferred ${variables.amount} credits to project`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to transfer funds");
    },
  });
}
