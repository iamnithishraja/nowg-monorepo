import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Deployment {
  id: string;
  conversationId: string;
  conversationTitle: string;
  platform: string;
  deploymentUrl: string;
  deploymentId: string;
  status: "pending" | "success" | "failed";
  deployedAt: string;
  conversationUpdatedAt?: string; // NEW: When conversation was last updated
  metadata?: {
    buildLogs?: string;
    environment?: string;
    branch?: string;
    commitHash?: string;
  };
}

interface DeploymentStatusProps {
  conversationId?: string;
  className?: string;
}

export default function DeploymentStatus({
  conversationId,
  className,
}: DeploymentStatusProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDeployments();
  }, [conversationId]);

  // Auto-refresh effect for pending deployments
  useEffect(() => {
    const hasPendingDeployments = deployments.some(
      (d) => d.status === "pending"
    );
    if (!hasPendingDeployments) return;

    const interval = setInterval(async () => {
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
        console.error("Error auto-refreshing deployments:", err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [conversationId, deployments]);

  if (loading || error || !conversationId || deployments.length === 0) {
    return null;
  }

  const latestDeployment = deployments[0];

  // NEW: Check if deployment is out of sync by comparing dates
  const isOutOfSync =
    latestDeployment.status === "success" &&
    latestDeployment.conversationUpdatedAt &&
    new Date(latestDeployment.conversationUpdatedAt) >
      new Date(latestDeployment.deployedAt);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isOutOfSync ? (
        <div className="flex items-center gap-2 text-amber-600 text-sm">
          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
          <span className="text-xs text-muted-foreground">
            Code changed since last deployment
          </span>
        </div>
      ) : latestDeployment.status === "success" ? (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-xs text-muted-foreground">Deployed</span>
        </div>
      ) : latestDeployment.status === "failed" ? (
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="w-4 h-4" />
          <span className="text-xs text-muted-foreground">Failed</span>
        </div>
      ) : latestDeployment.status === "pending" ? (
        <div className="flex items-center gap-2 text-yellow-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs text-muted-foreground">Deploying</span>
        </div>
      ) : null}
    </div>
  );
}
