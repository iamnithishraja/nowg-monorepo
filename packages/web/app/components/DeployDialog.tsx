import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import { Check, Copy, Loader2, ExternalLink, RotateCcw } from "lucide-react";

interface Deployment {
  id: string;
  provider: "vercel" | "netlify";
  projectName: string;
  url: string | null;
  stage: string;
  progress: number;
  status: "deploying" | "complete" | "failed";
  createdAt: Date;
  completedAt?: Date;
  versionId?: string; // Store which version was deployed
  needsUpdate?: boolean; // Whether deployment needs update based on backend check
}

interface UnifiedDeploymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // For active deployment
  isDeploying: false | "vercel" | "netlify";
  deployLog: string;
  deployUrl: string | null;
  deployStage: string;
  deployProgress: number;
  copiedToClipboard: boolean;
  onCopyToClipboard: () => void;
  // For viewing completed deployment
  currentDeployment: Deployment | null;
  onCreateNewDeployment: (
    provider: "vercel" | "netlify",
    updateExisting?: boolean,
    versionId?: string
  ) => void;
  currentVersionId?: string | null;
}

export function UnifiedDeploymentDialog({
  open,
  onOpenChange,
  isDeploying,
  deployLog,
  deployUrl,
  deployStage,
  deployProgress,
  copiedToClipboard,
  onCopyToClipboard,
  currentDeployment,
  onCreateNewDeployment,
  currentVersionId,
}: UnifiedDeploymentDialogProps) {
  const [internalCopiedToClipboard, setInternalCopiedToClipboard] =
    useState(false);

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setInternalCopiedToClipboard(true);
      setTimeout(() => setInternalCopiedToClipboard(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const getPlatformIcon = (provider: "vercel" | "netlify") => {
    if (provider === "vercel") {
      return (
        <svg aria-hidden="true" viewBox="0 0 1155 1000" className="w-4 h-4">
          <path d="M577.5 0L1155 1000H0L577.5 0z" fill="currentColor" />
        </svg>
      );
    } else {
      return (
        <svg aria-hidden="true" viewBox="0 0 100 100" className="w-4 h-4">
          <g fill="none" stroke="currentColor" strokeWidth="8">
            <path d="M50 5 L95 50 L50 95 L5 50 Z" />
            <path d="M20 50 L80 50" />
            <path d="M50 20 L50 80" />
          </g>
        </svg>
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      default:
        return "text-primary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <Check className="w-5 h-5 text-green-500" />;
      case "failed":
        return <Check className="w-5 h-5 text-red-500 rotate-180" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
    }
  };

  // Determine if we're showing active deployment or completed deployment
  // Only show active deployment if we're actually deploying (isDeploying is truthy)
  // Don't use deployUrl/deployLog as they may contain old logs from previous deployments
  const isActiveDeployment = !!isDeploying;
  const deployment = isActiveDeployment ? null : currentDeployment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-[1px] rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent overflow-hidden">
        <div className="bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/30 overflow-hidden">
          <div className="p-6 pb-4 overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                {isActiveDeployment ? (
                  <>
                    {isDeploying && getPlatformIcon(isDeploying)}
                    {isDeploying
                      ? `Deploying to ${isDeploying}...`
                      : deployUrl
                      ? "Deployment Complete"
                      : "Deployment"}
                  </>
                ) : deployment ? (
                  <>
                    {getPlatformIcon(deployment.provider)}
                    {deployment.provider.charAt(0).toUpperCase() +
                      deployment.provider.slice(1)}{" "}
                    Deployment
                  </>
                ) : (
                  "Deployment"
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm my-2">
                {isActiveDeployment
                  ? isDeploying
                    ? "Your application is being deployed. This may take a few minutes."
                    : deployUrl
                    ? "Your application has been successfully deployed!"
                    : "Deployment process"
                  : deployment
                  ? `Project: ${deployment.projectName}`
                  : "View deployment details"}
              </DialogDescription>
            </DialogHeader>

            {/* Active Deployment Content */}
            {isActiveDeployment ? (
              <>
                {/* Progress Section */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    {isDeploying ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : deployUrl ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {deployStage || "Preparing deployment..."}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <Progress
                      value={deployProgress}
                      className="h-2 bg-muted/50"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{deployProgress}%</span>
                      <span>
                        {isDeploying
                          ? "In Progress"
                          : deployUrl
                          ? "Complete"
                          : "Ready"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deployment URL Section */}
                {deployUrl && (
                  <div className="p-[1px] rounded-xl bg-gradient-to-b from-green-500/20 via-green-500/5 to-transparent">
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="text-sm font-medium text-foreground mb-1">
                            Deployment URL
                          </div>
                          <div className="text-xs text-muted-foreground truncate font-mono">
                            {deployUrl}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard
                                .writeText(deployUrl)
                                .then(() => onCopyToClipboard())
                                .catch(() => onCopyToClipboard());
                            }}
                            className="h-8 px-3 text-xs hover:bg-muted/50"
                          >
                            {copiedToClipboard ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            asChild
                            className="h-8 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <a
                              href={deployUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Open
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : deployment ? (
              <>
                {/* Completed Deployment Content */}
                {/* Status Section */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusIcon(deployment.status)}
                    <div>
                      <span
                        className={`text-sm font-medium ${getStatusColor(
                          deployment.status
                        )}`}
                      >
                        {deployment.stage || "Initializing..."}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        Created: {deployment.createdAt.toLocaleString()}
                        {deployment.completedAt && (
                          <span>
                            {" "}
                            • Completed:{" "}
                            {deployment.completedAt.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar - Show for active deployments */}
                  {deployment.status === "deploying" && (
                    <div className="space-y-2">
                      <Progress
                        value={deployment.progress}
                        className="h-2 bg-muted/50"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{deployment.progress}%</span>
                        <span>In Progress</span>
                      </div>
                    </div>
                  )}

                  {/* Additional Deployment Details */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Environment:
                      </span>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        Production
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Branch:</span>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        main
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deployment URL Section */}
                {deployment.url && (
                  <div className="p-[1px] rounded-xl bg-gradient-to-b from-green-500/20 via-green-500/5 to-transparent mb-6">
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="text-sm font-medium text-foreground mb-1">
                            Deployment URL
                          </div>
                          <div className="text-xs text-muted-foreground truncate font-mono">
                            {deployment.url}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const deploymentUrl = deployment.url!;
                              copyToClipboard(deploymentUrl);
                            }}
                            className="h-8 px-3 text-xs hover:bg-muted/50"
                          >
                            {internalCopiedToClipboard ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            asChild
                            className="h-8 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <a
                              href={deployment.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Open
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {deployment && deployment.url && (
                  <div className="flex gap-3">
                    {/* Show update button based on backend needsUpdate flag */}
                    {Boolean(deployment.needsUpdate) ? (
                      <Button
                        onClick={() =>
                          onCreateNewDeployment(
                            deployment.provider,
                            true,
                            currentVersionId || undefined
                          )
                        }
                        className="flex-1"
                        variant="outline"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Update Deployment
                      </Button>
                    ) : (
                      <div className="flex-1 text-center text-sm text-muted-foreground py-2">
                        Deployment is up to date
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* No deployment state */
              <div className="text-center py-8">
                <div className="text-muted-foreground">No deployment found</div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useDeployDialog(
  conversationId?: string,
  onConversationChange?: number,
  currentVersionId?: string | null,
  versionsLength?: number // Watch versions array length to detect new versions
) {
  const [isDeploying, setIsDeploying] = useState<false | "vercel" | "netlify">(
    false
  );
  const [showDialog, setShowDialog] = useState(false);
  const [deployLog, setDeployLog] = useState("");
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [deployStage, setDeployStage] = useState("");
  const [deployProgress, setDeployProgress] = useState(0);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [currentDeployment, setCurrentDeployment] = useState<Deployment | null>(
    null
  );
  const [isLoadingDeployment, setIsLoadingDeployment] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null
  );
  const loadDeploymentRef = useRef<(() => Promise<void>) | null>(null);

  // Load deployment from deployment service - exposed as a function so it can be called manually
  const loadDeployment = useCallback(
    async (showLoading = false) => {
      if (!conversationId) {
        // Clear state if no conversation ID
        setCurrentDeployment(null);
        setDeployLog("");
        setDeployUrl(null);
        setDeployStage("");
        setDeployProgress(0);
        setCopiedToClipboard(false);
        setIsDeploying(false);
        setIsLoadingDeployment(false);
        return;
      }

      if (showLoading) {
        setIsLoadingDeployment(true);
      }

      try {
        // Backend will fetch current version from database and determine needsUpdate
        const url = `/api/deployments?conversationId=${conversationId}`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.deployments && data.deployments.length > 0) {
            // Get the latest deployment (first in sorted array)
            const latestDeployment = data.deployments[0];
            const deploymentUrl = latestDeployment.deploymentUrl;
            let derivedProjectName = "nowgai-app";
            try {
              if (deploymentUrl) {
                const u = new URL(deploymentUrl);
                const host = u.hostname;
                if (host.endsWith(".vercel.app")) {
                  derivedProjectName = host.replace(".vercel.app", "");
                } else if (host.endsWith(".netlify.app")) {
                  derivedProjectName = host.replace(".netlify.app", "");
                } else {
                  derivedProjectName = host.split(".")[0] || derivedProjectName;
                }
              }
            } catch {}
            setCurrentDeployment({
              id: latestDeployment.id,
              provider: latestDeployment.platform,
              projectName: derivedProjectName,
              url: deploymentUrl,
              stage:
                latestDeployment.status === "success"
                  ? "Deployment complete"
                  : latestDeployment.status === "failed"
                  ? "Deployment failed"
                  : "Deployment pending",
              progress:
                latestDeployment.status === "success"
                  ? 100
                  : latestDeployment.status === "failed"
                  ? 0
                  : 50,
              status:
                latestDeployment.status === "success"
                  ? "complete"
                  : latestDeployment.status === "failed"
                  ? "failed"
                  : "deploying",
              createdAt: new Date(latestDeployment.deployedAt),
              completedAt:
                latestDeployment.status === "success"
                  ? new Date(latestDeployment.deployedAt)
                  : undefined,
              versionId: latestDeployment.versionId || undefined, // Store versionId
              needsUpdate: Boolean(latestDeployment.needsUpdate), // Store needsUpdate from backend (ensure boolean)
            });
          } else {
            // No deployments found for this conversation, clear state
            setCurrentDeployment(null);
            setDeployLog("");
            setDeployUrl(null);
            setDeployStage("");
            setDeployProgress(0);
            setCopiedToClipboard(false);
            setIsDeploying(false);
          }
        } else {
          // Error fetching deployments, clear state
          setCurrentDeployment(null);
          setDeployLog("");
          setDeployUrl(null);
          setDeployStage("");
          setDeployProgress(0);
          setCopiedToClipboard(false);
          setIsDeploying(false);
        }
      } catch (error) {
        console.error("Failed to load deployment:", error);
        // Error loading deployment, clear state
        setCurrentDeployment(null);
        setDeployLog("");
        setDeployUrl(null);
        setDeployStage("");
        setDeployProgress(0);
        setCopiedToClipboard(false);
        setIsDeploying(false);
      } finally {
        if (showLoading) {
          setIsLoadingDeployment(false);
        }
      }
    },
    [conversationId]
  );

  // Store loadDeployment in ref so it can be accessed in startDeploy
  useEffect(() => {
    loadDeploymentRef.current = loadDeployment;
  }, [loadDeployment]);

  // Load deployment when conversation changes - only once, no aggressive polling
  useEffect(() => {
    if (!conversationId) return;
    loadDeployment();
  }, [conversationId]); // Only depend on conversationId

  // Refresh when conversation changes (new prompt/version created) - single refresh with delay
  useEffect(() => {
    if (conversationId && onConversationChange !== undefined) {
      // Single refresh after a delay to let backend process the new version
      const timeout = setTimeout(() => {
        if (loadDeploymentRef.current) {
          loadDeploymentRef.current();
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [onConversationChange, conversationId]);

  // Reset deployment state when conversation changes (for active deployments)
  useEffect(() => {
    // Cancel any ongoing deployment stream
    try {
      readerRef.current?.cancel();
      readerRef.current = null;
    } catch (error) {
      console.error("Error canceling deployment stream:", error);
    }

    // Reset active deployment state
    if (isDeploying) {
      setIsDeploying(false);
      setShowDialog(false);
    }
  }, [conversationId]);

  useEffect(() => {
    return () => {
      try {
        readerRef.current?.cancel();
      } catch {
        console.error("Error canceling reader");
      }
    };
  }, []);

  // Keep a global snapshot of deployment files in window set by workspace
  const getWorkspaceFiles = () => {
    const anyWindow = window as any;
    const files = anyWindow.__NOWGAI_WORKSPACE_FILES__ as
      | Array<{ path: string; content: string }>
      | undefined;
    return Array.isArray(files) ? files : [];
  };

  const startDeploy = async (
    provider: "vercel" | "netlify",
    updateExisting = false,
    versionId?: string
  ) => {
    if (isDeploying) return;
    setDeployLog("");
    setDeployUrl(null);
    setDeployStage("");
    setDeployProgress(0);
    setCopiedToClipboard(false);
    setShowDialog(true);
    setIsDeploying(provider);

    try {
      let files: Array<{ path: string; content: string }> = [];

      // If versionId is provided, we don't need to get files from workspace
      // The API will fetch them from the version
      if (!versionId) {
        files = getWorkspaceFiles();
      }

      // For updates, reuse the existing project name, otherwise create a new one
      let uniqueProject: string;
      if (updateExisting && currentDeployment) {
        uniqueProject = currentDeployment.projectName;
      } else {
        const shortId =
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID().split("-")[0]
            : Math.random().toString(36).slice(2, 10);
        uniqueProject = `nowgai-${shortId}-app`;
      }

      /* 
      // Vercel deployment logic commented out as per user request
      const endpoint =
        provider === "vercel" ? "/api/deploy/vercel" : "/api/deploy/netlify";
      */
      const endpoint = provider === "netlify" ? "/api/deploy/netlify" : "";
      
      if (provider === "vercel") {
        setIsDeploying(false);
        setShowDialog(false);
        window.open("https://vercel.com/new", "_blank");
        return;
      }

      setDeployStage("Initializing deployment...");
      setDeployProgress(10);

      // Create or update deployment object
      const deployment: Deployment = {
        id:
          updateExisting && currentDeployment
            ? currentDeployment.id
            : `deploy-${Date.now()}`,
        provider,
        projectName: uniqueProject,
        url: null,
        stage: "Initializing deployment...",
        progress: 10,
        status: "deploying",
        createdAt:
          updateExisting && currentDeployment
            ? currentDeployment.createdAt
            : new Date(),
      };

      setCurrentDeployment(deployment);

      if (!conversationId) {
        console.error("No conversation ID provided for deployment");
        return;
      }

      const requestBody: any = {
        files,
        projectName: uniqueProject,
        siteName: uniqueProject,
        conversationId, // Include conversation ID for database storage
      };

      // Include versionId if provided
      if (versionId) {
        requestBody.versionId = versionId;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.body) {
        setDeployLog((l) => l + "\nError: No response stream from server");
        setDeployStage("Deployment failed");
        setIsDeploying(false);
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            // Update stage and progress based on deployment status
            if (data.type === "status") {
              let newStage = "";
              let newProgress = 0;
              if (data.stage === "creating") {
                newStage = "Creating deployment...";
                newProgress = 25;
              } else if (data.stage === "uploading") {
                newStage = "Uploading files...";
                newProgress = 50;
              } else if (data.stage === "building") {
                newStage = "Building application...";
                newProgress = 75;
              }

              if (newStage) {
                setDeployStage(newStage);
                setDeployProgress(newProgress);
                setCurrentDeployment((prev) =>
                  prev
                    ? { ...prev, stage: newStage, progress: newProgress }
                    : null
                );
              }
            }

            if (data.type === "created") {
              setDeployStage("Deployment created...");
              setDeployProgress(40);
              setCurrentDeployment((prev) =>
                prev
                  ? { ...prev, stage: "Deployment created...", progress: 40 }
                  : null
              );
            }

            if (data.type === "progress") {
              if (data.readyState === "READY" || data.state === "ready") {
                setDeployStage("Deployment ready!");
                setDeployProgress(100);
                setCurrentDeployment((prev) =>
                  prev
                    ? { ...prev, stage: "Deployment ready!", progress: 100 }
                    : null
                );
              }
            }

            if (data.type === "complete") {
              setDeployStage("Deployment complete!");
              setDeployProgress(100);
              // Reload deployment from server to get the latest state including versionId
              // Wait a bit for the server to update the database, then refresh multiple times
              setTimeout(() => {
                if (loadDeploymentRef.current) {
                  loadDeploymentRef.current();
                }
              }, 1000);
              // Also refresh after a longer delay to ensure we get the final state
              setTimeout(() => {
                if (loadDeploymentRef.current) {
                  loadDeploymentRef.current();
                }
              }, 3000);
            }

            if (data.message) setDeployLog((l) => l + `\n${data.message}`);
            if (data.readyState)
              setDeployLog((l) => l + `\nState: ${data.readyState}`);
            if (data.state) setDeployLog((l) => l + `\nState: ${data.state}`);
            if (data.inspectUrl)
              setDeployLog((l) => l + `\nInspect: ${data.inspectUrl}`);
            if (data.url) {
              setDeployUrl(data.url);
              setCurrentDeployment((prev) =>
                prev ? { ...prev, url: data.url } : null
              );
            }
            if (data.type === "error") {
              setDeployLog((l) => l + `\nError: ${data.message}`);
              setDeployStage("Deployment failed");
              setCurrentDeployment((prev) =>
                prev
                  ? { ...prev, stage: "Deployment failed", status: "failed" }
                  : null
              );
            }
            if (data.type === "complete" && data.url)
              setDeployLog((l) => l + `\nDeployed: ${data.url}`);
          } catch {
            console.error("Error parsing data");
          }
        }
      }
    } catch (e: any) {
      setDeployLog((l) => l + `\nError: ${e?.message || String(e)}`);
      setDeployStage("Deployment failed");
      setCurrentDeployment((prev) =>
        prev ? { ...prev, stage: "Deployment failed", status: "failed" } : null
      );
    } finally {
      setIsDeploying(false);
      try {
        readerRef.current?.cancel();
      } catch {
        console.error("Error canceling reader");
      }
      // Always refresh deployment state after deployment completes (success or failure)
      // This ensures we get the latest deployment data including versionId
      // Multiple refreshes to ensure we catch the update
      setTimeout(() => {
        if (loadDeploymentRef.current) {
          loadDeploymentRef.current();
        }
      }, 2000);
      setTimeout(() => {
        if (loadDeploymentRef.current) {
          loadDeploymentRef.current();
        }
      }, 4000);
    }
  };

  const copyToClipboard = async () => {
    if (deployUrl) {
      try {
        await navigator.clipboard.writeText(deployUrl);
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 2000);
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
      }
    }
  };

  const deployVersion = async (
    versionId: string,
    provider: "vercel" | "netlify"
  ) => {
    await startDeploy(provider, false, versionId);
  };

  return {
    isDeploying,
    showDialog,
    setShowDialog,
    deployLog,
    deployUrl,
    deployStage,
    deployProgress,
    copiedToClipboard,
    currentDeployment,
    startDeploy,
    deployVersion,
    copyToClipboard,
    refreshDeployment: loadDeployment, // Expose refresh function
    isLoadingDeployment, // Expose loading state
  };
}
