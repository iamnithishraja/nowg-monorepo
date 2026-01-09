import { Badge } from "~/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "@phosphor-icons/react";

export const getInvitationStatusBadge = (status: string | null) => {
  if (!status) return null;
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" weight="fill" />
          Pending
        </Badge>
      );
    case "accepted":
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" weight="fill" />
          Accepted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" weight="fill" />
          Rejected
        </Badge>
      );
    default:
      return null;
  }
};

