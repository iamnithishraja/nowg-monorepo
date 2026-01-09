export interface OrganizationType {
  id: string;
  name: string;
  description: string;
  orgAdminId: string | null;
  orgAdmin: {
    id: string;
    email: string;
    name: string;
  } | null;
  allowedDomains: string[];
  status: string;
  invitationStatus: "pending" | "accepted" | "rejected" | null;
  invitedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectType {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
  } | null;
  projectAdminId: string | null;
  projectAdmin: {
    id: string;
    email: string;
    name: string;
  } | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: string;
  tokenUsageToday: number;
}

export interface WalletData {
  id: string;
  organizationId?: string;
  projectId?: string;
  projectName?: string;
  organizationName?: string;
  balance: number;
  transactionCount?: number;
}

export interface ProjectMember {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  role: string;
  status: string;
}
