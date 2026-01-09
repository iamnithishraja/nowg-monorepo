export interface LedgerTransaction {
  id: string;
  walletType: "organization" | "project" | "user_project";
  walletId: string;
  transactionType: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy: string;
  performedByName?: string;
  createdAt: string;
  organizationId?: string;
  organizationName?: string;
  projectId?: string;
  projectName?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  source?: string;
  stripePaymentId?: string;
  fromAddress?: string | null;
  fromAddressType?: "organization" | "project" | "user_project" | null;
  fromAddressName?: string;
  toAddress?: string | null;
  toAddressType?: "organization" | "project" | "user_project" | null;
  toAddressName?: string;
}

export interface LedgerResponse {
  transactions: LedgerTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  summary: {
    totalTransactions: number;
    totalCredits: number;
    totalDebits: number;
    netFlow: number;
    byWalletType: {
      organization: number;
      project: number;
      user_project: number;
    };
  };
}

export interface UserBalance {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  balance: number;
  limit: number | null;
  transactionCount: number;
  lastTransactionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserBalancesResponse {
  wallets: UserBalance[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  summary: {
    totalWallets: number;
    totalBalance: number;
    uniqueUsers: number;
    uniqueProjects: number;
    uniqueOrganizations: number;
  };
}

export interface WalletSummaryResponse {
  organizationWallets: {
    count: number;
    totalBalance: number;
    totalTransactions: number;
  };
  projectWallets: {
    count: number;
    totalBalance: number;
    totalTransactions: number;
  };
  userProjectWallets: {
    count: number;
    totalBalance: number;
    totalTransactions: number;
    uniqueUsers: number;
    uniqueProjects: number;
  };
  overall: {
    totalWallets: number;
    totalBalance: number;
    totalTransactions: number;
  };
}

export interface FilterOrganization {
  id: string;
  name: string;
}

export interface FilterProject {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
}

