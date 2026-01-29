import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  MessageSquare,
  FolderKanban,
  Building2,
  Calendar,
  Loader2,
  Search,
  Plus,
  XCircle,
  CheckCircle2,
  Wallet,
  Info,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { auth } from "../lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { SidebarProvider } from "../components/ui/sidebar";
import { ProjectSidebar } from "../components/ProjectSidebar";
import { Header } from "../components";
import Background from "../components/Background";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { useNavigate } from "react-router";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";

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

export default function ManageOrgConvo({ loaderData }: { loaderData?: { user?: any } }) {
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
  const [hasAnyMembership, setHasAnyMembership] = useState(false);

  // Create org form state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdOrg, setCreatedOrg] = useState<{
    id: string;
    name: string;
    description: string;
    status: string;
    allowedDomains: string[];
    createdAt: string;
    walletBalance: number;
  } | null>(null);

  // Wallet and payment state
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [addCreditsAmount, setAddCreditsAmount] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    fetchConversations();
    fetchUserOrganizations();
    checkUserMemberships();
  }, []);

  // Fetch wallet balance when organization is available
  useEffect(() => {
    if (createdOrg?.id) {
      fetchWalletBalance(createdOrg.id);
    }
  }, [createdOrg?.id]);

  // Check for payment success in URL and refresh wallet balance
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get("payment_success");
    const paymentType = urlParams.get("type");
    const organizationId = urlParams.get("organizationId");

    if (
      paymentSuccess === "true" &&
      paymentType === "organization" &&
      organizationId &&
      createdOrg?.id === organizationId
    ) {
      // Payment was already verified by payment-success page, just refresh wallet balance
      fetchWalletBalance(createdOrg.id);
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [createdOrg?.id]);

  const fetchUserOrganizations = async () => {
    try {
      const res = await fetch("/api/user-organizations", {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          navigate("/signin");
          return;
        }
        return;
      }

      const data = await res.json();

      if (data.organizations && Array.isArray(data.organizations)) {
        // Check if user has any organization membership (org_admin or org_user)
        if (data.organizations.length > 0) {
          setHasAnyMembership(true);
        }

        // Find the most recently created organization where user is org_admin
        const orgAdminOrgs = data.organizations.filter(
          (org: any) => org.role === "org_admin"
        );

        if (orgAdminOrgs.length > 0) {
          // Get the most recently created one
          const mostRecentOrg = orgAdminOrgs.sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

          // Set as created org to show the details
          setCreatedOrg({
            id: mostRecentOrg.id,
            name: mostRecentOrg.name,
            description: mostRecentOrg.description || "",
            status: mostRecentOrg.status,
            allowedDomains: mostRecentOrg.allowedDomains || [],
            createdAt: mostRecentOrg.createdAt,
            walletBalance: mostRecentOrg.walletBalance || 0,
          });

          // Also store in localStorage as backup
          localStorage.setItem(
            "lastCreatedOrg",
            JSON.stringify({
              id: mostRecentOrg.id,
              name: mostRecentOrg.name,
              description: mostRecentOrg.description || "",
              status: mostRecentOrg.status,
              allowedDomains: mostRecentOrg.allowedDomains || [],
              createdAt: mostRecentOrg.createdAt,
              walletBalance: mostRecentOrg.walletBalance || 0,
            })
          );
        }
      }
    } catch (err: any) {
      console.error("Error fetching user organizations:", err);
      // Try to load from localStorage as fallback
      try {
        const stored = localStorage.getItem("lastCreatedOrg");
        if (stored) {
          const parsed = JSON.parse(stored);
          setCreatedOrg(parsed);
          setHasAnyMembership(true);
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  };

  const checkUserMemberships = async () => {
    try {
      // Check for project memberships (project_admin)
      const projectRes = await fetch("/api/user-project-memberships", {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (projectRes.ok) {
        const projectData = await projectRes.json();
        if (projectData.hasProjectAdminRole === true) {
          setHasAnyMembership(true);
        }
      }
    } catch (err: any) {
      console.error("Error checking user project memberships:", err);
    }
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/organization-conversations", {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
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

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      setError("Organization name is required");
      return;
    }

    setIsCreating(true);
    setError(null);
    setCreatedOrg(null); // Clear previous success message

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: orgName,
          description: orgDescription,
          allowedDomains,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || data.message || "Failed to create organization"
        );
      }

      // Store created organization details
      const newOrg = {
        id: data.organization.id,
        name: data.organization.name,
        description: data.organization.description || "",
        status: data.organization.status,
        allowedDomains: data.organization.allowedDomains || [],
        createdAt: data.organization.createdAt,
        walletBalance: data.wallet?.balance || 0,
      };

      setCreatedOrg(newOrg);

      // Store in localStorage as backup
      localStorage.setItem("lastCreatedOrg", JSON.stringify(newOrg));

      // Reset form
      setOrgName("");
      setOrgDescription("");
      setAllowedDomains([]);
      setDomainInput("");

      // Refresh conversations to show new org
      await fetchConversations();
    } catch (err: any) {
      console.error("Error creating organization:", err);
      setError(err.message || "Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  };

  const addDomain = () => {
    if (domainInput.trim() && !allowedDomains.includes(domainInput.trim())) {
      setAllowedDomains([...allowedDomains, domainInput.trim()]);
      setDomainInput("");
    }
  };

  const removeDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter((d) => d !== domain));
  };

  const fetchWalletBalance = async (organizationId: string) => {
    try {
      setIsLoadingWallet(true);
      const res = await fetch(
        `/api/organizations/wallet?organizationId=${organizationId}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.wallet) {
          setWalletBalance(data.wallet.balance);
          // Update createdOrg wallet balance
          if (createdOrg) {
            setCreatedOrg({
              ...createdOrg,
              walletBalance: data.wallet.balance,
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching wallet balance:", err);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  const handleAddCredits = async () => {
    if (!createdOrg?.id) return;

    const amount = parseFloat(addCreditsAmount);
    if (!amount || amount <= 0) {
      setError("Please enter a valid amount greater than $0");
      return;
    }

    setIsProcessingPayment(true);
    setError(null);

    try {
      // Get user's country code from browser location
      const { getCountryCodeForPayment, handlePaymentResponse } = await import(
        "~/utils/payment"
      );
      const countryCode = await getCountryCodeForPayment();

      const res = await fetch("/api/organizations/wallet/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          organizationId: createdOrg.id,
          amount: amount,
          countryCode, // Include country code
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Handle different payment providers
      await handlePaymentResponse(data, amount, () => {
        setIsProcessingPayment(false); // Stop loading for Razorpay
      });
    } catch (err: any) {
      console.error("Error initiating payment:", err);
      setError(err.message || "Failed to initiate payment");
      setIsProcessingPayment(false);
    }
  };

  const verifyPayment = async (sessionId: string) => {
    try {
      const res = await fetch("/api/organizations/wallet/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (res.ok && createdOrg?.id) {
        // Refresh wallet balance
        await fetchWalletBalance(createdOrg.id);
        setError(null);
      } else {
        console.error("Payment verification failed:", data);
        setError(data.error || "Payment verification failed");
      }
    } catch (err: any) {
      console.error("Error verifying payment:", err);
      setError(err.message || "Failed to verify payment");
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
      <Badge variant="outline" className="text-xs bg-[#7b4cff]/10 text-[#a78bfa] border-[#7b4cff]/30">
        {modelName}
      </Badge>
    );
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-screen w-screen bg-canvas text-primary flex overflow-hidden">
        {/* Background layers - absolutely positioned */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Background />
          {/* Purple glow effects */}
          <div className="pointer-events-none absolute inset-0 z-5 overflow-hidden">
            <div
              className="absolute left-0 top-1/4 h-[40rem] w-[80rem] rotate-[12deg] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(50% 60% at 50% 50%, rgba(123, 76, 255, 0.08) 0%, rgba(123, 76, 255, 0.06) 45%, rgba(123, 76, 255, 0.04) 100%)",
                mixBlendMode: "screen",
                willChange: "transform",
              }}
            />
            <div
              className="absolute right-0 top-1/2 h-[36rem] w-[70rem] -rotate-[8deg] rounded-full blur-[70px]"
              style={{
                background:
                  "radial-gradient(55% 65% at 50% 50%, rgba(140, 99, 242, 0.06) 0%, rgba(140, 99, 242, 0.04) 50%, rgba(140, 99, 242, 0.02) 100%)",
                mixBlendMode: "screen",
                willChange: "transform",
              }}
            />
            <div
              className="absolute left-1/4 top-0 h-[32rem] w-[60rem] rotate-[22deg] rounded-full blur-[60px]"
              style={{
                background:
                  "radial-gradient(60% 70% at 50% 50%, rgba(167, 139, 250, 0.05) 0%, rgba(167, 139, 250, 0.03) 50%, rgba(167, 139, 250, 0.01) 100%)",
                mixBlendMode: "screen",
                willChange: "transform",
              }}
            />
          </div>
        </div>

        {/* Left Sidebar */}
        <ProjectSidebar user={user} className="flex-shrink-0" />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header showSidebarToggle={true} showAuthButtons={false} />

          <main className="relative z-20 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col items-center pt-8 sm:pt-12 pb-8">
              <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 md:px-8">
                <div className="mb-8">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="p-2 rounded-[6px] bg-[#7b4cff]/10">
                      <Building2 className="h-6 w-6 text-[#7b4cff]" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-semibold text-primary">
                        Manage Organization
                      </h1>
                      <p className="text-secondary text-sm mt-0.5">
                        View projects and manage your organization
                      </p>
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="projects" className="w-full">
                  <TabsList className="mb-6 bg-surface-1 border border-subtle gap-1">
                    <TabsTrigger 
                      value="projects"
                      className="data-[state=active]:bg-[#7b4cff]/20 data-[state=active]:text-[#7b4cff] data-[state=active]:border-[#7b4cff]/30 text-secondary hover:text-primary"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Projects
                    </TabsTrigger>
                    {!hasAnyMembership && (
                      <TabsTrigger 
                        value="create-org"
                        className="data-[state=active]:bg-[#7b4cff]/20 data-[state=active]:text-[#7b4cff] data-[state=active]:border-[#7b4cff]/30 text-secondary hover:text-primary"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Organization
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="projects" className="mt-0 space-y-6">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
                        <Input
                          placeholder="Search projects..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 w-full bg-surface-1 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                        />
                      </div>
                      {organizations.length > 0 && (
                        <select
                          value={selectedOrgId}
                          onChange={(e) => setSelectedOrgId(e.target.value)}
                          className="px-4 py-2 rounded-lg border border-subtle bg-surface-1 text-primary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
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
                        <Loader2 className="h-8 w-8 animate-spin text-[#7b4cff]" />
                      </div>
                    ) : error ? (
                      <div className="rounded-[12px] bg-surface-1 border border-subtle w-full">
                        <Card className="bg-transparent border-0 shadow-none">
                          <CardContent className="py-12">
                            <div className="text-center text-error-400">
                              <p className="text-lg font-medium mb-2">Error</p>
                              <p className="text-secondary">{error}</p>
                              <Button
                                onClick={fetchConversations}
                                variant="outline"
                                className="mt-4 bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#7b4cff]"
                              >
                                Retry
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : filteredConversations.length === 0 ? (
                      <div className="rounded-[12px] bg-surface-1 border border-subtle w-full">
                        <Card className="bg-transparent border-0 shadow-none">
                          <CardContent className="py-12">
                            <div className="text-center text-tertiary">
                              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50 text-[#7b4cff]" />
                              <p className="text-lg font-medium mb-2 text-primary">
                                No projects found
                              </p>
                              <p className="text-secondary">
                                {searchQuery || selectedOrgId !== "all"
                                  ? "Try adjusting your filters"
                                  : conversations.length === 0
                                  ? "No projects have been created for your organization yet"
                                  : "No projects match your filters"}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="grid gap-4 relative z-10 w-full">
                        {filteredConversations.map((conv) => (
                          <div
                            key={conv.id}
                            className="rounded-[12px] bg-surface-1 border border-subtle cursor-pointer hover:border-[#7b4cff]/50 hover:bg-surface-2 transition-colors relative z-10 w-full"
                            onClick={() =>
                              navigate(`/workspace?conversationId=${conv.id}`)
                            }
                          >
                            <Card className="bg-transparent border-0 shadow-none">
                              <CardHeader className="px-5 py-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <CardTitle className="flex items-center gap-2 mb-2 text-primary">
                                      <MessageSquare className="h-5 w-5 text-[#7b4cff]" />
                                      {conv.title}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-4 flex-wrap text-secondary">
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
                                    <span className="text-xs text-tertiary flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(conv.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </CardHeader>
                            </Card>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {!hasAnyMembership && (
                    <TabsContent value="create-org" className="mt-0">
                    {/* Show organization details if user already has one */}
                    {createdOrg ? (
                      <div className="rounded-[12px] bg-surface-1 border border-[#7b4cff]/30 w-full">
                        <Card className="bg-transparent border-0 shadow-none">
                          <CardHeader className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-[#7b4cff]" />
                              <CardTitle className="text-[#7b4cff]">
                                Your Organization
                              </CardTitle>
                            </div>
                            <CardDescription className="text-secondary">
                              You are the admin of this organization. Only one
                              organization can be created per account.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="px-5 pb-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-secondary text-sm">
                                  Organization Name
                                </Label>
                                <p className="text-lg font-semibold mt-1 text-primary">
                                  {createdOrg.name}
                                </p>
                              </div>
                              <div>
                                <Label className="text-secondary text-sm">
                                  Status
                                </Label>
                                <div className="mt-1">
                                  <Badge
                                    className={
                                      createdOrg.status === "active"
                                        ? "bg-[#7b4cff]/20 text-[#a78bfa] border-[#7b4cff]/30"
                                        : "bg-surface-2 text-secondary border-subtle"
                                    }
                                  >
                                    {createdOrg.status}
                                  </Badge>
                                </div>
                              </div>
                              {createdOrg.description && (
                                <div className="md:col-span-2">
                                  <Label className="text-secondary text-sm">
                                    Description
                                  </Label>
                                  <p className="mt-1 text-primary">{createdOrg.description}</p>
                                </div>
                              )}
                              <div>
                                <Label className="text-secondary text-sm">
                                  Created At
                                </Label>
                                <p className="mt-1 text-primary">
                                  {formatDate(createdOrg.createdAt)}
                                </p>
                              </div>
                              <div>
                                <Label className="text-secondary text-sm">
                                  Organization ID
                                </Label>
                                <p className="mt-1 font-mono text-sm text-tertiary">
                                  {createdOrg.id}
                                </p>
                              </div>
                            </div>

                            {/* Wallet Info */}
                            <div className="rounded-lg bg-surface-2 border border-subtle">
                              <Card className="bg-transparent border-0 shadow-none">
                                <CardHeader className="pb-3 px-4 pt-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Wallet className="h-4 w-4 text-[#7b4cff]" />
                                      <CardTitle className="text-base text-primary">
                                        Organization Wallet
                                      </CardTitle>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 space-y-4">
                                  <div className="flex items-baseline gap-2">
                                    {isLoadingWallet ? (
                                      <Loader2 className="h-6 w-6 animate-spin text-[#7b4cff]" />
                                    ) : (
                                      <>
                                        <span className="text-2xl font-bold text-primary">
                                          ${walletBalance.toFixed(2)}
                                        </span>
                                        <span className="text-sm text-secondary">
                                          ({walletBalance} credits)
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <p className="text-sm text-secondary">
                                    Wallet balance is available for organization
                                    projects and usage.
                                  </p>

                                  {/* Add Credits Section */}
                                  <div className="pt-4 border-t border-subtle">
                                    <Label className="text-sm font-medium mb-2 block text-primary">
                                      Add Credits via Stripe
                                    </Label>
                                    <div className="flex gap-2">
                                      <div className="relative flex-1">
                                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0.01"
                                          placeholder="0.00"
                                          value={addCreditsAmount}
                                          onChange={(e) =>
                                            setAddCreditsAmount(e.target.value)
                                          }
                                          className="pl-9 bg-surface-1 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                                          disabled={isProcessingPayment}
                                        />
                                      </div>
                                      <Button
                                        onClick={handleAddCredits}
                                        disabled={
                                          isProcessingPayment ||
                                          !addCreditsAmount ||
                                          parseFloat(addCreditsAmount) <= 0
                                        }
                                        className="shrink-0 bg-gradient-to-r from-[#7b4cff] to-[#a855f7] hover:from-[#8c63f2] hover:to-[#b566f8] text-white font-medium shadow-lg shadow-[#7b4cff]/25 transition-all duration-200 disabled:opacity-50"
                                      >
                                        {isProcessingPayment ? (
                                          <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Processing...
                                          </>
                                        ) : (
                                          <>
                                            <CreditCard className="h-4 w-4 mr-2" />
                                            Add Credits
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                    <p className="text-xs text-tertiary mt-2">
                                      You will be redirected to Stripe to complete
                                      the payment. Credits are added 1:1 (1 USD = 1
                                      credit).
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Allowed Domains */}
                            {createdOrg.allowedDomains.length > 0 && (
                              <div>
                                <Label className="text-secondary text-sm">
                                  Allowed Domains
                                </Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {createdOrg.allowedDomains.map(
                                    (domain, idx) => (
                                      <Badge key={idx} variant="outline" className="bg-[#7b4cff]/10 text-[#a78bfa] border-[#7b4cff]/30">
                                        {domain}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Info about more details */}
                            <div className="flex items-start gap-2 p-3 bg-[#7b4cff]/10 border border-[#7b4cff]/20 rounded-lg">
                              <Info className="h-4 w-4 text-[#7b4cff] mt-0.5 shrink-0" />
                              <p className="text-sm text-secondary">
                                For more details and advanced management options,
                                please log in to{" "}
                                <a
                                  href="http://ec2-43-205-236-120.ap-south-1.compute.amazonaws.com/"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-[#7b4cff] font-medium text-[#a78bfa]"
                                >
                                  Nowgai Admin
                                </a>
                                .
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      /* Show create form only if user doesn't have an organization */
                      <div className="rounded-[12px] bg-surface-1 border border-subtle w-full">
                        <Card className="bg-transparent border-0 shadow-none">
                          <CardHeader className="px-5 py-4">
                            <CardTitle className="text-primary">Create New Organization</CardTitle>
                            <CardDescription className="text-secondary">
                              Create a new organization. You will be automatically
                              added as the organization admin.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="px-5 pb-5 space-y-4">
                            <div>
                              <Label htmlFor="name" className="text-primary">Name *</Label>
                              <Input
                                id="name"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Organization name"
                                className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                              />
                            </div>
                            <div>
                              <Label htmlFor="description" className="text-primary">Description</Label>
                              <Textarea
                                id="description"
                                value={orgDescription}
                                onChange={(e) =>
                                  setOrgDescription(e.target.value)
                                }
                                placeholder="Organization description"
                                rows={3}
                                className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20 resize-none"
                              />
                            </div>
                            <div>
                              <Label className="text-primary">Allowed Domains</Label>
                              <p className="text-sm text-secondary mt-1 mb-2">
                                Only users with email addresses from these domains
                                can be invited as org admin or team members. Leave
                                empty to allow all domains.
                              </p>
                              <div className="flex gap-2">
                                <Input
                                  value={domainInput}
                                  onChange={(e) => setDomainInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addDomain();
                                    }
                                  }}
                                  placeholder="e.g., abc.com"
                                  className="bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                                />
                                <Button 
                                  type="button" 
                                  onClick={addDomain}
                                  className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#7b4cff]"
                                >
                                  Add
                                </Button>
                              </div>
                              {allowedDomains.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {allowedDomains.map((domain, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="gap-1 cursor-pointer bg-[#7b4cff]/10 text-[#a78bfa] border-[#7b4cff]/30 hover:bg-[#7b4cff]/20"
                                      onClick={() => removeDomain(domain)}
                                    >
                                      {domain}
                                      <XCircle className="h-3 w-3" />
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            {error && (
                              <div className="text-sm text-error-400">
                                {error}
                              </div>
                            )}
                            <Button
                              onClick={handleCreateOrganization}
                              disabled={isCreating || !orgName.trim()}
                              className="w-full bg-gradient-to-r from-[#7b4cff] to-[#a855f7] hover:from-[#8c63f2] hover:to-[#b566f8] text-white font-medium shadow-lg shadow-[#7b4cff]/25 transition-all duration-200 disabled:opacity-50"
                            >
                              {isCreating ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Create Organization
                                </>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
