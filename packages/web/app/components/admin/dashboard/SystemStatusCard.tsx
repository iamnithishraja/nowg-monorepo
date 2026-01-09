import { TrendUp } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export function SystemStatusCard() {
  return (
    <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
      <CardHeader className="border-b border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendUp className="h-5 w-5 text-[#7b4cff]" weight="fill" />
          <CardTitle className="text-[14px] text-primary font-medium tracking-[-0.28px]">System Status</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-secondary tracking-[-0.26px]">API Status</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-[13px] font-medium text-[#22c55e] tracking-[-0.26px]">Online</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-secondary tracking-[-0.26px]">Database</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-[13px] font-medium text-[#22c55e] tracking-[-0.26px]">
                Connected
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-secondary tracking-[-0.26px]">Storage</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-[13px] font-medium text-[#22c55e] tracking-[-0.26px]">Active</span>
            </div>
          </div>
          <div className="pt-3 border-t border-subtle">
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-surface-2 border-subtle text-primary hover:bg-subtle hover:text-primary hover:border-[#555558]"
              asChild
              data-testid="button-view-details"
            >
              <Link to="/admin/users">View All Users</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

