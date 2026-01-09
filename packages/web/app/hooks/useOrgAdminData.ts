import { useState, useEffect } from "react";

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
}

export function useOrgAdminData(isOrgAdmin: boolean, selectedOrganizationId: string) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Fetch user organizations if org_admin
  useEffect(() => {
    if (isOrgAdmin) {
      const fetchOrganizations = async () => {
        try {
          const res = await fetch("/api/user-organizations", {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            const orgAdminOrgs =
              data.organizations?.filter(
                (org: any) => org.role === "org_admin"
              ) || [];
            setOrganizations(orgAdminOrgs);
          }
        } catch (error) {
          console.error("Error fetching organizations:", error);
        }
      };
      fetchOrganizations();
    }
  }, [isOrgAdmin]);

  // Fetch available users when organization is selected
  useEffect(() => {
    if (selectedOrganizationId && isOrgAdmin) {
      setIsLoadingUsers(true);
      const fetchAvailableUsers = async () => {
        try {
          const res = await fetch(
            `/api/admin/organizations/${selectedOrganizationId}/available-users?forAdmin=true`,
            {
              credentials: "include",
            }
          );
          if (res.ok) {
            const data = await res.json();
            setAvailableUsers(data.users || []);
          } else {
            setAvailableUsers([]);
          }
        } catch (error) {
          console.error("Error fetching available users:", error);
          setAvailableUsers([]);
        } finally {
          setIsLoadingUsers(false);
        }
      };
      fetchAvailableUsers();
    }
  }, [selectedOrganizationId, isOrgAdmin]);

  return {
    organizations,
    availableUsers,
    isLoadingUsers,
  };
}

