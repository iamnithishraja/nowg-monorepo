import { Button } from "./ui/button";
import { Check, Loader2, X } from "lucide-react";

interface FigmaConnectPanelProps {
  hasFigmaConnected: boolean;
  isCheckingToken: boolean;
  isLoading?: boolean;
  figmaEmail?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

// Figma logo SVG component
function FigmaLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 38 57"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z"
        fill="#1ABCFE"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z"
        fill="#0ACF83"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z"
        fill="#FF7262"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z"
        fill="#F24E1E"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z"
        fill="#A259FF"
      />
    </svg>
  );
}

export function FigmaConnectPanel({
  hasFigmaConnected,
  isCheckingToken,
  isLoading,
  figmaEmail,
  onConnect,
  onDisconnect,
}: FigmaConnectPanelProps) {
  if (isCheckingToken) {
    return (
      <div className="p-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Checking Figma connection...
          </p>
        </div>
      </div>
    );
  }

  if (hasFigmaConnected) {
    return (
      <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <p className="text-sm text-purple-900 dark:text-purple-100">
              {figmaEmail
                ? `Figma connected (${figmaEmail})`
                : "Figma account connected"}
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
    <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
      <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">
        Connect Figma Account
      </p>
      <p className="text-xs text-purple-700 dark:text-purple-300 mb-3">
        You'll be redirected to Figma to authorize.
      </p>
      <Button
        onClick={onConnect}
        disabled={isLoading}
        className="flex items-center gap-2 h-8 px-3 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <FigmaLogo className="w-4 h-4" />
            Connect Figma
          </>
        )}
      </Button>
    </div>
  );
}


