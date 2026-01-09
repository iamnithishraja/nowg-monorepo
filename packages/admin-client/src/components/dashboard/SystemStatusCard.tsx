import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { TrendingUp } from "lucide-react";

export function SystemStatusCard() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <CardTitle className="text-lg">System Status</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">API Status</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-green-500">Online</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Database</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-green-500">
                Connected
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Storage</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-green-500">Active</span>
            </div>
          </div>
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
              data-testid="button-view-details"
            >
              <Link href="/admin/users">View All Users</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
