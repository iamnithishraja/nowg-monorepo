import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Globe } from "lucide-react";
import { classNames } from "../lib/classNames";
import { CommandProgress } from "./CommandProgress";

interface PreviewPanelProps {
  previewUrl: string | null | undefined;
  isLoading: boolean;
  terminalLines?: string[];
  onElementSelected?: (info: any) => void;
  onInspectorEnable?: () => void;
}

interface WindowSize {
  name: string;
  width: number;
  height: number;
  icon: string;
  frameType?: "mobile" | "tablet" | "laptop" | "desktop";
}

const WINDOW_SIZES: WindowSize[] = [
  // Modern iPhones
  {
    name: "iPhone 16",
    width: 393,
    height: 852,
    icon: "mobile",
    frameType: "mobile",
  },
  {
    name: "iPhone 16 Pro",
    width: 402,
    height: 874,
    icon: "mobile",
    frameType: "mobile",
  },
  {
    name: "iPhone 16 Pro Max",
    width: 440,
    height: 956,
    icon: "mobile",
    frameType: "mobile",
  },
  {
    name: "iPhone SE",
    width: 375,
    height: 667,
    icon: "mobile",
    frameType: "mobile",
  },
  // Google Pixel
  {
    name: "Pixel 9",
    width: 412,
    height: 915,
    icon: "mobile",
    frameType: "mobile",
  },
  {
    name: "Pixel 9 Pro",
    width: 412,
    height: 915,
    icon: "mobile",
    frameType: "mobile",
  },
  // Samsung Galaxy
  {
    name: "Galaxy S24",
    width: 412,
    height: 915,
    icon: "mobile",
    frameType: "mobile",
  },
  {
    name: "Galaxy S24 Ultra",
    width: 412,
    height: 938,
    icon: "mobile",
    frameType: "mobile",
  },
  // Tablets
  {
    name: "iPad Mini",
    width: 768,
    height: 1024,
    icon: "tablet",
    frameType: "tablet",
  },
  {
    name: "iPad Air",
    width: 820,
    height: 1180,
    icon: "tablet",
    frameType: "tablet",
  },
  {
    name: "iPad Pro 11",
    width: 834,
    height: 1194,
    icon: "tablet",
    frameType: "tablet",
  },
  // Desktop
  {
    name: "Laptop",
    width: 1366,
    height: 768,
    icon: "laptop",
    frameType: "laptop",
  },
  {
    name: "Desktop",
    width: 1920,
    height: 1080,
    icon: "desktop",
    frameType: "desktop",
  },
];

