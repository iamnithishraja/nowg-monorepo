import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import {
  DashboardStats,
  OrganizationType,
  ProjectType,
  WalletData,
  ProjectMember,
} from "./types";

export function useDashboardStats(enabled: boolean) {
  return useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: () => client.get<DashboardStats>("/api/admin/dashboard/stats"),
    enabled,
  });
}

export function useOrganization(enabled: boolean) {
  return useQuery<{ organizations: OrganizationType[] }>({
    queryKey: ["/api/admin/organizations", 1],
    queryFn: () =>
      client.get<{ organizations: OrganizationType[] }>(
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
      client.get<{ wallet: WalletData }>(
        `/api/admin/org-wallets/${organizationId}`
      ),
    enabled: !!organizationId && enabled,
  });
}

export function useProject(enabled: boolean) {
  return useQuery<{ projects: ProjectType[] }>({
    queryKey: ["/api/admin/projects", 1],
    queryFn: () =>
      client.get<{ projects: ProjectType[] }>("/api/admin/projects", {
        params: {
          page: 1,
          limit: 1,
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
      client.get<{ wallet: WalletData }>(
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
      client.get<{
        members: ProjectMember[];
        project: {
          id: string;
          name: string;
        };
      }>(`/api/admin/projects/${projectId}/members`),
    enabled: !!projectId && enabled,
  });
}

export function useAddCredits(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return client.post(
        `/api/admin/org-wallets/${organizationId}/add-credits`,
        data
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId],
      });
      toast({
        title: "Credits Added",
        description: `Successfully added ${variables.amount} credits to the wallet`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add credits",
        variant: "destructive",
      });
    },
  });
}

export function useStripeCheckout(organizationId: string | undefined) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { amount: number }) => {
      // Get user's country code from browser location
      const { getCountryCodeForPayment } = await import("@/utils/payment");
      const countryCode = await getCountryCodeForPayment();
      console.log("🌍 Detected country code:", countryCode);

      const response = await client.post<{ 
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
      return { ...response, amount: data.amount };
    },
    onSuccess: async (data) => {
      if (data) {
        const { handlePaymentResponse } = await import("@/utils/payment");
        await handlePaymentResponse(data, data.amount);
      }
    },
    onError: (error: any) => {
      console.error("Stripe checkout error:", error);
      toast({
        title: "Error",
        description:
          error?.message ||
          "Failed to create checkout session. Please check your Stripe configuration.",
        variant: "destructive",
      });
    },
  });
}

export function useStripeVerify(
  organizationId: string | undefined,
  onSuccessCallback?: () => void
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      return client.post(
        `/api/admin/org-wallets/${organizationId}/stripe-verify`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId],
      });
      toast({
        title: "Payment Successful",
        description: "Credits have been added to your wallet",
      });
      onSuccessCallback?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to verify payment",
        variant: "destructive",
      });
    },
  });
}

