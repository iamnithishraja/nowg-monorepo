import { Check, Database, ExternalLink, Loader2, X, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export type DbProvider = "supabase" | "neon";

interface DatabaseConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Supabase state (requires user OAuth)
  hasSupabaseConnected: boolean;
  isCheckingSupabaseToken: boolean;
  supabaseEmail?: string;
  onConnectSupabase: () => void;
  onDisconnectSupabase: () => Promise<void>;
  // Provider selection
  selectedProvider: DbProvider | null;
  onSelectProvider: (provider: DbProvider) => void;
  // Loading state for Neon provisioning
  isProvisioningNeon?: boolean;
  // Neon availability - always available for all conversations
  isNeonAvailable?: boolean;
}

export function DatabaseConnectionDialog({
  open,
  onOpenChange,
  hasSupabaseConnected,
  isCheckingSupabaseToken,
  supabaseEmail,
  onConnectSupabase,
  onDisconnectSupabase,
  selectedProvider,
  onSelectProvider,
  isProvisioningNeon = false,
  isNeonAvailable = true, // Default to true for backward compatibility
}: DatabaseConnectionDialogProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<DbProvider>(
    selectedProvider || "neon"
  );

  const handleDisconnectSupabase = async () => {
    setIsDisconnecting(true);
    try {
      await onDisconnectSupabase();
    } catch (error) {
      console.error("Failed to disconnect Supabase:", error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isCheckingSupabaseToken) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Checking Connection
            </DialogTitle>
            <DialogDescription>
              Verifying your database connections...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Database className="w-5 h-5 text-primary" />
            </div>
            Database Provider
          </DialogTitle>
          <DialogDescription>
            Choose your database provider for this project.
          </DialogDescription>
        </DialogHeader>

        {/* Provider Tabs */}
        <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
          <button
            onClick={() => setActiveTab("neon")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === "neon"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="w-4 h-4" />
            Neon (Managed)
            {selectedProvider === "neon" && (
              <span className="ml-1 w-2 h-2 rounded-full bg-green-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("supabase")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === "supabase"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z" />
            </svg>
            Supabase
            {selectedProvider === "supabase" && (
              <span className="ml-1 w-2 h-2 rounded-full bg-green-500" />
            )}
          </button>
        </div>

        {/* Neon Tab Content - Managed Option */}
        {activeTab === "neon" && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Zap className="w-4 h-4" />
                Managed PostgreSQL
              </div>
              <p className="text-xs text-muted-foreground">
                We'll automatically create and manage a Neon PostgreSQL database
                for your project. No setup required!
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Zero configuration</p>
                    <p className="text-xs text-muted-foreground">
                      Database is created and managed automatically
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Serverless PostgreSQL</p>
                    <p className="text-xs text-muted-foreground">
                      Powered by Neon's serverless architecture
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Built-in authentication
                    </p>
                    <p className="text-xs text-muted-foreground">
                      User auth handled via our gateway API
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => onSelectProvider("neon")}
              disabled={isProvisioningNeon || selectedProvider === "neon"}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isProvisioningNeon ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up database...
                </>
              ) : selectedProvider === "neon" ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Using Neon
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Use Neon (Recommended)
                </>
              )}
            </Button>
          </div>
        )}

        {/* Supabase Tab Content - Requires User OAuth */}
        {activeTab === "supabase" && (
          <div className="space-y-4 py-2">
            {hasSupabaseConnected ? (
              <>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Check className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Supabase Connected
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {supabaseEmail || "Your Supabase account"}
                        </p>
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={
                      selectedProvider === "supabase" ? "default" : "outline"
                    }
                    onClick={() => onSelectProvider("supabase")}
                    className="flex-1"
                    disabled={selectedProvider === "supabase"}
                  >
                    {selectedProvider === "supabase" ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Using Supabase
                      </>
                    ) : (
                      "Use Supabase"
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnectSupabase}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Connect your own Supabase account to use your own database
                    and authentication.
                  </p>
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Full-featured backend
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Database, auth, storage, and more
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Your own account</p>
                      <p className="text-xs text-muted-foreground">
                        Full control over your Supabase project
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Real-time subscriptions
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Live data updates out of the box
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={onConnectSupabase}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect Supabase Account
                </Button>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          {selectedProvider
            ? `Using ${
                selectedProvider === "neon" ? "Neon (Managed)" : "Supabase"
              } for this project`
            : "Select a provider to enable database features"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
