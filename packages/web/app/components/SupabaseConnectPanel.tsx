import { Button } from "./ui/button";
import { Check, Loader2, X } from "lucide-react";

interface SupabaseConnectPanelProps {
  hasSupabaseConnected: boolean;
  isCheckingToken: boolean;
  isLoading: boolean;
  supabaseEmail?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function SupabaseConnectPanel({
  hasSupabaseConnected,
  isCheckingToken,
  isLoading,
  supabaseEmail,
  onConnect,
  onDisconnect,
}: SupabaseConnectPanelProps) {
  if (isCheckingToken) {
    return (
      <div className="p-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking Supabase connection...</p>
        </div>
      </div>
    );
  }

  if (hasSupabaseConnected) {
    return (
      <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-900 dark:text-green-100">
              {supabaseEmail ? `Supabase account connected (${supabaseEmail})` : "Supabase account connected"}
            </p>
          </div>
          <Button
            onClick={onDisconnect}
            disabled={isLoading}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
          >
            <X className="w-3 h-3 mr-1" />
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
        Connect Supabase Account
      </p>
      <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
        Connect your Supabase account to use your own projects and resources. You'll be redirected to Supabase to authorize.
      </p>
      <Button
        onClick={onConnect}
        disabled={isLoading}
        className="flex items-center gap-2 h-8 px-3 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z" />
            </svg>
            Connect Supabase
          </>
        )}
      </Button>
    </div>
  );
}

