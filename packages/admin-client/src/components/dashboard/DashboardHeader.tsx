interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
}

export function DashboardHeader({
  title = "Dashboard",
  subtitle,
}: DashboardHeaderProps) {
  return (
    <div className="mb-8">
      <h1
        className="text-3xl font-semibold text-foreground mb-2"
        data-testid="text-page-title"
      >
        {title}
      </h1>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
