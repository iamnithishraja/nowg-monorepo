import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Activity, LucideIcon } from "lucide-react";

interface QuickAction {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

interface QuickActionsCardProps {
  actions: QuickAction[];
  title?: string;
}

export function QuickActionsCard({
  actions,
  title = "Quick Actions",
}: QuickActionsCardProps) {
  return (
    <Card className="lg:col-span-2 shadow-sm">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href}>
                <div
                  className="group p-4 border rounded-lg hover-elevate cursor-pointer transition-all"
                  data-testid={`card-${action.title
                    .toLowerCase()
                    .replace(/ /g, "-")}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm mb-1">
                        {action.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
