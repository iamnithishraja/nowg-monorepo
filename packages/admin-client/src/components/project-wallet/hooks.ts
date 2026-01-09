import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import {
  WalletResponse,
  TransactionsResponse,
  UserWalletsResponse,
} from "./types";

export function useProjectWallet(projectId: string | undefined) {
  return useQuery<WalletResponse>({
    queryKey: ["/api/admin/project-wallets", projectId],
    queryFn: () =>
      client.get<WalletResponse>(`/api/admin/project-wallets/${projectId}`),
    enabled: !!projectId,
    retry: 1,
  });
}

export function useProjectWalletTransactions(
  projectId: string | undefined,
  page: number
) {
  return useQuery<TransactionsResponse>({
    queryKey: ["/api/admin/project-wallets", projectId, "transactions", page],
    queryFn: () =>
      client.get<TransactionsResponse>(
        `/api/admin/project-wallets/${projectId}/transactions`,
        {
          params: {
            page,
            limit: 10,
          },
        }
      ),
    enabled: !!projectId,
  });
}

export function useOrgWallet(
  organizationId: string | undefined,
  enabled: boolean
) {
  return useQuery<{
    wallet: { id: string; balance: number; organizationId: string };
  }>({
    queryKey: ["/api/admin/org-wallets", organizationId],
    queryFn: () =>
      client.get<{
        wallet: { id: string; balance: number; organizationId: string };
      }>(`/api/admin/org-wallets/${organizationId}`),
    enabled: !!organizationId && enabled,
  });
}

export function useUserProjectWallets(
  projectId: string | undefined,
  page: number
) {
  return useQuery<UserWalletsResponse>({
    queryKey: ["/api/admin/user-project-wallets/project", projectId, page],
    queryFn: () =>
      client.get<UserWalletsResponse>(
        `/api/admin/user-project-wallets/project/${projectId}`,
        {
          params: {
            page,
            limit: 20,
          },
        }
      ),
    enabled: !!projectId,
  });
}

export function useTransferFromOrg(
  projectId: string | undefined,
  organizationId: string | undefined
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return client.post(
        `/api/admin/project-wallets/${projectId}/transfer-from-org`,
        {
          amount: data.amount,
          description: data.description,
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId, "transactions"],
      });
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/org-wallets", organizationId],
        });
      }
      toast({
        title: "Transfer Successful",
        description: `Successfully transferred ${variables.amount} credits to this project`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to transfer funds",
        variant: "destructive",
      });
    },
  });
}

export function useStripeCheckout(projectId: string | undefined) {
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
        `/api/admin/project-wallets/${projectId}/stripe-checkout`,
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
  projectId: string | undefined,
  onSuccessCallback?: () => void
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      return client.post(
        `/api/admin/project-wallets/${projectId}/stripe-verify`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId, "transactions"],
      });
      toast({
        title: "Payment Successful",
        description: "Credits have been added to your project wallet",
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

export function useCreditBackToOrg(
  projectId: string | undefined,
  organizationId: string | undefined
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return client.post(
        `/api/admin/project-wallets/${projectId}/credit-back-to-org`,
        {
          amount: data.amount,
          description: data.description,
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId, "transactions"],
      });
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/org-wallets", organizationId],
        });
      }
      toast({
        title: "Credit Back Successful",
        description: `Successfully credited back ${variables.amount} to organization wallet`,
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to credit back funds";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}

export function useFundRequests(
  projectId: string | undefined,
  organizationId: string | undefined,
  enabled: boolean
) {
  return useQuery<{
    fundRequests: Array<{
      id: string;
      projectId: string;
      projectName: string;
      organizationId: string;
      organizationName: string;
      amount: number;
      description: string;
      status: "pending" | "approved" | "rejected";
      requestedBy: string;
      reviewedBy: string | null;
      reviewComments: string;
      createdAt: string;
      reviewedAt: string | null;
    }>;
  }>({
    queryKey: ["/api/admin/fund-requests", projectId, organizationId],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (projectId) params.projectId = projectId;
      if (organizationId) params.organizationId = organizationId;
      return client.get<{ fundRequests: any[] }>("/api/admin/fund-requests", {
        params,
      });
    },
    enabled: enabled && !!projectId,
  });
}

export function useCreateFundRequest(
  projectId: string | undefined,
  organizationId: string | undefined
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return client.post("/api/admin/fund-requests", {
        projectId,
        amount: data.amount,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      toast({
        title: "Request Created",
        description: "Fund request has been submitted for approval",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to create fund request";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}

export function useApproveFundRequest(
  projectId: string | undefined,
  organizationId: string | undefined
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { requestId: string; reviewComments?: string }) => {
      return client.post(`/api/admin/fund-requests/${data.requestId}/approve`, {
        reviewComments: data.reviewComments,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId, "transactions"],
      });
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/org-wallets", organizationId],
        });
      }
      toast({
        title: "Request Approved",
        description: "Funds have been transferred to the project",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to approve request";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}

export function useRejectFundRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { requestId: string; reviewComments?: string }) => {
      return client.post(`/api/admin/fund-requests/${data.requestId}/reject`, {
        reviewComments: data.reviewComments,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      toast({
        title: "Request Rejected",
        description: "Fund request has been rejected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });
}

export function useSetWalletLimit(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      limit,
    }: {
      userId: string;
      limit: number | null;
    }) => {
      return client.put(
        `/api/admin/user-project-wallets/${projectId}/${userId}/set-limit`,
        { limit }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/user-project-wallets/project", projectId],
      });
      toast({
        title: "Success",
        description: "Wallet limit updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update limit",
        variant: "destructive",
      });
    },
  });
}
