import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Save,
  RefreshCw,
  Percent,
  Server,
  Globe,
  Database,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/roles";

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
      const response = await apiRequest("GET", "/api/admin/markup/getMarkup");
      return await response.json();
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
      const response = await apiRequest(
        "POST",
        "/api/admin/markup/createMarkup",
        payload
      );
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/markup/getMarkup"],
      });
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
        description: error.message || "Failed to update markup",
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
      // For full admin, use the first markup's organizationId or allow them to select
      orgId = data.markups[0].organizationId;
    }

    if (!orgId) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Organization ID is required. Please ensure you have access to an organization.",
      });
      return;
    }

    updateMutation.mutate({
      provider,
      value,
      organizationId: orgId,
    });
  };

  const handleSaveAll = () => {
    const providers: Array<"openrouter" | "deployment" | "managed_database"> = [
      "openrouter",
      "deployment",
      "managed_database",
    ];

    providers.forEach((provider) => {
      const value = markupValues[provider];
      if (value && value.trim() !== "") {
        handleSave(provider);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Markup Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure markup percentages for different service providers
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <Alert>
        <Percent className="h-4 w-4" />
        <AlertDescription>
          Set markup percentages (0-100%) for each service provider. These
          markups will be applied to the base costs.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
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
                <Card key={provider}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {config.label}
                    </CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${provider}-markup`}>
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
                          className="flex-1"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                      {currentMarkup && (
                        <p className="text-xs text-muted-foreground">
                          Current: {currentMarkup.value}% | Last updated:{" "}
                          {new Date(currentMarkup.updatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => handleSave(provider)}
                      disabled={isPending || !markupValues[provider]}
                      className="w-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isPending ? "Saving..." : "Save"}
                    </Button>
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      )}

      {data?.markups && data.markups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Markups</CardTitle>
            <CardDescription>
              Overview of all configured markup percentages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.markups.map((markup) => (
                <div
                  key={markup.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {PROVIDER_CONFIG[markup.provider].label}
                    </div>
                    {!isOrgAdmin && (
                      <div className="text-sm text-muted-foreground">
                        {markup.organizationName}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{markup.value}%</div>
                    <div className="text-xs text-muted-foreground">
                      Updated: {new Date(markup.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
