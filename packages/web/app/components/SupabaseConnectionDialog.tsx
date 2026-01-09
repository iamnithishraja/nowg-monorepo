import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Loader2, Check, X, Database, ExternalLink } from "lucide-react";

interface SupabaseConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasSupabaseConnected: boolean;
  isCheckingToken: boolean;
  supabaseEmail?: string;
  onConnect: () => void;
  onDisconnect: () => Promise<void>;
}

export function SupabaseConnectionDialog({
  open,
  onOpenChange,
  hasSupabaseConnected,
  isCheckingToken,
  supabaseEmail,
  onConnect,
  onDisconnect,
}: SupabaseConnectionDialogProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await onDisconnect();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isCheckingToken) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Checking Connection
            </DialogTitle>
            <DialogDescription>
              Verifying your Supabase account connection...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (hasSupabaseConnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              Supabase Connected
            </DialogTitle>
            <DialogDescription>
              Your Supabase account is connected and ready to use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Database className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Connected Account</p>
                    <p className="text-xs text-muted-foreground">
                      {supabaseEmail || "Supabase account"}
                    </p>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="w-full"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Disconnect Account
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Database className="w-5 h-5 text-primary" />
            </div>
            Connect Supabase Account
          </DialogTitle>
          <DialogDescription>
            Connect your Supabase account to use your own projects and resources. You'll be redirected to authorize access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                <Check className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Access your projects</p>
                <p className="text-xs text-muted-foreground">
                  View and manage your Supabase projects
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                <Check className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Create new projects</p>
                <p className="text-xs text-muted-foreground">
                  Provision databases for your conversations
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded bg-primary/10 mt-0.5">
                <Check className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Secure access</p>
                <p className="text-xs text-muted-foreground">
                  Your credentials are stored securely
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={onConnect}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect with Supabase
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            You'll be redirected to Supabase to authorize this connection
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

