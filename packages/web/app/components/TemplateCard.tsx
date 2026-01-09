import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import templateScreenshot from "../assets/template-screenshot.png";

interface TemplateCardProps {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  onClick: () => void;
}

export default function TemplateCard({
  title,
  subtitle,
  description,
  category,
  onClick,
}: TemplateCardProps) {
  return (
    <Card
      className="bg-background p-0 border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 cursor-pointer group transform hover:scale-[1.02]"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="rounded-t-lg overflow-auto">
          <img
            src={templateScreenshot}
            alt={title}
            className="w-full h-full object-fill"
          />
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-foreground mb-1">{description}</h3>
          <p className="text-sm text-muted-foreground mb-2">{subtitle}</p>
          <Badge
            variant="outline"
            className="text-primary border-primary/30 bg-primary/10"
          >
            {category}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
