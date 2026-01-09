import { cn } from "../lib/utils";

interface HeroSectionProps {
  title: string;
  subtitle: string;
  className?: string;
}

export default function HeroSection({
  title,
  subtitle,
  className,
}: HeroSectionProps) {
  return (
    <div className={cn("text-center space-y-3 sm:space-y-4 md:space-y-6", className)}>
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent px-4">
        {title}
      </h1>
      <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed px-4">
        {subtitle}
      </p>
    </div>
  );
}
