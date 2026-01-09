import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";

export interface ModelUsage {
  model: string;
  tokens: number;
  cost: number;
  count: number;
  percentage: string;
}

export interface DailyUsage {
  date: string;
  label: string;
  tokens: number;
  cost: number;
  count: number;
}

export interface UserBreakdown {
  userId: string;
  tokens: number;
  cost: string;
  count: number;
}

export interface ProjectBreakdown {
  projectId: string;
  projectName: string;
  tokens: number;
  cost: string;
  messages?: number;
  conversations?: number;
  users?: number;
}

export interface OrganizationDeploymentStats {
  total: number;
  successful: number;
  failed: number;
  byProject?: ProjectDeploymentByProject[];
}

export interface UserAnalytics {
  userId: string;
  totalCost: string;
  totalTokens: number;
  totalMessages: number;
  totalConversations: number;
  modelUsage: ModelUsage[];
  dailyUsage: DailyUsage[];
  balance: number;
}

export interface DeploymentByPlatform {
  platform: string;
  total: number;
  successful: number;
  failed: number;
  pending: number;
}

export interface DeploymentByUser {
  userId: string;
  total: number;
  successful: number;
  failed: number;
}

export interface DeploymentStats {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  byPlatform?: DeploymentByPlatform[];
  byUser?: DeploymentByUser[];
}

export interface ProjectDeploymentByProject {
  projectId: string;
  projectName: string;
  total: number;
  successful: number;
  failed: number;
}

export interface EnhancedUserBreakdown extends UserBreakdown {
  messages?: number;
  conversations?: number;
}

export interface ProjectAnalytics {
  projectId: string;
  projectName: string;
  totalCost: string;
  totalTokens: number;
  totalMessages: number;
  totalConversations: number;
  totalUsers: number;
  modelUsage: ModelUsage[];
  dailyUsage: DailyUsage[];
  userBreakdown: EnhancedUserBreakdown[];
  deployments?: DeploymentStats;
}

export interface OrganizationAnalytics {
  organizationId: string;
  totalCost: string;
  totalTokens: number;
  totalMessages: number;
  totalConversations: number;
  totalUsers: number;
  totalProjects: number;
  modelUsage: ModelUsage[];
  dailyUsage: DailyUsage[];
  projectBreakdown: ProjectBreakdown[];
  userBreakdown: UserBreakdown[];
  deployments?: OrganizationDeploymentStats;
}

export function useUserAnalytics(userId: string | undefined, enabled: boolean) {
  return useQuery<UserAnalytics>({
    queryKey: ["/api/admin/analytics/user", userId],
    queryFn: () =>
      client.get<UserAnalytics>(`/api/admin/analytics/user/${userId}`),
    enabled: !!userId && enabled,
    retry: 1,
  });
}

export function useProjectAnalytics(
  projectId: string | undefined,
  enabled: boolean
) {
  return useQuery<ProjectAnalytics>({
    queryKey: ["/api/admin/analytics/project", projectId],
    queryFn: () =>
      client.get<ProjectAnalytics>(`/api/admin/analytics/project/${projectId}`),
    enabled: !!projectId && enabled,
    retry: 1,
  });
}

export function useOrganizationAnalytics(
  organizationId: string | undefined,
  enabled: boolean
) {
  return useQuery<OrganizationAnalytics>({
    queryKey: ["/api/admin/analytics/organization", organizationId],
    queryFn: () =>
      client.get<OrganizationAnalytics>(
        `/api/admin/analytics/organization/${organizationId}`
      ),
    enabled: !!organizationId && enabled,
    retry: 1,
  });
}

export interface WalletDailyUsage {
  date: string;
  label: string;
  credits: number;
  debits: number;
  creditBacks: number;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy: string;
  stripePaymentId?: string;
  createdAt: string;
}

export interface WalletTransactionBreakdown {
  credits: WalletTransaction[];
  debits: WalletTransaction[];
  creditBacks: WalletTransaction[];
}

export interface OrganizationWalletAnalytics {
  organizationId: string;
  totalCredits: string;
  totalDebits: string;
  totalCreditBacks: string;
  netAmount: string;
  currentBalance: number;
  transactionCount: number;
  dailyUsage: WalletDailyUsage[];
  transactionBreakdown: WalletTransactionBreakdown;
}

export interface ProjectWalletAnalytics {
  projectId: string;
  projectName: string;
  totalCredits: string;
  totalDebits: string;
  totalCreditBacks: string;
  netAmount: string;
  currentBalance: number;
  transactionCount: number;
  dailyUsage: WalletDailyUsage[];
  transactionBreakdown: WalletTransactionBreakdown;
}

export function useOrganizationWalletAnalytics(
  organizationId: string | undefined,
  enabled: boolean
) {
  return useQuery<OrganizationWalletAnalytics>({
    queryKey: ["/api/admin/analytics/wallet/organization", organizationId],
    queryFn: () =>
      client.get<OrganizationWalletAnalytics>(
        `/api/admin/analytics/wallet/organization/${organizationId}`
      ),
    enabled: !!organizationId && enabled,
    retry: 1,
  });
}

export function useProjectWalletAnalytics(
  projectId: string | undefined,
  enabled: boolean
) {
  return useQuery<ProjectWalletAnalytics>({
    queryKey: ["/api/admin/analytics/wallet/project", projectId],
    queryFn: () =>
      client.get<ProjectWalletAnalytics>(
        `/api/admin/analytics/wallet/project/${projectId}`
      ),
    enabled: !!projectId && enabled,
    retry: 1,
  });
}


