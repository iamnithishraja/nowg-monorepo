import { Badge } from "@/components/ui/badge";
import { Building2, FolderKanban, User } from "lucide-react";

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const formatCurrency = (amount: number) => {
  return `$${amount.toFixed(2)}`;
};

export const getWalletTypeBadge = (type: string) => {
  switch (type) {
    case "organization":
      return (
        <Badge variant="secondary" className="gap-1">
          <Building2 className="h-3 w-3" />
          Organization
        </Badge>
      );
    case "project":
      return (
        <Badge variant="outline" className="gap-1">
          <FolderKanban className="h-3 w-3" />
          Project
        </Badge>
      );
    case "user_project":
      return (
        <Badge className="gap-1 bg-blue-500">
          <User className="h-3 w-3" />
          User
        </Badge>
      );
    default:
      return <Badge>{type}</Badge>;
  }
};

