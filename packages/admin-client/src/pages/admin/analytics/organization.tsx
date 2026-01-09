import { useRoute } from "wouter";
import { OrganizationAnalyticsView } from "@/components/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function OrganizationAnalyticsPage() {
  const [, params] = useRoute<{ organizationId: string }>(
    "/admin/analytics/organization/:organizationId"
  );
  const [, setLocation] = useLocation();

  if (!params?.organizationId) {
    return (
      <div className="flex-1 p-8 bg-background">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Organization ID not provided
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/admin/organizations")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Organizations
          </Button>
        </div>
        <OrganizationAnalyticsView organizationId={params.organizationId} />
      </div>
    </div>
  );
}
