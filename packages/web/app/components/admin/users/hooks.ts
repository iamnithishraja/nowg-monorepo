import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminClient } from "~/lib/adminClient";
import type { UsersResponse, UserDetailType, OrgUser } from "./types";

export function useCurrentUser() {
  return useQuery<{
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    image?: string;
    createdAt: string;
    updatedAt: string;
    organizationId?: string;
    projectId?: string;
    hasOrgAdminAccess?: boolean;
    hasProjectAdminAccess?: boolean;
  }>({
    queryKey: ["/api/admin/me"],
    queryFn: () => adminClient.get("/api/admin/me"),
    retry: false,
  });
}

export function useUsers(page: number, searchQuery: string) {
  return useQuery<UsersResponse>({
    queryKey: ["/api/admin/users", page, searchQuery],
    queryFn: () => {
      return adminClient.get<UsersResponse>("/api/admin/users", {
        params: {
          page,
          limit: 10,
          ...(searchQuery && { search: searchQuery }),
        },
      });
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useUserDetail(userId: string | null, enabled: boolean) {
  return useQuery<UserDetailType>({
    queryKey: ["/api/admin/user-detail", userId],
    queryFn: () =>
      adminClient.get<UserDetailType>("/api/admin/user-detail", {
        params: { userId: userId! },
      }),
    enabled: !!userId && enabled,
  });
}

export function useOrganizations(enabled: boolean) {
  return useQuery<{
    organizations: Array<{ id: string; name: string }>;
  }>({
    queryKey: ["/api/admin/organizations", "all"],
    queryFn: () => {
      return adminClient.get<{
        organizations: Array<{ id: string; name: string }>;
      }>("/api/admin/organizations", {
        params: {
          page: 1,
          limit: 100,
        },
      });
    },
    enabled,
  });
}

export function useOrgUsers(organizationId: string | undefined) {
  return useQuery<{ users: OrgUser[] }>({
    queryKey: [
      "/api/admin/organizations/:organizationId/users",
      organizationId,
    ],
    queryFn: () =>
      adminClient.get<{ users: OrgUser[] }>(
        `/api/admin/organizations/${organizationId}/users`
      ),
    enabled: !!organizationId && organizationId.length > 0,
    retry: false,
  });
}

export function useProjectAdminUsers(enabled: boolean) {
  return useQuery<{ users: OrgUser[]; organization?: { id: string; name: string; logoUrl?: string | null } }>({
    queryKey: ["/api/admin/project-admin/users"],
    queryFn: () =>
      adminClient.get<{ users: OrgUser[]; organization?: { id: string; name: string; logoUrl?: string | null } }>(
        "/api/admin/project-admin/users"
      ),
    enabled,
    retry: false,
  });
}

export function useAvailableOrgUsers(
  organizationId: string | undefined,
  projectId: string | undefined,
  enabled: boolean
) {
  return useQuery<{ users: OrgUser[] }>({
    queryKey: [
      "/api/admin/organizations/:organizationId/available-users",
      organizationId,
      projectId,
    ],
    queryFn: () =>
      adminClient.get<{ users: OrgUser[] }>(
        `/api/admin/organizations/${organizationId}/available-users`,
        { params: { projectId: projectId! } }
      ),
    enabled: !!(organizationId && projectId && enabled),
  });
}

export function useInviteAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      return adminClient.post<{ message?: string }>("/api/admin/users", {
        action: "inviteAdmin",
        email,
      });
    },
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast.success(data?.message || "Admin invitation sent successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return adminClient.post("/api/admin/update-role", { userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast.success("User role updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useSearchUser() {
  return useMutation({
    mutationFn: async (email: string) => {
      return adminClient.get<{ user: OrgUser }>(
        "/api/admin/organizations/search-user",
        { params: { email } }
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "No user found with this email");
    },
  });
}

export function useInviteOrgUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { orgId: string; email: string }) => {
      return adminClient.post(
        `/api/admin/organizations/${data.orgId}/invite-user`,
        {
          email: data.email,
        }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations/:organizationId/users"],
      });
      toast.success("User invited to organization successfully");
    },
    onError: (error: any) => {
      // Extract error message from structured error data
      let errorMessage = "Failed to invite user to organization";
      let errorTitle = "Error";

      // Check if error has structured data (from improved adminClient)
      if (error?.data) {
        errorMessage = error.data.message || error.data.error || errorMessage;
        errorTitle = error.data.error || errorTitle;
      } else if (error instanceof Error) {
        // Fallback: Try to parse error message which might be in format "400: {error: '...', message: '...'}"
        const message = error.message;
        try {
          // Try to parse JSON from error message
          const jsonMatch = message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.message || errorData.error || message;
            errorTitle = errorData.error || errorTitle;
          } else {
            errorMessage = message;
          }
        } catch (parseError) {
          // If parsing fails, use the message as is
          errorMessage = message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      // Always show toast - this is critical for user feedback
      toast.error(errorMessage);
    },
  });
}

