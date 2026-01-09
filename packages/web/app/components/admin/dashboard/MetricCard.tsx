import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: PhosphorIcon;
  description: string;
  href: string;
  bgColor: string;
  iconColor: string;
  testId?: string;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  href,
  bgColor,
  iconColor,
  testId,
}: MetricCardProps) {
  return (
    <Link to={href}>
      <Card
        className="bg-surface-1 border border-subtle rounded-[12px] hover:border-[#555558] transition-all duration-300 h-full cursor-pointer"
        data-testid={`card-${title.toLowerCase().replace(/ /g, "-")}`}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3 px-4 pt-4">
          <div className="space-y-1">
            <CardTitle className="text-[12px] font-medium text-secondary tracking-[-0.24px] leading-[1.2]">
              {title}
            </CardTitle>
          </div>
          <div className={`p-2 rounded-[6px] bg-surface-2 transition-colors duration-300`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="text-[24px] font-medium text-primary mb-1 tracking-[-0.48px] leading-[1.2]" data-testid={testId}>
            {value}
          </div>
          <p className="text-[12px] text-tertiary tracking-[-0.24px] leading-[1.2]">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

