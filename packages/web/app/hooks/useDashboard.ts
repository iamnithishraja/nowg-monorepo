import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient } from "~/lib/adminClient";
import type {
  DashboardStats,
  OrganizationType,
  ProjectType,
  WalletData,
  ProjectMember,
} from "~/components/admin/dashboard/types";

export function useDashboardStats(enabled: boolean) {
  return useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: () => adminClient.get<DashboardStats>("/api/admin/dashboard/stats"),
    enabled,
  });
}

export function useOrganization(enabled: boolean) {
  return useQuery<{ organizations: OrganizationType[] }>({
    queryKey: ["/api/admin/organizations", 1],
    queryFn: () =>
      adminClient.get<{ organizations: OrganizationType[] }>(
        "/api/admin/organizations",
        {
          params: {
            page: 1,
            limit: 1,
          },
        }
      ),
    enabled,
  });
}

export function useOrgWallet(
  organizationId: string | undefined,
  enabled: boolean
) {
  return useQuery<{ wallet: WalletData }>({
    queryKey: ["/api/admin/org-wallets", organizationId],
    queryFn: () =>
      adminClient.get<{ wallet: WalletData }>(
        `/api/admin/org-wallets/${organizationId}`
      ),
    enabled: !!organizationId && enabled,
  });
}

export function useProject(enabled: boolean) {
  return useQuery<{ projects: ProjectType[] }>({
    queryKey: ["/api/admin/projects", "all"],
    queryFn: () =>
      adminClient.get<{ projects: ProjectType[] }>("/api/admin/projects", {
        params: {
          page: 1,
          limit: 100, // Fetch all projects (reasonable limit for project admins)
        },
      }),
    enabled,
  });
}

export function useProjectWallet(
  projectId: string | undefined,
  enabled: boolean
) {
  return useQuery<{ wallet: WalletData }>({
    queryKey: ["/api/admin/project-wallets", projectId],
    queryFn: () =>
      adminClient.get<{ wallet: WalletData }>(
        `/api/admin/project-wallets/${projectId}`
      ),
    enabled: !!projectId && enabled,
  });
}

export function useProjectMembers(
  projectId: string | undefined,
  enabled: boolean
) {
  return useQuery<{
    members: ProjectMember[];
    project: {
      id: string;
      name: string;
    };
  }>({
    queryKey: ["/api/admin/projects/:projectId/members", projectId],
    queryFn: () =>
      adminClient.get<{
        members: ProjectMember[];
        project: {
          id: string;
          name: string;
        };
      }>(`/api/admin/projects/${projectId}/members`),
    enabled: !!projectId && enabled,
  });
}

export function useStripeCheckout(organizationId: string | undefined) {
  return useMutation({
    mutationFn: async (data: { amount: number }) => {
      // Get user's country code from browser location
      const { getCountryCodeForPayment } = await import("~/utils/payment");
      const countryCode = await getCountryCodeForPayment();
      
      const response = await adminClient.post<{ 
        provider: string;
        url?: string; 
        sessionId: string;
        keyId?: string;
        formData?: Record<string, string>;
        formAction?: string;
      }>(
        `/api/admin/org-wallets/${organizationId}/stripe-checkout`,
        { ...data, countryCode }
      );
      return { ...response, amount: data.amount }; // Include amount for handler
    },
    onSuccess: async (data) => {
      if (data) {
        const { handlePaymentResponse } = await import("~/utils/payment");
        await handlePaymentResponse(data, data.amount);
      }
    },
    onError: (error: any) => {
      console.error("Payment checkout error:", error);
    },
  });
}

export function useStripeVerify(
  organizationId: string | undefined,
  onSuccessCallback?: () => void
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      return adminClient.post(
        `/api/admin/org-wallets/${organizationId}/stripe-verify`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId],
      });
      onSuccessCallback?.();
    },
    onError: (error: Error) => {
      console.error("Failed to verify payment:", error);
    },
  });
}

