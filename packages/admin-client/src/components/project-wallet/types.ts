export interface WalletData {
  id: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  balance: number;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy: string;
  relatedOrgWalletTransactionId: string | null;
  createdAt: string;
}

export interface WalletResponse {
  wallet: WalletData;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  wallet: {
    id: string;
    projectId: string;
    projectName: string;
    balance: number;
  };
}

export interface UserWallet {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  balance: number; // Deprecated - always 0, users don't have balance
  limit?: number | null;
  currentSpending?: number; // Current spending against limit (tracks usage)
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export interface UserWalletsResponse {
  wallets: UserWallet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
