import { adminClient } from "../../../lib/adminClient";

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
  messages?: number;
  conversations?: number;
}

export interface ProjectBreakdown {
  projectId: string;
  projectName: string;
  tokens: number;
  cost: string;
  messages?: number;
  conversations?: number;
  users?: number;
  status?: "active" | "completed" | "archived" | "draft";
  createdAt?: string;
  lastUpdated?: string;
  creditsUsage?: {
    current: number;
    max: number;
  };
  team?: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  conversationId?: string | null;
}

export interface OrganizationDeploymentStats {
  total: number;
  successful: number;
  failed: number;
  byProject?: ProjectDeploymentByProject[];
  byDayOfWeek?: DayOfWeekDeployment[];
}

export interface DayOfWeekDeployment {
  day: string;
  project1: number;
  project2: number;
  project3: number;
}

export interface ProjectDeploymentByProject {
  projectId: string;
  projectName: string;
  total: number;
  successful: number;
  failed: number;
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
  userBreakdown: UserBreakdown[];
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

export async function useProjectAnalytics(
  projectId: string | undefined
): Promise<ProjectAnalytics | null> {
  if (!projectId) return null;
  try {
    const data = await adminClient.get<ProjectAnalytics>(
      `/api/admin/analytics/project/${projectId}`
    );
    return data;
  } catch (error) {
    console.error("Failed to fetch project analytics:", error);
    return null;
  }
}

export async function useOrganizationAnalytics(
  organizationId: string | undefined
): Promise<OrganizationAnalytics | null> {
  if (!organizationId) return null;
  try {
    const data = await adminClient.get<OrganizationAnalytics>(
      `/api/admin/analytics/organization/${organizationId}`
    );
    return data;
  } catch (error) {
    console.error("Failed to fetch organization analytics:", error);
    return null;
  }
}

