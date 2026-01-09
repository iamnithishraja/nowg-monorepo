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
  invitationStatus: "pending" | "accepted" | "rejected" | null;
  invitedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationType {
  id: string;
  name: string;
}

export interface ProjectsResponse {
  projects: ProjectType[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface OrganizationsResponse {
  organizations: OrganizationType[];
}

export interface AvailableUser {
  id: string;
  email: string;
  name: string;
}

export interface OrgWalletData {
  wallet: {
    id: string;
    balance: number;
    organizationId: string;
  };
}
