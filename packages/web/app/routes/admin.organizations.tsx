import { useQueryClient } from "@tanstack/react-query";
import { Building2, RefreshCw, Search, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, redirect } from "react-router";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { AdminLayout } from "../components/AdminLayout";
import { Button } from "../components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { adminClient } from "../lib/adminClient";
import { auth } from "../lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  return { user: session.user };
}

export function meta() {
  return [
    { title: "Organizations - Admin - Nowgai" },
    { name: "description", content: "Organization management" },
  ];
}

export default function AdminOrganizations() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const fetchOrganizations = async () => {
    try {
      const data = await adminClient.get<{ organizations: any[] }>(
        "/api/admin/organizations"
      );
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const filteredOrganizations = organizations.filter((org) =>
    org.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-[6px] accent-primary/10">
                <Building2 className="w-6 h-6 text-[#7b4cff]" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-primary">
                  Organizations
                </h1>
                <p className="text-secondary text-sm mt-0.5">
                  Manage and monitor all organizations
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
                <Input
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64 bg-surface-1 border-subtle text-primary placeholder:text-tertiary focus:border-[#555558]"
                />
              </div>
              <Button
                onClick={() => {
                  setIsLoading(true);
                  fetchOrganizations();
                }}
                size="sm"
                variant="outline"
                disabled={isLoading}
                className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558] transition-colors"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-[12px] bg-surface-1 border border-subtle">
              <Card className="bg-transparent border-0 shadow-none">
                <CardHeader className="border-b border-subtle px-5 py-3">
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-subtle hover:bg-transparent">
                      <TableHead className="text-secondary">Name</TableHead>
                      <TableHead className="text-secondary">Created</TableHead>
                      <TableHead className="text-secondary">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i} className="border-b border-subtle">
                        <TableCell>
                          <Skeleton className="h-4 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-24" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            </div>
          ) : (
            <div className="rounded-[12px] bg-surface-1 border border-subtle">
              <Card className="bg-transparent border-0 shadow-none">
                <CardHeader className="border-b border-subtle px-5 py-3">
                  <CardTitle className="text-primary text-lg font-medium">All Organizations</CardTitle>
                </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-subtle hover:bg-transparent">
                      <TableHead className="text-secondary">Name</TableHead>
                      <TableHead className="text-secondary">Created</TableHead>
                      <TableHead className="text-secondary">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations.map((org) => (
                      <TableRow
                        key={org.id || org._id}
                        className="border-b border-subtle hover:bg-surface-2"
                      >
                        <TableCell className="text-primary">{org.name || "N/A"}</TableCell>
                        <TableCell className="text-tertiary">
                          {org.createdAt
                            ? new Date(org.createdAt).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/admin/organizations/${
                              org.id || org._id
                            }/wallet`}
                          >
                            <Button variant="outline" size="sm" className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]">
                              <Wallet className="h-4 w-4 mr-2" />
                              Wallet
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
