import { useRoute } from "wouter";
import { UserAnalyticsView } from "@/components/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function UserAnalyticsPage() {
  const [, params] = useRoute<{ userId: string }>(
    "/admin/analytics/user/:userId"
  );
  const [, setLocation] = useLocation();

  if (!params?.userId) {
    return (
      <div className="flex-1 p-8 bg-background">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              User ID not provided
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
            onClick={() => setLocation("/admin/users")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </div>
        <UserAnalyticsView userId={params.userId} />
      </div>
    </div>
  );
}
