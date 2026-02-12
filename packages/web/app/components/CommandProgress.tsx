import { useMemo } from "react";
import { 
  SpinnerGap, 
  Package,
  Lightning,
  Globe,
  Gear,
  Code,
  Check
} from "@phosphor-icons/react";
import { useCommandProgress } from "../stores/useWorkspaceStore";
import type { CommandProgressPhase } from "../stores/useWorkspaceStore";

interface ProgressStep {
  id: string;
  label: string;
  phase: CommandProgressPhase;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

const PROGRESS_STEPS: ProgressStep[] = [
  {
    id: "preparing",
    label: "Preparing environment",
    phase: "preparing",
    icon: <Gear className="w-5 h-5" weight="bold" />,
    activeIcon: <Gear className="w-5 h-5" weight="fill" />,
  },
  {
    id: "installing",
    label: "Installing dependencies",
    phase: "installing",
    icon: <Package className="w-5 h-5" weight="bold" />,
    activeIcon: <Package className="w-5 h-5" weight="fill" />,
  },
  {
    id: "building",
    label: "Building application",
    phase: "building",
    icon: <Code className="w-5 h-5" weight="bold" />,
    activeIcon: <Code className="w-5 h-5" weight="fill" />,
  },
  {
    id: "starting",
    label: "Starting dev server",
    phase: "starting",
    icon: <Lightning className="w-5 h-5" weight="bold" />,
    activeIcon: <Lightning className="w-5 h-5" weight="fill" />,
  },
  {
    id: "ready",
    label: "Preview ready",
    phase: "ready",
    icon: <Globe className="w-5 h-5" weight="bold" />,
    activeIcon: <Check className="w-5 h-5" weight="bold" />,
  },
];

const phaseOrder: CommandProgressPhase[] = [
  "idle",
  "preparing",
  "installing",
  "building",
  "starting",
  "ready",
];

function getPhaseIndex(phase: CommandProgressPhase): number {
  return phaseOrder.indexOf(phase);
}

interface CommandProgressProps {
  terminalLines?: string[];
  previewUrl?: string | null;
  isLoading?: boolean;
  className?: string;
}

export function CommandProgress({
  terminalLines = [],
  previewUrl,
  isLoading,
  className = "",
}: CommandProgressProps) {
  const commandProgress = useCommandProgress();

  // Derive progress from terminal output
  const derivedProgress = useMemo(() => {
    const recent = terminalLines.slice(-150);
    const text = recent.join("\n").toLowerCase();

    // Detect current phase from terminal output
    let phase: CommandProgressPhase = "idle";
    let message = "";

    // Check for preview ready first
    if (previewUrl) {
      phase = "ready";
      message = "Preview ready";
    }
    // Check for server starting/running
    else if (
      /ready in|local:|localhost:|compiled successfully|listening on|running at|http:\/\/|➜\s+local:/i.test(text)
    ) {
      phase = "ready";
      message = "Server is ready";
    }
    // Check for dev server starting
    else if (
      /starting.*dev|vite|next dev|webpack|dev server|starting server|starting development/i.test(text)
    ) {
      phase = "starting";
      message = "Starting dev server";
    }
    // Check for build process
    else if (
      /building|compiling|bundling|transforming|processing/i.test(text) &&
      !/installing|resolving|fetching/i.test(text)
    ) {
      phase = "building";
      message = "Building application";
    }
    // Check for npm install completion
    else if (
      /added\s+\d+\s+packages?|audited\s+\d+\s+packages?|up to date|already up to date|done in\s+\d|finished in\s+\d|success\s+saved lockfile|lockfile up to date|installed in\s+\d/i.test(text)
    ) {
      phase = "building";
      message = "Dependencies installed";
    }
    // Check for npm install in progress
    else if (
      /resolving|fetching|linking|installing|preinstall|postinstall|lockfile|progress|package\(s\)|npm install|npm i |pnpm install|yarn install|bun install/i.test(text)
    ) {
      phase = "installing";
      message = "Installing dependencies";
    }
    // Check for preparation/setup
    else if (
      /preparing|setting up|initializing|creating|writing files|mounting/i.test(text) ||
      (terminalLines.length > 0 && terminalLines.length < 10)
    ) {
      phase = "preparing";
      message = "Preparing environment";
    }
    // Default to preparing if terminal is running but no specific phase detected
    else if (isLoading && terminalLines.length > 0) {
      phase = "preparing";
      message = "Processing";
    }

    return { phase, message };
  }, [terminalLines, previewUrl, isLoading]);

  // Use derived progress or store progress (whichever is more advanced)
  const currentProgress = useMemo(() => {
    const derivedIndex = getPhaseIndex(derivedProgress.phase);
    const storeIndex = getPhaseIndex(commandProgress.phase);
    
    if (derivedIndex >= storeIndex) {
      return derivedProgress;
    }
    return {
      phase: commandProgress.phase,
      message: commandProgress.message,
    };
  }, [derivedProgress, commandProgress]);

  // Get current step info
  const currentStep = useMemo(() => {
    return PROGRESS_STEPS.find(step => step.phase === currentProgress.phase) || PROGRESS_STEPS[0];
  }, [currentProgress.phase]);

  // Don't render if idle and not loading
  if (currentProgress.phase === "idle" && !isLoading) {
    return null;
  }

  const isReady = currentProgress.phase === "ready";

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Single step indicator with flickering effect */}
      <div 
        className={`
          flex items-center gap-3 px-5 py-3 rounded-2xl 
          backdrop-blur-xl border transition-all duration-500
          ${isReady 
            ? "bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/20" 
            : "bg-white/[0.08] border-white/[0.12] shadow-lg shadow-purple-500/10"
          }
        `}
      >
        {/* Icon with animation */}
        <div 
          className={`
            relative flex items-center justify-center w-10 h-10 rounded-xl
            ${isReady 
              ? "bg-green-500/20 text-green-400" 
              : "bg-purple-500/20 text-purple-400"
            }
          `}
        >
          {isReady ? (
            <Check className="w-5 h-5" weight="bold" />
          ) : (
            <>
              {/* Flickering glow effect */}
              <div className="absolute inset-0 rounded-xl bg-purple-500/30 animate-[flicker_1.5s_ease-in-out_infinite]" />
              <div className="relative z-10 animate-[pulse_2s_ease-in-out_infinite]">
                {currentStep.activeIcon}
              </div>
            </>
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col">
          <span 
            className={`
              text-sm font-semibold tracking-wide
              ${isReady ? "text-green-400" : "text-white"}
            `}
          >
            {currentStep.label}
          </span>
          {!isReady && (
            <span className="text-xs text-white/50 flex items-center gap-1.5">
              <SpinnerGap className="w-3 h-3 animate-spin" />
              Please wait...
            </span>
          )}
        </div>

        {/* Animated dots for non-ready state */}
        {!isReady && (
          <div className="flex items-center gap-1 ml-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>

      {/* Flickering animation keyframes */}
      <style>{`
        @keyframes flicker {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default CommandProgress;
