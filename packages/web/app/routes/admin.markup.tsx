import { UserRole } from "@nowgai/shared/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    Database,
    Globe,
    Percent,
    RefreshCw,
    Save,
    Server,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { AdminLayout } from "~/components/AdminLayout";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useToast } from "~/hooks/use-toast";
import { useAuth } from "~/hooks/useAuth";
import { adminClient } from "~/lib/adminClient";
import { getAdminSession } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";

export async function loader({ request }: LoaderFunctionArgs) {
  await connectToDatabase();

  const { user } = await getAdminSession(request);

  if (!user) {
    throw redirect("/");
  }

  // Restrict access - this page is no longer accessible
  // Markup settings are now managed by super_admin in organizations page
  throw new Response(
    JSON.stringify({
      error: "Forbidden",
      message:
        "Markup Settings have been moved. Please contact your administrator.",
    }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );

  return { user };
}

type Markup = {
  id: string;
  organizationId: string;
  organizationName: string;
  provider: "openrouter" | "deployment" | "managed_database";
  value: number;
  createdAt: string;
  updatedAt: string;
};

type MarkupsResponse = {
  success: boolean;
  markups: Markup[];
};

const PROVIDER_CONFIG = {
  openrouter: {
    label: "OpenRouter",
    icon: Globe,
    description: "Markup percentage for OpenRouter API usage",
  },
  deployment: {
    label: "Deployment",
    icon: Server,
    description: "Markup percentage for deployment services",
  },
  managed_database: {
    label: "Managed Database",
    icon: Database,
    description: "Markup percentage for managed database services",
  },
};

export default function MarkupSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isOrgAdmin = (user as any)?.role === UserRole.ORG_ADMIN;
  const organizationId = (user as any)?.organizationId;

  const [markupValues, setMarkupValues] = useState<{
    openrouter: string;
    deployment: string;
    managed_database: string;
  }>({
    openrouter: "",
    deployment: "",
    managed_database: "",
  });

  const { data, isLoading, refetch } = useQuery<MarkupsResponse>({
    queryKey: ["/api/admin/markup/getMarkup"],
    queryFn: async () => {
      return adminClient.get<MarkupsResponse>("/api/admin/markup/getMarkup");
    },
  });

  // Initialize markup values from API data
  useEffect(() => {
    if (data?.markups) {
      const values: any = {
        openrouter: "",
        deployment: "",
        managed_database: "",
      };
      data.markups.forEach((markup) => {
        values[markup.provider] = markup.value.toString();
      });
      setMarkupValues(values);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      provider: string;
      value: number;
      organizationId: string;
    }) => {
      return adminClient.post<{
        success: boolean;
        message: string;
        markup: Markup;
      }>("/api/admin/markup/createMarkup", payload);
    },
    onSuccess: (_, variables) => {
      refetch();
      toast({
        title: "Markup Updated",
        description: `Markup for ${
          PROVIDER_CONFIG[variables.provider as keyof typeof PROVIDER_CONFIG]
            .label
        } has been updated successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          (error as any).data?.message ||
          error.message ||
          "Failed to update markup",
      });
    },
  });

  const handleSave = (
    provider: "openrouter" | "deployment" | "managed_database"
  ) => {
    const value = parseFloat(markupValues[provider]);

    if (isNaN(value) || value < 0 || value > 100) {
      toast({
        variant: "destructive",
        title: "Invalid Value",
        description: "Markup percentage must be between 0 and 100",
      });
      return;
    }

    // Get organizationId
    let orgId: string | undefined;
    if (isOrgAdmin && organizationId) {
      orgId = organizationId;
    } else if (data?.markups && data.markups.length > 0) {
      orgId = data.markups[0].organizationId;
    }

    if (!orgId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization ID is required",
      });
      return;
    }

    updateMutation.mutate({
      provider,
      value,
      organizationId: orgId,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6 bg-canvas">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-[6px] accent-primary/10">
              <Percent className="h-8 w-8 text-[#7b4cff]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Markup Settings</h1>
              <p className="text-sm text-secondary">
                Configure markup percentages for different service providers
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="border-subtle bg-transparent text-primary hover:bg-surface-2 hover:border-[#555558]"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <Alert className="bg-surface-1 border-subtle text-primary">
          <Percent className="h-4 w-4 text-[#7b4cff]" />
          <AlertDescription className="text-secondary">
            Set markup percentages (0-100%) for each service provider. These
            markups will be applied to the base costs.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="text-center py-8 text-tertiary">
            Loading markup settings...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
            {(["openrouter", "deployment", "managed_database"] as const).map(
              (provider) => {
                const config = PROVIDER_CONFIG[provider];
                const Icon = config.icon;
                const currentMarkup = data?.markups?.find(
                  (m) => m.provider === provider
                );
                const isPending = updateMutation.isPending;

                return (
                  <div key={provider} className="rounded-[12px] bg-surface-1 border border-subtle">
                    <Card className="bg-transparent border-0 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-primary">
                          <Icon className="h-5 w-5 text-[#7b4cff]" />
                          {config.label}
                        </CardTitle>
                        <CardDescription className="text-secondary">{config.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`${provider}-markup`} className="text-primary">
                            Markup Percentage (%)
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`${provider}-markup`}
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={markupValues[provider]}
                              onChange={(e) =>
                                setMarkupValues({
                                  ...markupValues,
                                  [provider]: e.target.value,
                                })
                              }
                              placeholder={currentMarkup?.value.toString() || "0"}
                              className="flex-1 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
                            />
                            <span className="text-tertiary">%</span>
                          </div>
                          {currentMarkup && (
                            <p className="text-xs text-tertiary">
                              Current: {currentMarkup.value}% | Last updated:{" "}
                              {new Date(currentMarkup.updatedAt).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <Button
                          onClick={() => handleSave(provider)}
                          disabled={isPending || !markupValues[provider]}
                          className="w-full accent-primary hover:bg-[#8c63f2] text-white"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {isPending ? "Saving..." : "Save"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                );
              }
            )}
          </div>
        )}

        {data?.markups && data.markups.length > 0 && (
          <div className="rounded-[12px] bg-surface-1 border border-subtle">
            <Card className="bg-transparent border-0 shadow-none">
              <CardHeader>
                <CardTitle className="text-primary">Current Markups</CardTitle>
                <CardDescription className="text-secondary">
                  Overview of all configured markup percentages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.markups.map((markup) => (
                    <div
                      key={markup.id}
                      className="flex items-center justify-between p-3 border border-subtle rounded-lg bg-surface-2"
                    >
                      <div>
                        <div className="font-medium text-primary">
                          {PROVIDER_CONFIG[markup.provider].label}
                        </div>
                        {!isOrgAdmin && (
                          <div className="text-sm text-tertiary">
                            {markup.organizationName}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-[#7b4cff]">{markup.value}%</div>
                        <div className="text-xs text-tertiary">
                          Updated:{" "}
                          {new Date(markup.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