export default function PreviewPanel({
  previewUrl,
  isLoading,
  terminalLines = [],
  onElementSelected,
  onInspectorEnable,
}: PreviewPanelProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isInspectorMode, setIsInspectorMode] = useState(false);
  const [inspectorReady, setInspectorReady] = useState(false);
  const [isDeviceModeOn, setIsDeviceModeOn] = useState(false);
  const [selectedWindowSize, setSelectedWindowSize] = useState<WindowSize>(
    WINDOW_SIZES[0]
  );
  const [isLandscape, setIsLandscape] = useState(false);
  const [showDeviceFrame, setShowDeviceFrame] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewUrl) {
      setIframeLoading(true);
      setIframeError(false);
      setErrorMessage(null);
      setRefreshKey((prev) => prev + 1);
      setInspectorReady(false);
    }
  }, [previewUrl]);

  // Handle fullscreen changes
  // Listen for custom toggleInspector events from ChatPanel
  useEffect(() => {
    const handleToggleInspector = (event: CustomEvent) => {
      if (event.detail && typeof event.detail.enabled === 'boolean') {
        setIsInspectorMode(event.detail.enabled);
        // Also call the original toggleInspector logic if enabling
        if (event.detail.enabled) {
          try {
            onInspectorEnable?.();
          } catch {}
        }
        // Send message to iframe
        try {
          if (inspectorReady) {
            iframeRef.current?.contentWindow?.postMessage(
              { type: "INSPECTOR_ACTIVATE", active: event.detail.enabled },
              "*"
            );
          } else if (event.detail.enabled) {
            handleRefresh();
          }
        } catch {}
      }
    };

    // Type cast for CustomEvent
    const eventListener = handleToggleInspector as EventListener;
    window.addEventListener("toggleInspector", eventListener);
    return () => {
      window.removeEventListener("toggleInspector", eventListener);
    };
  }, [inspectorReady, onInspectorEnable]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data: any = event.data;
      if (data && data.type === "preview-console") {
        if (data.level === "error") {
          setIframeError(true);
          try {
            const msg = Array.isArray(data.args)
              ? data.args
                  .map((a: any) =>
                    typeof a === "string" ? a : JSON.stringify(a)
                  )
                  .join(" ")
              : String(data.args ?? "");
            const benign =
              /origins don't match|preloaded using link preload|ResizeObserver loop (limit exceeded|completed with undelivered notifications)|websocket connection .* failed|hmr/i.test(
                msg
              );
            if (benign) {
              setIframeError(false);
            } else {
              setErrorMessage(msg || "Runtime error");
            }
          } catch {
            setErrorMessage("Runtime error");
          }
        }
        (console as any)[data.level || "log"]?.(
          "[preview]",
          ...(data.args || [])
        );
      } else if (data && data.type === "INSPECTOR_READY") {
        try {
          setInspectorReady(true);
          iframeRef.current?.contentWindow?.postMessage(
            { type: "INSPECTOR_ACTIVATE", active: isInspectorMode },
            "*"
          );
        } catch {}
      } else if (data && data.type === "INSPECTOR_CLICK") {
        try {
          const element = data.elementInfo;

          try {
            onElementSelected?.(element);
          } catch {}
          try {
            // Keep inspector mode active to allow selecting multiple elements consecutively
            // Do not disable inspector after a single selection
            // Notify others (e.g., input bar) that selection is complete
            try {
              const doneEvent = new CustomEvent("inspectorSelectionComplete");
              window.dispatchEvent(doneEvent);
            } catch {}
          } catch {}
        } catch {}
      } else if (data && data.type === "HOST_APPLY_INLINE_STYLES") {
        try {
          iframeRef.current?.contentWindow?.postMessage(
            { type: "APPLY_INLINE_STYLES", payload: data.payload },
            "*"
          );
        } catch {}
      } else if (data && data.type === "HOST_APPLY_TEXT_CONTENT") {
        try {
          iframeRef.current?.contentWindow?.postMessage(
            { type: "APPLY_TEXT_CONTENT", payload: data.payload },
            "*"
          );
        } catch {}
      } else if (data && data.type === "HOST_SET_ATTRIBUTE") {
        try {
          iframeRef.current?.contentWindow?.postMessage(
            { type: "HOST_SET_ATTRIBUTE", payload: data.payload },
            "*"
          );
        } catch {}
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isInspectorMode, onElementSelected]);

  const handleRefresh = () => {
    setIframeLoading(true);
    setIframeError(false);
    setRefreshKey((prev) => prev + 1);
    setInspectorReady(false);
  };

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Failed to toggle fullscreen:", err);
    }
  }, []);

  const handleIframeLoad = () => {
    setIframeLoading(false);
    setIframeError(false);
  };

  const handleIframeError = () => {
    setIframeLoading(false);
    setIframeError(true);
  };

  // Listen for preview control actions dispatched from the top-right header
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ action?: string }>;
      const action = customEvent.detail?.action;

      if (!action) return;

      if (action === "refresh") {
        handleRefresh();
      } else if (action === "toggleDeviceMode") {
        setIsDeviceModeOn((prev) => !prev);
      } else if (action === "toggleFullscreen") {
        toggleFullscreen();
      }
    };

    window.addEventListener("preview-control", handler as EventListener);
    return () => {
      window.removeEventListener("preview-control", handler as EventListener);
    };
  }, [toggleFullscreen]);

  const getFrameColor = useCallback(() => {
    return "#1a1a1a";
  }, []);

  // Derive a friendly loading state from terminal output
  const loadingInfo = useMemo(() => {
    // Consider only recent non-command output to avoid treating echoed commands as progress
    const recent = (terminalLines || []).slice(-120);
    const nonCommandLines = recent.filter((l) => !/^\s*\$\s/.test(l));
    const text = nonCommandLines.join("\n");
    const hasActivity = nonCommandLines.length > 0;

    // Detect install activity vs completion (npm/pnpm/yarn/bun)
    const installActive =
      /(resolving|fetching|linking|installing|preinstall|postinstall|lockfile|progress|package\(s\))/i.test(
        text
      );
    const installDone =
      /(added\s+\d+\s+packages?|audited\s+\d+\s+packages?|up to date|Already up to date|Done in\s+\d|finished in\s+\d|success\s+Saved lockfile|lockfile up to date|installed in\s+\d)/i.test(
        text
      );

    // Detect dev server activity vs ready
    const serverActive =
      /(dev server|starting.*dev|vite|next dev|webpack|listening|server started|building for development|compiling)/i.test(
        text
      );
    const serverReady =
      /(ready in|Local:|compiled successfully|listening on|running at|http:\/\/|https:\/\/)/i.test(
        text
      );

    // Friendly message + details
    const message = installActive && !installDone
      ? "Installing dependencies"
      : serverActive
      ? "Starting development server"
      : hasActivity
      ? "Setting things up"
      : "Preparing workspace";

    const details =
      installActive && !installDone
        ? "Fetching packages and linking modules..."
        : serverActive
        ? "Booting the dev server and preparing your preview..."
        : hasActivity
        ? "Applying project files and initializing the environment..."
        : "Spinning up a lightweight runtime...";

    // Steps and completion
    // Always consider environment preparation done to avoid an empty first step feel
    const donePrepare = true;
    const doneInstall = installDone;
    const doneStart = serverReady || !!previewUrl;
    const doneOpen = !!previewUrl;
    const steps = [
      { label: "Prepare environment", done: donePrepare },
      { label: "Install dependencies", done: doneInstall },
      { label: "Start dev server", done: doneStart },
      { label: "Open preview", done: doneOpen },
    ];

    // Progress with a baseline 25% so it never feels stuck at 0
    let progress = 25;
    if (installActive && !installDone) progress = Math.max(progress, 40);
    if (doneInstall) progress = Math.max(progress, 55);
    if (serverActive && !serverReady) progress = Math.max(progress, 70);
    if (doneStart) progress = Math.max(progress, 85);
    if (doneOpen) progress = 100;

    return { message, details, steps, progress };
  }, [terminalLines, previewUrl]);

  if (isLoading && !previewUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0a0a0f] overflow-hidden relative">
        {/* Smooth animated space background */}
        <div className="absolute inset-0">
          {/* Gradient orbs - smooth continuous rotation */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] animate-[smoothDrift_20s_linear_infinite]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-[100px] animate-[smoothDrift_25s_linear_infinite_reverse]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[120px] animate-[smoothDrift_30s_linear_infinite]" />
          
          {/* Stars - gentle consistent glow */}
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={`star-${i}`}
              className="absolute rounded-full bg-white animate-[gentleGlow_3s_linear_infinite]"
              style={{
                animationDelay: `${(i * 0.05)}s`,
                left: `${(i * 17) % 100}%`,
                top: `${(i * 23) % 100}%`,
                width: `${1.5 + (i % 3)}px`,
                height: `${1.5 + (i % 3)}px`,
              }}
            />
          ))}

          {/* Floating particles - smooth linear drift */}
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-[smoothFloat_12s_linear_infinite]"
              style={{
                animationDelay: `${i * 0.8}s`,
                left: `${(i * 7) % 100}%`,
                top: `${(i * 13) % 100}%`,
                width: `${4 + (i % 4)}px`,
                height: `${4 + (i % 4)}px`,
                background: ['#a855f7', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'][i % 5],
                opacity: 0.5,
              }}
            />
          ))}
        </div>

        {/* Main animated orb - centered */}
        <div className="relative z-10 flex items-center justify-center flex-1">
          <div className="relative">
            {/* Outer glow - smooth rotation */}
            <div className="absolute -inset-8 bg-gradient-to-r from-purple-500/25 via-cyan-500/25 to-pink-500/25 rounded-full blur-2xl animate-[smoothSpin_8s_linear_infinite]" />
            
            {/* Outer rotating ring */}
            <div className="absolute -inset-4 w-40 h-40 rounded-full border-2 border-transparent border-t-purple-500 border-r-cyan-500 animate-[smoothSpin_6s_linear_infinite]" />
            
            {/* Middle rotating ring (opposite direction) */}
            <div className="absolute -inset-2 w-36 h-36 rounded-full border-2 border-transparent border-b-pink-500 border-l-purple-500 animate-[smoothSpin_5s_linear_infinite_reverse]" />
            
            {/* Inner rotating ring */}
            <div className="absolute inset-0 w-32 h-32 rounded-full border-2 border-transparent border-t-cyan-400 border-r-purple-400 animate-[smoothSpin_4s_linear_infinite]" />
            
            {/* Core orb container */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              {/* Glow behind orb - smooth rotation */}
              <div className="absolute inset-2 bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 rounded-full opacity-50 blur-md animate-[smoothSpin_10s_linear_infinite]" />
              
              {/* Main orb */}
              <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600 via-cyan-500 to-pink-500 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/50 animate-[smoothSpin_15s_linear_infinite]">
                {/* Inner highlight */}
                <div className="absolute top-2 left-4 w-8 h-4 bg-white/30 rounded-full blur-sm" />
                
                {/* Icon - smooth float */}
                <div className="text-white drop-shadow-lg animate-[smoothFloat_4s_linear_infinite]">
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Orbiting dots - consistent speed */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-full animate-[orbit_6s_linear_infinite]"
                style={{
                  background: ['#a855f7', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6', '#f472b6'][i],
                  animationDelay: `${i * -1}s`,
                  top: '50%',
                  left: '50%',
                  marginTop: '-6px',
                  marginLeft: '-6px',
                  transformOrigin: '6px 6px',
                  boxShadow: `0 0 12px ${['#a855f7', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6', '#f472b6'][i]}`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Command Progress Component - positioned at bottom */}
        <div className="relative z-10 pb-12">
          <CommandProgress 
            terminalLines={terminalLines} 
            previewUrl={previewUrl}
            isLoading={isLoading}
          />
        </div>

        {/* Smooth keyframe animations */}
        <style>{`
          @keyframes smoothSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes smoothFloat {
            0% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0); }
          }
          
          @keyframes smoothDrift {
            0% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(20px, -20px) rotate(90deg); }
            50% { transform: translate(0, -10px) rotate(180deg); }
            75% { transform: translate(-20px, -20px) rotate(270deg); }
            100% { transform: translate(0, 0) rotate(360deg); }
          }
          
          @keyframes orbit {
            from { transform: rotate(0deg) translateX(80px) rotate(0deg); }
            to { transform: rotate(360deg) translateX(80px) rotate(-360deg); }
          }
          
          @keyframes gentleGlow {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-card via-card to-muted/20">
        <div className="text-center space-y-4 p-8">
          <div className="relative inline-block">
            <Globe className="w-16 h-16 text-muted-foreground/40 mx-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-lg font-semibold">
              No Preview Available
            </p>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Start building something to see a live preview
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-card transition-all duration-300"
    >
      {/* Enhanced Preview Content */}
      <div className="flex-1 relative bg-background overflow-hidden">
        {iframeError ? (
          <div className="absolute inset-0 overflow-auto bg-[#1e1e1e] text-[#e5e5e5] font-mono text-xs animate-in fade-in-0 duration-300">
            <div className="p-4 border-b border-red-900/50 bg-red-950/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 font-semibold text-sm">
                  Runtime Error
                </span>
              </div>
            </div>
            <div className="p-4">
              <pre className="whitespace-pre-wrap break-words text-red-200/90 leading-relaxed">
                {errorMessage || "An unexpected runtime error occurred"}
              </pre>
            </div>
          </div>
        ) : (
          <>
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f] z-10 overflow-hidden">
                {/* Smooth animated space background */}
                <div className="absolute inset-0">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[80px] animate-[smoothDrift_20s_linear_infinite]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/15 rounded-full blur-[60px] animate-[smoothDrift_25s_linear_infinite_reverse]" />
                  
                  {/* Stars - gentle consistent glow */}
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div
                      key={`preview-star-${i}`}
                      className="absolute rounded-full bg-white animate-[gentleGlow_3s_linear_infinite]"
                      style={{
                        animationDelay: `${(i * 0.1)}s`,
                        left: `${(i * 17) % 100}%`,
                        top: `${(i * 23) % 100}%`,
                        width: `${1.5 + (i % 3)}px`,
                        height: `${1.5 + (i % 3)}px`,
                      }}
                    />
                  ))}
                </div>
                
                {/* Animated orb */}
                <div className="relative z-10">
                  <div className="relative">
                    {/* Outer glow - smooth rotation */}
                    <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-pink-500/20 rounded-full blur-xl animate-[smoothSpin_8s_linear_infinite]" />
                    
                    {/* Rotating rings - consistent speed */}
                    <div className="absolute -inset-2 w-24 h-24 rounded-full border-2 border-transparent border-t-purple-500 border-r-cyan-500 animate-[smoothSpin_5s_linear_infinite]" />
                    <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-transparent border-b-pink-500 border-l-purple-500 animate-[smoothSpin_4s_linear_infinite_reverse]" />
                    
                    {/* Core orb */}
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <div className="absolute inset-2 bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 rounded-full opacity-40 blur-sm animate-[smoothSpin_10s_linear_infinite]" />
                      <div className="relative w-14 h-14 bg-gradient-to-br from-purple-600 via-cyan-500 to-pink-500 rounded-full flex items-center justify-center shadow-xl shadow-purple-500/40 animate-[smoothSpin_12s_linear_infinite]">
                        <svg className="w-6 h-6 text-white animate-[smoothFloat_4s_linear_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>

                    {/* Orbiting dots - consistent speed */}
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full animate-[orbitSmall_5s_linear_infinite]"
                        style={{
                          background: ['#a855f7', '#06b6d4', '#ec4899', '#8b5cf6'][i],
                          animationDelay: `${i * -1.25}s`,
                          top: '50%',
                          left: '50%',
                          marginTop: '-4px',
                          marginLeft: '-4px',
                          transformOrigin: '4px 4px',
                          boxShadow: `0 0 8px ${['#a855f7', '#06b6d4', '#ec4899', '#8b5cf6'][i]}`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Smooth keyframes */}
                <style>{`
                  @keyframes smoothSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                  @keyframes smoothFloat {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                    100% { transform: translateY(0); }
                  }
                  @keyframes smoothDrift {
                    0% { transform: translate(0, 0) rotate(0deg); }
                    25% { transform: translate(15px, -15px) rotate(90deg); }
                    50% { transform: translate(0, -8px) rotate(180deg); }
                    75% { transform: translate(-15px, -15px) rotate(270deg); }
                    100% { transform: translate(0, 0) rotate(360deg); }
                  }
                  @keyframes orbitSmall {
                    from { transform: rotate(0deg) translateX(50px) rotate(0deg); }
                    to { transform: rotate(360deg) translateX(50px) rotate(-360deg); }
                  }
                  @keyframes gentleGlow {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.7; }
                  }
                `}</style>
              </div>
            )}

            {/* Device Frame Mode */}
            {isDeviceModeOn && showDeviceFrame ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-8">
                <div
                  className="relative rounded-3xl transition-all duration-300"
                  style={{
                    background: getFrameColor(),
                    padding:
                      selectedWindowSize.frameType === "mobile"
                        ? "40px 20px"
                        : "30px 20px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                    width: isLandscape
                      ? `${selectedWindowSize.height + 40}px`
                      : `${selectedWindowSize.width + 40}px`,
                    height: isLandscape
                      ? `${selectedWindowSize.width + 80}px`
                      : `${selectedWindowSize.height + 80}px`,
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: "center",
                  }}
                >
                  {/* Notch/Camera */}
                  {selectedWindowSize.frameType === "mobile" && (
                    <div
                      className="absolute bg-black rounded-full"
                      style={{
                        top: isLandscape ? "50%" : "15px",
                        left: isLandscape ? "15px" : "50%",
                        transform: isLandscape
                          ? "translateY(-50%)"
                          : "translateX(-50%)",
                        width: isLandscape ? "6px" : "50px",
                        height: isLandscape ? "50px" : "6px",
                      }}
                    />
                  )}

                  <iframe
                    key={refreshKey}
                    src={previewUrl}
                    className="w-full h-full bg-white rounded-xl"
                    style={{
                      width: isLandscape
                        ? `${selectedWindowSize.height}px`
                        : `${selectedWindowSize.width}px`,
                      height: isLandscape
                        ? `${selectedWindowSize.width}px`
                        : `${selectedWindowSize.height}px`,
                    }}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                    onLoad={handleIframeLoad}
                    onError={handleIframeError}
                    title="App Preview"
                    ref={iframeRef}
                  />
                </div>
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center overflow-auto"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: "top left",
                  width: `${100 / (zoomLevel / 100)}%`,
                  height: `${100 / (zoomLevel / 100)}%`,
                }}
              >
                <iframe
                  key={refreshKey}
                  src={previewUrl}
                  className={classNames(
                    "w-full h-full border-0 bg-white transition-opacity duration-300",
                    iframeLoading ? "opacity-0" : "opacity-100"
                  )}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  title="App Preview"
                  ref={iframeRef}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