export function useRemoveOrgUser(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      return adminClient.delete(
        `/api/admin/organizations/${organizationId}/users/${userId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations/:organizationId/users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations"],
      });
      toast.success("User removed from organization successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddToProject(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      return adminClient.post(`/api/admin/projects/${projectId}/members`, {
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast.success("User added to project successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add user to project");
    },
  });
}

export function useUserProjectWallets(
  userId: string | undefined,
  enabled: boolean
) {
  return useQuery<{
    wallets: Array<{
      id: string;
      userId: string;
      projectId: string;
      projectName: string;
      organizationId: string;
      organizationName: string;
      balance: number;
      limit: number | null;
      currentSpending: number;
      transactionCount: number;
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    queryKey: ["/api/admin/user-project-wallets/user/:userId", userId],
    queryFn: () =>
      adminClient.get<{
        wallets: Array<{
          id: string;
          userId: string;
          projectId: string;
          projectName: string;
          organizationId: string;
          organizationName: string;
          balance: number;
          limit: number | null;
          currentSpending: number;
          transactionCount: number;
          createdAt: string;
          updatedAt: string;
        }>;
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasMore: boolean;
        };
      }>(`/api/admin/user-project-wallets/user/${userId}`, {
        params: { page: 1, limit: 100 },
      }),
    enabled: !!userId && enabled,
    retry: false,
  });
}

export function useUpdateUserProjectWalletLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      userId,
      limit,
    }: {
      projectId: string;
      userId: string;
      limit: number | null;
    }) => {
      return adminClient.put(
        `/api/admin/user-project-wallets/${projectId}/${userId}/set-limit`,
        { limit }
      );
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          "/api/admin/user-project-wallets/user/:userId",
          variables.userId,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations/:organizationId/users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/user-project-wallets/project/:projectId"],
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to update wallet limit";
      if (error?.data) {
        errorMessage = error.data.message || error.data.error || errorMessage;
      } else if (error instanceof Error) {
        const message = error.message;
        try {
          const jsonMatch = message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.message || errorData.error || message;
          } else {
            errorMessage = message;
          }
        } catch {
          errorMessage = message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    },
  });
}

export function useUpdateOrganizationRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      role,
    }: {
      organizationId: string;
      userId: string;
      role: string;
    }) => {
      return adminClient.put(
        `/api/admin/organizations/${organizationId}/users/${userId}/role`,
        { role }
      );
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations/:organizationId/users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations"],
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to update organization role";
      if (error?.data) {
        errorMessage = error.data.message || error.data.error || errorMessage;
      } else if (error instanceof Error) {
        const message = error.message;
        try {
          const jsonMatch = message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.message || errorData.error || message;
          } else {
            errorMessage = message;
          }
        } catch {
          errorMessage = message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    },
  });
}

export function useUpdateProjectRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      userId,
      role,
    }: {
      projectId: string;
      userId: string;
      role: string;
    }) => {
      return adminClient.put(
        `/api/admin/projects/${projectId}/users/${userId}/role`,
        { role }
      );
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations/:organizationId/users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/projects/:projectId/members"],
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to update project role";
      if (error?.data) {
        errorMessage = error.data.message || error.data.error || errorMessage;
      } else if (error instanceof Error) {
        const message = error.message;
        try {
          const jsonMatch = message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.message || errorData.error || message;
          } else {
            errorMessage = message;
          }
        } catch {
          errorMessage = message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    },
  });
}
