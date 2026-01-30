import {
  Building2,
  Calendar,
  FolderKanban,
  Loader2,
  MessageSquare,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { redirect, useNavigate } from "react-router";
import { Header } from "../components";
import { ProjectSidebar } from "../components/ProjectSidebar";
import Background from "../components/Background";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { auth } from "../lib/auth";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/signin");
  }

  return { user: session.user };
}

interface Conversation {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
  } | null;
  organization: {
    id: string;
    name: string;
  } | null;
}

export default function OrganizationConversations({ loaderData }: { loaderData?: { user?: any } }) {
  const user = loaderData?.user;
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/organization-conversations", {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
      });

      const data = await res.json();

      if (!res.ok) {
        // If unauthorized, redirect to signin
        if (res.status === 401) {
          navigate("/signin");
          return;
        }
        throw new Error(
          data.error || data.message || `HTTP ${res.status}: ${res.statusText}`
        );
      }

      if (data.conversations && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      } else {
        setConversations([]);
      }

      if (data.organizations && Array.isArray(data.organizations)) {
        setOrganizations(data.organizations);
      } else {
        setOrganizations([]);
      }
    } catch (err: any) {
      console.error("Error fetching conversations:", err);
      setError(err.message || "Failed to fetch conversations");
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      conv.title.toLowerCase().includes(searchLower) ||
      conv.project?.name?.toLowerCase().includes(searchLower) ||
      conv.organization?.name?.toLowerCase().includes(searchLower);

    const matchesOrg =
      selectedOrgId === "all" || conv.organization?.id === selectedOrgId;

    return matchesSearch && matchesOrg;
  });


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getModelBadge = (model: string) => {
    const modelName = model.split("/").pop() || model;
    return (
      <Badge variant="outline" className="text-xs">
        {modelName}
      </Badge>
    );
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Background />
      </div>

      {/* Left Sidebar - ProjectSidebar */}
      <ProjectSidebar user={user} className="shrink-0" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header showSidebarToggle={false} showAuthButtons={false} />

        <main className="relative z-20 flex flex-col h-full overflow-auto">
          <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8 pb-16 max-w-7xl mx-auto w-full">
                <div className="mb-8">
                  <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                    <MessageSquare className="h-8 w-8" />
                    Organization Conversations
                  </h1>
                  <p className="text-muted-foreground">
                    View conversations created for your organization projects
                  </p>
                </div>

                {/* Filters */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {organizations.length > 0 && (
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      className="px-4 py-2 rounded-md border bg-background"
                    >
                      <option value="all">All Organizations</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center text-destructive">
                        <p className="text-lg font-medium mb-2">Error</p>
                        <p>{error}</p>
                        <Button
                          onClick={fetchConversations}
                          variant="outline"
                          className="mt-4"
                        >
                          Retry
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : filteredConversations.length === 0 ? (
                  <Card className="relative z-10">
                    <CardContent className="py-12">
                      <div className="text-center text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">
                          No conversations found
                        </p>
                        <p>
                          {searchQuery || selectedOrgId !== "all"
                            ? "Try adjusting your filters"
                            : conversations.length === 0
                            ? "No conversations have been created for your organization projects yet"
                            : "No conversations match your filters"}
                        </p>
                        {conversations.length > 0 && (
                          <p className="text-sm mt-2">
                            Showing {filteredConversations.length} of{" "}
                            {conversations.length} conversations
                          </p>
                        )}
                        <div className="mt-4 text-xs text-muted-foreground">
                          <p>Debug info:</p>
                          <p>Total conversations: {conversations.length}</p>
                          <p>
                            Filtered conversations:{" "}
                            {filteredConversations.length}
                          </p>
                          <p>Search query: "{searchQuery}"</p>
                          <p>Selected org: {selectedOrgId}</p>
                          {conversations.length > 0 && (
                            <div className="mt-2 text-left">
                              <p>First conversation:</p>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                {JSON.stringify(conversations[0], null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 relative z-10">
                    {filteredConversations.map((conv) => (
                      <Card
                        key={conv.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors relative z-10"
                        onClick={() =>
                          navigate(`/workspace?conversationId=${conv.id}`)
                        }
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-5 w-5" />
                                {conv.title}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-4 flex-wrap">
                                {conv.project && (
                                  <span className="flex items-center gap-1">
                                    <FolderKanban className="h-4 w-4" />
                                    {conv.project.name}
                                  </span>
                                )}
                                {conv.organization && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-4 w-4" />
                                    {conv.organization.name}
                                  </span>
                                )}
                              </CardDescription>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getModelBadge(conv.model)}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(conv.createdAt)}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
          </div>
        </main>
      </div>
    </div>
  );
}
