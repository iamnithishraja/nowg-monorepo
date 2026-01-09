import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Lightning } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface QuickAction {
  title: string;
  description: string;
  icon: PhosphorIcon;
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
    <div className="lg:col-span-2">
      <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
        <CardHeader className="border-b border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <Lightning className="h-5 w-5 text-[#7b4cff]" weight="fill" />
            <CardTitle className="text-[14px] text-primary font-medium tracking-[-0.28px]">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} to={action.href}>
                <div
                  className="group p-3 border border-subtle rounded-[6px] hover:bg-surface-2 hover:border-[#555558] cursor-pointer transition-all"
                  data-testid={`card-${action.title
                    .toLowerCase()
                    .replace(/ /g, "-")}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-surface-2 group-hover:bg-subtle transition-colors flex-shrink-0">
                      <Icon className="h-4 w-4 text-[#7b4cff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[14px] mb-0 text-primary leading-tight tracking-[-0.28px]">
                        {action.title}
                      </h3>
                      <p className="text-[12px] text-tertiary leading-tight mt-0.5 tracking-[-0.24px]">
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
    </div>
  );
}

