import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { UsersResponse, UserDetailType, OrgUser } from "./types";

export function useUsers(page: number, searchQuery: string) {
  return useQuery<UsersResponse>({
    queryKey: ["/api/admin/users", page, searchQuery],
    queryFn: () => {
      return client.get<UsersResponse>("/api/admin/users", {
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
      client.get<UserDetailType>("/api/admin/user-detail", {
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
      return client.get<{ organizations: Array<{ id: string; name: string }> }>(
        "/api/admin/organizations",
        {
          params: {
            page: 1,
            limit: 100,
          },
        }
      );
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
      client.get<{ users: OrgUser[] }>(
        `/api/admin/organizations/${organizationId}/users`
      ),
    enabled: !!organizationId && organizationId.length > 0,
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
      client.get<{ users: OrgUser[] }>(
        `/api/admin/organizations/${organizationId}/available-users`,
        {
          params: { projectId },
        }
      ),
    enabled: !!(organizationId && projectId && enabled),
  });
}

export function useInviteAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (email: string) => {
      return client.post<{ message?: string }>("/api/admin/users", {
        action: "inviteAdmin",
        email,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: data?.message || "Admin invitation sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return client.post("/api/admin/update-role", { userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useSearchUser() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (email: string) => {
      return client.get<{ user: OrgUser }>(
        "/api/admin/organizations/search-user",
        {
          params: { email },
        }
      );
    },
    onError: (error: Error) => {
      toast({
        title: "User not found",
        description: error.message || "No user found with this email",
        variant: "destructive",
      });
    },
  });
}

export function useInviteOrgUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { orgId: string; email: string }) => {
      return client.post(`/api/admin/organizations/${data.orgId}/invite-user`, {
        email: data.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations/:organizationId/users"],
      });
      toast({
        title: "Success",
        description: "User invited to organization successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useRemoveOrgUser(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      return client.delete(
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
      toast({
        title: "Success",
        description: "User removed from organization successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useAddToProject(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      return client.post(`/api/admin/projects/${projectId}/members`, {
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User added to project successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add user to project",
        variant: "destructive",
      });
    },
  });
}

export function useSendVerificationEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      return client.post<{ message?: string; alreadyVerified?: boolean }>(
        "/api/admin/users/send-verification-email",
        { userId }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: data?.message || "Verification email sent successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error || error.message || "Failed to send verification email";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}

export function useSendVerificationEmailsToAll() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      return client.post<{
        message?: string;
        sent?: number;
        failed?: number;
        total?: number;
      }>("/api/admin/users/send-verification-emails-all");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description:
          data?.message ||
          `Verification emails sent to ${data?.sent || 0} users`,
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error.message ||
        "Failed to send verification emails";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}
