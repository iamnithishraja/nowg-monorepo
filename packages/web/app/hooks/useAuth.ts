import { useQuery } from "@tanstack/react-query";
import { adminClient } from "~/lib/adminClient";

export function useAuth() {
  // Fetch user with org admin flags from custom endpoint
  const { data: userWithFlags, isLoading, error } = useQuery<{
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    image?: string;
    createdAt: string;
    updatedAt: string;
    organizationId?: string;
    projectId?: string;
    hasOrgAdminAccess?: boolean;
    hasProjectAdminAccess?: boolean;
  }>({
    queryKey: ["/api/admin/me"],
    queryFn: () => adminClient.get("/api/admin/me"),
    retry: false, // Don't retry on 401
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  return {
    user: userWithFlags,
    isLoading,
    isAuthenticated: !!userWithFlags,
    error,
  };
}

