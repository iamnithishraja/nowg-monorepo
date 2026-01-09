import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  bgColor?: string;
  iconColor?: string;
}

export function AnalyticsCard({
  title,
  value,
  icon: Icon,
  description,
  bgColor = "bg-primary/10",
  iconColor = "text-primary",
}: AnalyticsCardProps) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${bgColor}`}
        >
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-1">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
