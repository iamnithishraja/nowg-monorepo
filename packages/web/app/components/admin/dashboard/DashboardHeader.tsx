
interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
}

export function DashboardHeader({
  title = "Dashboard",
  subtitle,
}: DashboardHeaderProps) {
  return (
    <div className="mb-6">
      <h1
        className="text-[24px] font-medium text-primary tracking-[-0.48px] leading-[1.2]"
        data-testid="text-page-title"
      >
        {title}
      </h1>
      {subtitle && (
        <p className="text-[14px] text-secondary mt-2 tracking-[-0.28px] leading-[1.5]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

