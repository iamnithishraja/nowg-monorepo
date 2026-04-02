export interface UserType {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  image?: string;
  balance?: number;
  totalTokens?: number;
}

export interface UserDetailType extends UserType {
  name?: string;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  image?: string;
  isWhitelisted?: boolean;
  totalMessages?: number;
  totalConversations?: number;
  totalProjects?: number;
  totalCost?: number;
  deploymentStats?: {
    total: number;
    successful: number;
    failed: number;
    inProgress: number;
  };
  modelUsage?: Array<{
    model: string;
    tokens: number;
    messages: number;
    cost: number;
  }>;
  recentTransactions?: Array<{
    type: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description?: string;
    createdAt: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
  }>;
}

export interface UsersResponse {
  users: UserType[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: string;
  image?: string;
  createdAt?: string;
  joinedAt?: string;
  projects?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  creditsUsed?: number;
  creditsAvailable?: number | null;
  creditsLimit?: number | null;
  status?: string;
}

