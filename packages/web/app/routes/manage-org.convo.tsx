import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  Globe,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useNavigate } from "react-router";
import { Header } from "../components";
import Background from "../components/Background";
import { PlanSwitcher } from "../components/PlanSwitcher";
import { ProjectSidebar } from "../components/ProjectSidebar";
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
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { auth } from "../lib/auth";

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

type AppView =
  | "loading"
  | "plans"
  | "enterprise-form"
  | "enterprise-pending"
  | "enterprise-rejected"
  | "enterprise-approved"
  | "projects";

export default function ManageOrgConvo({ loaderData }: { loaderData?: { user?: any } }) {
  const user = loaderData?.user;
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");

  // View state machine
  const [view, setView] = useState<AppView>("loading");

  // Plan selection
  const [selectedPlan, setSelectedPlan] = useState<"core" | "enterprise">("core");

  // Enterprise request state
  const [pendingEnterpriseRequest, setPendingEnterpriseRequest] = useState<{
    id: string;
    name: string;
    description: string;
    planType: string;
    approvalStatus: string;
    approvalNotes?: string | null;
    createdAt: string;
  } | null>(null);

  // Enterprise form fields
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [companySize, setCompanySize] = useState<string>("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [useCase, setUseCase] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    setLoading(true);
    await Promise.all([fetchConversations(), determineView()]);
    setLoading(false);
  };

  /**
   * Determine which view to show:
   * - If user has active org membership → "projects"
   * - If user has pending enterprise request → "enterprise-pending"
   * - If user has rejected enterprise request → "enterprise-rejected"
   * - If user has approved enterprise org (but no active membership yet, edge case) → "enterprise-approved"
   * - Otherwise → "plans" (no create-org UI ever shown)
   */
  const determineView = async () => {
    try {
      const res = await fetch("/api/user-organizations", {
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          navigate("/signin");
          return;
        }
        // Default to plans if we can't determine
        setView("plans");
        return;
      }

      const data = await res.json();

      // Active org memberships → show projects tab
      if (data.organizations && Array.isArray(data.organizations) && data.organizations.length > 0) {
        setView("projects");
        return;
      }

      // Check project admin memberships
      try {
        const projectRes = await fetch("/api/user-project-memberships", {
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          credentials: "include",
        });
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          if (projectData.hasProjectAdminRole === true) {
            setView("projects");
            return;
          }
        }
      } catch (_) {}

      // Enterprise request pending/rejected
      if (data.enterpriseRequest) {
        setPendingEnterpriseRequest({
          id: data.enterpriseRequest.id,
          name: data.enterpriseRequest.name,
          description: data.enterpriseRequest.description || "",
          planType: data.enterpriseRequest.planType,
          approvalStatus: data.enterpriseRequest.approvalStatus,
          approvalNotes: data.enterpriseRequest.approvalNotes || null,
          createdAt: data.enterpriseRequest.createdAt,
        });

        if (data.enterpriseRequest.approvalStatus === "approved") {
          setView("enterprise-approved");
        } else if (data.enterpriseRequest.approvalStatus === "rejected") {
          setView("enterprise-rejected");
        } else {
          setView("enterprise-pending");
        }
        return;
      }

      // No memberships, no requests → show plans
      setView("plans");
    } catch (err) {
      console.error("Error determining view:", err);
      setView("plans");
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/organization-conversations", {
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          navigate("/signin");
          return;
        }
        return;
      }

      if (data.conversations && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      }
      if (data.organizations && Array.isArray(data.organizations)) {
        setOrganizations(data.organizations);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  };

  const handlePlanContinue = () => {
    if (selectedPlan === "core") {
      // Core plan: redirect to home, no org creation
      navigate("/");
      return;
    }
    // Enterprise plan: show request form
    setView("enterprise-form");
  };

  const handleSubmitEnterpriseRequest = async () => {
    if (!orgName.trim()) {
      setError("Organization name is required");
      return;
    }
    if (!companySize) {
      setError("Company size is required");
      return;
    }
    if (!useCase.trim()) {
      setError("Use case description is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: orgName,
          description: orgDescription,
          allowedDomains,
          planType: "enterprise",
          companySize,
          industry,
          website,
          useCase,
          contactPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to submit request");
      }

      setPendingEnterpriseRequest({
        id: data.organization.id,
        name: data.organization.name,
        description: data.organization.description || "",
        planType: "enterprise",
        approvalStatus: "pending",
        approvalNotes: null,
        createdAt: data.organization.createdAt,
      });

      setView("enterprise-pending");
    } catch (err: any) {
      console.error("Error submitting enterprise request:", err);
      setError(err.message || "Failed to submit request");
    } finally {
      setIsSubmitting(false);
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

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      conv.title.toLowerCase().includes(searchLower) ||
      conv.project?.name?.toLowerCase().includes(searchLower) ||
      conv.organization?.name?.toLowerCase().includes(searchLower);
    const matchesOrg = selectedOrgId === "all" || conv.organization?.id === selectedOrgId;
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

  // ─── Shared page shell ────────────────────────────────────────────────────
  const PageShell = ({ children }: { children: React.ReactNode }) => (
    <div className="h-screen w-screen bg-canvas text-primary flex overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Background />
        <div className="pointer-events-none absolute inset-0 z-5 overflow-hidden">
          <div
            className="absolute left-0 top-1/4 h-[40rem] w-[80rem] rotate-[12deg] rounded-full blur-3xl"
            style={{
              background: "radial-gradient(50% 60% at 50% 50%, rgba(123, 76, 255, 0.08) 0%, rgba(123, 76, 255, 0.06) 45%, rgba(123, 76, 255, 0.04) 100%)",
              mixBlendMode: "screen",
            }}
          />
          <div
            className="absolute right-0 top-1/2 h-[36rem] w-[70rem] -rotate-[8deg] rounded-full blur-[70px]"
            style={{
              background: "radial-gradient(55% 65% at 50% 50%, rgba(140, 99, 242, 0.06) 0%, rgba(140, 99, 242, 0.04) 50%, rgba(140, 99, 242, 0.02) 100%)",
              mixBlendMode: "screen",
            }}
          />
        </div>
      </div>
      <ProjectSidebar user={user} className="flex-shrink-0" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header showSidebarToggle={false} showAuthButtons={false} />
        <main className="relative z-20 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col items-center pt-8 sm:pt-12 pb-8">
            <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 md:px-8">
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-2 rounded-[6px] bg-[#7b4cff]/10">
                    <Building2 className="h-6 w-6 text-[#7b4cff]" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-primary">Manage Organization</h1>
                    <p className="text-secondary text-sm mt-0.5">View projects and manage your organization</p>
                  </div>
                </div>
              </div>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (view === "loading" || loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#7b4cff]" />
        </div>
      </PageShell>
    );
  }

  // ─── Plans page ───────────────────────────────────────────────────────────
  if (view === "plans") {
    return (
      <PageShell>
        <div className="space-y-6">
          <PlanSwitcher
            selectedPlan={selectedPlan}
            onPlanSelect={(plan) => setSelectedPlan(plan)}
          />
          <div className="flex justify-center">
            <Button
              onClick={handlePlanContinue}
              className="bg-gradient-to-r from-[#7b4cff] to-[#a855f7] hover:from-[#8c63f2] hover:to-[#b566f8] text-white font-medium shadow-lg shadow-[#7b4cff]/25 transition-all duration-200 px-8 py-3"
            >
              Continue with {selectedPlan === "core" ? "Core" : "Enterprise"} Plan
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ─── Enterprise request form ──────────────────────────────────────────────
  if (view === "enterprise-form") {
    return (
      <PageShell>
        <div className="rounded-[12px] bg-surface-1 border border-[#7b4cff]/30 w-full">
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-5 w-5 text-[#7b4cff]" />
                <CardTitle className="text-primary">Request Enterprise Organization</CardTitle>
              </div>
              <CardDescription className="text-secondary">
                Tell us about your organization. Our team will review your request and get back to you within 1–2 business days.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">
              {/* Organization Details */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-[#7b4cff] uppercase tracking-wider">Organization Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name" className="text-primary">Organization Name *</Label>
                    <Input
                      id="name"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Your company or organization name"
                      className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="description" className="text-primary">Description</Label>
                    <Textarea
                      id="description"
                      value={orgDescription}
                      onChange={(e) => setOrgDescription(e.target.value)}
                      placeholder="Brief description of your organization"
                      rows={2}
                      className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-medium text-[#7b4cff] uppercase tracking-wider">Company Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-primary flex items-center gap-2">
                      <Users className="h-4 w-4 text-tertiary" />
                      Company Size *
                    </Label>
                    <Select value={companySize} onValueChange={setCompanySize}>
                      <SelectTrigger className="mt-2 bg-surface-2 border-subtle text-primary">
                        <SelectValue placeholder="Select company size" />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-1 border-subtle">
                        <SelectItem value="1-10">1–10 employees</SelectItem>
                        <SelectItem value="11-50">11–50 employees</SelectItem>
                        <SelectItem value="51-200">51–200 employees</SelectItem>
                        <SelectItem value="201-500">201–500 employees</SelectItem>
                        <SelectItem value="500+">500+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="industry" className="text-primary flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-tertiary" />
                      Industry
                    </Label>
                    <Input
                      id="industry"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="e.g., Technology, Healthcare"
                      className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="website" className="text-primary flex items-center gap-2">
                      <Globe className="h-4 w-4 text-tertiary" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourcompany.com"
                      className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone" className="text-primary flex items-center gap-2">
                      <Phone className="h-4 w-4 text-tertiary" />
                      Contact Phone
                    </Label>
                    <Input
                      id="contactPhone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Use Case */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-medium text-[#7b4cff] uppercase tracking-wider">Use Case</h4>
                <div>
                  <Label htmlFor="useCase" className="text-primary">How do you plan to use Nowgai? *</Label>
                  <Textarea
                    id="useCase"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    placeholder="Describe your use case, expected usage, and what you hope to achieve with our Enterprise plan..."
                    rows={4}
                    className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20 resize-none"
                  />
                </div>
              </div>

              {/* Allowed Domains */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-medium text-[#7b4cff] uppercase tracking-wider">Access Control</h4>
                <div>
                  <Label className="text-primary">Allowed Domains</Label>
                  <p className="text-sm text-secondary mt-1 mb-2">
                    Only users with email addresses from these domains can be invited. Leave empty to allow all domains.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDomain(); } }}
                      placeholder="e.g., yourcompany.com"
                      className="bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                    />
                    <Button type="button" onClick={addDomain} variant="outline" className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#7b4cff]">
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
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setError(null); setView("plans"); }}
                  className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#7b4cff]"
                >
                  Back to Plans
                </Button>
                <Button
                  onClick={handleSubmitEnterpriseRequest}
                  disabled={isSubmitting || !orgName.trim() || !companySize || !useCase.trim()}
                  className="flex-1 bg-gradient-to-r from-[#7b4cff] to-[#a855f7] hover:from-[#8c63f2] hover:to-[#b566f8] text-white font-medium shadow-lg shadow-[#7b4cff]/25 transition-all duration-200 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting Request...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Enterprise Request
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // ─── Enterprise pending ───────────────────────────────────────────────────
  if (view === "enterprise-pending") {
    return (
      <PageShell>
        <div className="rounded-[12px] bg-surface-1 border border-amber-500/30 w-full">
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="px-5 py-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-4 rounded-full bg-amber-500/10">
                  <Clock className="h-12 w-12 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-xl text-amber-500 mb-2">Request Under Review</CardTitle>
                  <CardDescription className="text-secondary max-w-md">
                    Thank you for your interest in our Enterprise plan! Your organization request is currently being reviewed by our team.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-6 space-y-6">
              {pendingEnterpriseRequest && (
                <div className="rounded-lg bg-surface-2 border border-subtle p-4 space-y-3">
                  <h4 className="font-medium text-primary flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#7b4cff]" />
                    Request Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-tertiary">Organization Name:</span>
                      <p className="text-primary font-medium">{pendingEnterpriseRequest.name}</p>
                    </div>
                    <div>
                      <span className="text-tertiary">Submitted:</span>
                      <p className="text-primary">{formatDate(pendingEnterpriseRequest.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-tertiary">Status:</span>
                      <div className="mt-1">
                        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending Review</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="rounded-lg bg-[#7b4cff]/5 border border-[#7b4cff]/20 p-4 space-y-3">
                <h4 className="font-medium text-primary flex items-center gap-2">
                  <Info className="h-4 w-4 text-[#7b4cff]" />
                  What happens next?
                </h4>
                <ul className="space-y-2 text-sm text-secondary">
                  <li className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-[#7b4cff] mt-0.5 shrink-0" />
                    <span>You'll receive an email confirmation about your request.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-[#7b4cff] mt-0.5 shrink-0" />
                    <span>Our team will review your request within 1–2 business days.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#7b4cff] mt-0.5 shrink-0" />
                    <span>Once approved, you'll get full access to Enterprise features.</span>
                  </li>
                </ul>
              </div>
              <div className="text-center text-sm text-secondary">
                Have questions? Contact us at{" "}
                <a href="mailto:support@nowgai.com" className="text-[#7b4cff] hover:underline">
                  support@nowgai.com
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // ─── Enterprise rejected ──────────────────────────────────────────────────
  if (view === "enterprise-rejected") {
    return (
      <PageShell>
        <div className="rounded-[12px] bg-surface-1 border border-red-500/30 w-full">
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="px-5 py-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-4 rounded-full bg-red-500/10">
                  <XCircle className="h-12 w-12 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-xl text-red-500 mb-2">Request Not Approved</CardTitle>
                  <CardDescription className="text-secondary max-w-md">
                    Unfortunately, your Enterprise organization request was not approved at this time.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-6 space-y-4">
              {pendingEnterpriseRequest?.approvalNotes && (
                <div className="rounded-lg bg-surface-2 border border-red-500/20 p-4">
                  <p className="text-sm font-medium text-red-400 mb-1">Reason:</p>
                  <p className="text-sm text-secondary">{pendingEnterpriseRequest.approvalNotes}</p>
                </div>
              )}
              <div className="text-center text-sm text-secondary">
                If you believe this was a mistake or would like more information, please contact us at{" "}
                <a href="mailto:support@nowgai.com" className="text-[#7b4cff] hover:underline">
                  support@nowgai.com
                </a>
              </div>
              <div className="flex justify-center">
                <Button
                  onClick={() => {
                    setPendingEnterpriseRequest(null);
                    setSelectedPlan("core");
                    setView("plans");
                  }}
                  className="bg-gradient-to-r from-[#7b4cff] to-[#a855f7] hover:from-[#8c63f2] hover:to-[#b566f8] text-white font-medium shadow-lg shadow-[#7b4cff]/25 transition-all duration-200"
                >
                  Back to Plans
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // ─── Enterprise approved ──────────────────────────────────────────────────
  if (view === "enterprise-approved") {
    return (
      <PageShell>
        <div className="rounded-[12px] bg-surface-1 border border-[#7b4cff]/30 w-full">
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="px-5 py-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-4 rounded-full bg-[#7b4cff]/10">
                  <CheckCircle2 className="h-12 w-12 text-[#7b4cff]" />
                </div>
                <div>
                  <CardTitle className="text-xl text-[#7b4cff] mb-2">Your organization has been approved.</CardTitle>
                  <CardDescription className="text-secondary max-w-md">
                    Your Enterprise organization is ready. You can now manage your organization from the Admin Panel.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-6 space-y-4">
              {pendingEnterpriseRequest && (
                <div className="rounded-lg bg-surface-2 border border-subtle p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-tertiary">Organization Name:</span>
                      <p className="text-primary font-medium">{pendingEnterpriseRequest.name}</p>
                    </div>
                    <div>
                      <span className="text-tertiary">Status:</span>
                      <div className="mt-1">
                        <Badge className="bg-[#7b4cff]/20 text-[#a78bfa] border-[#7b4cff]/30">Approved</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-center pt-2">
                <Button
                  onClick={() => navigate("/admin")}
                  className="bg-gradient-to-r from-[#7b4cff] to-[#a855f7] hover:from-[#8c63f2] hover:to-[#b566f8] text-white font-medium shadow-lg shadow-[#7b4cff]/25 transition-all duration-200 px-8 py-3"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Manage your organization from the Admin Panel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // ─── Projects view (user has active membership) ───────────────────────────
  return (
    <PageShell>
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="mb-6 bg-surface-1 border border-subtle gap-1">
          <TabsTrigger
            value="projects"
            className="data-[state=active]:bg-[#7b4cff]/20 data-[state=active]:text-[#7b4cff] data-[state=active]:border-[#7b4cff]/30 text-secondary hover:text-primary"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Projects
          </TabsTrigger>
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
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#7b4cff]" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="rounded-[12px] bg-surface-1 border border-subtle w-full">
              <Card className="bg-transparent border-0 shadow-none">
                <CardContent className="py-12">
                  <div className="text-center text-tertiary">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50 text-[#7b4cff]" />
                    <p className="text-lg font-medium mb-2 text-primary">No projects found</p>
                    <p className="text-secondary">
                      {searchQuery || selectedOrgId !== "all"
                        ? "Try adjusting your filters"
                        : "No projects have been created for your organization yet"}
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
                  onClick={() => navigate(`/workspace?conversationId=${conv.id}`)}
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
      </Tabs>
    </PageShell>
  );
}