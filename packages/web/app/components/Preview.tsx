import { useState, useEffect, useRef, useCallback } from "react";
import { Globe } from "lucide-react";
import { classNames } from "../lib/classNames";

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

  // TODO: Replace this placeholder with your video URL
  const PREVIEW_VIDEO_URL = "https://res.cloudinary.com/drqyjtqgu/video/upload/v1770994514/329209_small_dzydp1.mp4";

  if (isLoading && !previewUrl) {
    return (
      <div className="h-full flex flex-col bg-[#0a0a0f] overflow-hidden relative">
        {/* Video Background */}
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          >
            <source src={PREVIEW_VIDEO_URL} type="video/mp4" />
          </video>
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/50" />
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
          {/* Animated Logo/Icon */}
          <div className="mb-6">
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/40 via-cyan-500/40 to-pink-500/40 rounded-2xl blur-xl animate-pulse" />
              
              {/* Icon container */}
              <div className="relative w-16 h-16 bg-gradient-to-br from-purple-600 via-cyan-500 to-pink-500 rounded-xl flex items-center justify-center shadow-2xl shadow-purple-500/40">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-white mb-2 text-center">
            Building Your App
          </h2>
          
          {/* Simple animated dots */}
          <div className="flex items-center gap-1 mt-4">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-[bounce_1s_ease-in-out_infinite]" />
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-[bounce_1s_ease-in-out_0.2s_infinite]" />
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-[bounce_1s_ease-in-out_0.4s_infinite]" />
          </div>
        </div>

        {/* Keyframe animations */}
        <style>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); opacity: 1; }
            50% { transform: translateY(-8px); opacity: 0.7; }
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
                {/* Gradient background */}
                <div className="absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-[#0a0a0f] to-cyan-900/20" />
                </div>
                
                {/* Loading content */}
                <div className="relative z-10 flex flex-col items-center">
                  {/* Animated icon */}
                  <div className="relative mb-4">
                    <div className="absolute -inset-3 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-pink-500/20 rounded-full blur-lg animate-pulse" />
                    <div className="relative w-14 h-14 bg-gradient-to-br from-purple-600 via-cyan-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  
                  <p className="text-white/70 text-sm font-medium">Loading preview...</p>
                  
                  {/* Simple progress bar */}
                  <div className="mt-3 w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full animate-[loadingBar_1.5s_ease-in-out_infinite]" />
                  </div>
                </div>

                <style>{`
                  @keyframes loadingBar {
                    0% { width: 0%; margin-left: 0; }
                    50% { width: 70%; margin-left: 0; }
                    100% { width: 0%; margin-left: 100%; }
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
