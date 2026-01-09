import React from 'react';
import { 
  Atom,
  Code,
  Braces,
  FileCode,
  Palette,
} from 'lucide-react';

interface TechStackIconsProps {
  icons: string[];
  className?: string;
}

export default function TechStackIcons({ icons, className = "" }: TechStackIconsProps) {
  const getIconElement = (icon: string) => {
    const iconClass = "w-5 h-5 text-muted-foreground/80";
    
    switch (icon.toLowerCase()) {
      case 'react':
        return <Atom className={iconClass} />;
      case 'typescript':
        return <FileCode className={iconClass} />;
      case 'tailwind':
        return <Palette className={iconClass} />;
      case 'javascript':
        return <Braces className={iconClass} />;
      default:
        return <Code className={iconClass} />;
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {icons.map((icon, index) => (
        <div key={index} className="flex-shrink-0">
          {getIconElement(icon)}
        </div>
      ))}
    </div>
  );
}