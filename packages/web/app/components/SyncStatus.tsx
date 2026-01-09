import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Loader2, AlertCircle, CheckCircle, Info } from "lucide-react";

interface Deployment {
  id: string;
  conversationId: string;
  conversationTitle: string;
  platform: string;
  deploymentUrl: string;
  deploymentId: string;
  status: "pending" | "success" | "failed";
  deployedAt: string;
  conversationUpdatedAt?: string;
  metadata?: {
    buildLogs?: string;
    environment?: string;
    branch?: string;
    commitHash?: string;
  };
}

interface SyncStatusProps {
  conversationId?: string;
  className?: string;
  onConversationChange?: number; // Timestamp or counter that changes when conversation updates
  onViewDeployment?: () => void; // Callback to trigger View Deployment action
}

export default function SyncStatus({
  conversationId,
  className,
  onConversationChange,
  onViewDeployment,
}: SyncStatusProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) return;

    async function fetchDeployments() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/deployments?conversationId=${conversationId}`,
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch deployments");
        }

        setDeployments(data.deployments);
      } catch (err: any) {
        console.error("Error fetching deployments:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDeployments();
  }, [conversationId]);

  // Fetch deployments when conversation changes or when there's a pending deployment
  useEffect(() => {
    if (!conversationId) return;

    const fetchDeployments = async () => {
      try {
        const res = await fetch(
          `/api/deployments?conversationId=${conversationId}`,
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setDeployments(data.deployments);
          }
        }
      } catch (err) {
        console.error("Error refreshing deployments:", err);
      }
    };

    // Only set up polling if there's a pending deployment
    const hasPendingDeployments = deployments.some(
      (d) => d.status === "pending"
    );

    if (hasPendingDeployments) {
      const interval = setInterval(fetchDeployments, 5000); // Check every 5s for pending deployments
      return () => clearInterval(interval);
    }
  }, [conversationId, deployments, onConversationChange]); // Re-run when conversation changes

  // Don't show if no conversation or loading
  if (!conversationId || loading) {
    return null;
  }

  // If no deployments exist, don't show sync status
  if (deployments.length === 0) {
    return null;
  }

  const latestDeployment = deployments[0];

  // Check if deployment is out of sync using date comparison
  const isOutOfSync =
    latestDeployment.status === "success" &&
    latestDeployment.conversationUpdatedAt &&
    new Date(latestDeployment.conversationUpdatedAt) >
      new Date(latestDeployment.deployedAt);

  const getSyncStatus = () => {
    if (latestDeployment.status === "pending") {
      return {
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
        text: "Deploying...",
        variant: "secondary" as const,
        className:
          "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
      };
    }

    if (latestDeployment.status === "failed") {
      return {
        icon: <AlertCircle className="w-3 h-3" />,
        text: "Failed",
        variant: "destructive" as const,
        className:
          "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
      };
    }

    if (isOutOfSync) {
      return {
        icon: <AlertCircle className="w-3 h-3" />,
        text: "Needs update",
        variant: "secondary" as const,
        className:
          "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20",
      };
    }

    return {
      icon: <CheckCircle className="w-3.5 h-3.5" />,
      text: "Up to date",
      variant: "secondary" as const,
      className:
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15 shadow-sm",
    };
  };

  const status = getSyncStatus();

  const getTooltipText = () => {
    if (latestDeployment.status === "pending") {
      return "Deployment is in progress...";
    }

    if (latestDeployment.status === "failed") {
      return `Last deployment failed on ${new Date(
        latestDeployment.deployedAt
      ).toLocaleDateString()}`;
    }

    if (isOutOfSync) {
      return "Conversation has been updated since last deployment. Deploy again to bring it up to date.";
    }

    return `Deployment is up to date with conversation changes. Last deployed to ${
      latestDeployment.platform
    } on ${new Date(latestDeployment.deployedAt).toLocaleDateString()}`;
  };

  // If needs update and has callback, make it clickable
  const badgeContent = (
    <Badge
      variant={status.variant}
      className={`${status.className} gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-xl transition-all duration-200 ${
        isOutOfSync && onViewDeployment
          ? "cursor-pointer hover:bg-amber-500/15 hover:border-amber-500/30"
          : "cursor-help"
      } ${className}`}
      onClick={isOutOfSync && onViewDeployment ? onViewDeployment : undefined}
      role={isOutOfSync && onViewDeployment ? "button" : undefined}
      tabIndex={isOutOfSync && onViewDeployment ? 0 : undefined}
      onKeyDown={
        isOutOfSync && onViewDeployment
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onViewDeployment();
              }
            }
          : undefined
      }
    >
      {status.icon}
      {status.text}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="bg-background/90 backdrop-blur-sm border-border/60 text-foreground text-xs max-w-64"
        >
          <div className="flex items-start gap-2">
            <Info className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p>{getTooltipText()}</p>
              {isOutOfSync && onViewDeployment && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDeployment();
                  }}
                  className="text-primary mt-1 font-medium underline hover:text-primary/80 text-left"
                >
                  Click to view deployment details
                </button>
              )}
              {latestDeployment.status === "success" && (
                <p className="text-muted-foreground">
                  Platform: {latestDeployment.platform}
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
