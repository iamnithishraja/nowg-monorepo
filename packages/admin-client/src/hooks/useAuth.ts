import { useSession } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";

export function useAuth() {
  const { data: session, isPending, error } = useSession();

  // Fetch user with org admin flags from custom endpoint
  const { data: userWithFlags } = useQuery<{
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
    queryFn: () => client.get("/api/admin/me"),
    enabled: !!session?.user, // Only fetch if user is logged in
    retry: false, // Don't retry on 401
  });

  // Merge Better Auth session user with org admin flags
  const user = session?.user
    ? {
        ...session.user,
        ...(userWithFlags || {}),
        // Prefer role from userWithFlags if available (includes org_admin from middleware)
        role: userWithFlags?.role || (session.user as any)?.role,
        hasOrgAdminAccess: userWithFlags?.hasOrgAdminAccess || false,
        hasProjectAdminAccess: userWithFlags?.hasProjectAdminAccess || false,
        organizationId:
          userWithFlags?.organizationId ||
          (session.user as any)?.organizationId,
        projectId: userWithFlags?.projectId || (session.user as any)?.projectId,
      }
    : undefined;

  return {
    user,
    session: session?.session,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    error,
  };
}
