import { useEffect, useState } from "react";
import { Loader2, Sparkles, Code, Palette, Zap } from "lucide-react";
import crop from "~/assets/crop.png";

interface WorkspaceLoaderProps {
  title?: string;
}

export function WorkspaceLoader({ title }: WorkspaceLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const loadingSteps = [
    { icon: Code, label: "Initializing workspace...", color: "text-purple-400" },
    { icon: Palette, label: "Loading project files...", color: "text-pink-400" },
    { icon: Sparkles, label: "Setting up environment...", color: "text-blue-400" },
    { icon: Zap, label: "Almost ready...", color: "text-green-400" },
  ];

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + Math.random() * 15;
      });
    }, 200);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
    }, 1500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, []);

  const CurrentIcon = loadingSteps[currentStep].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080808]">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-purple-500/20 via-pink-500/15 to-blue-500/20 blur-[120px] animate-pulse" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[80px] animate-[pulse_3s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[100px] animate-[pulse_4s_ease-in-out_infinite]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl shadow-purple-500/20">
            <img src={crop} alt="Logo" className="w-12 h-12 object-contain" />
          </div>
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-purple-500/30 animate-ping" style={{ animationDuration: "2s" }} />
        </div>

        {/* Title */}
        {title && (
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold text-white mb-1 truncate px-4">
              {title}
            </h2>
            <p className="text-sm text-white/40">Loading your project</p>
          </div>
        )}

        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-4">
          {/* Step indicator */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white/5 ${loadingSteps[currentStep].color} transition-colors duration-500`}>
              <CurrentIcon className="w-5 h-5 animate-pulse" />
            </div>
            <span className="text-sm text-white/60 min-w-[200px] transition-all duration-500">
              {loadingSteps[currentStep].label}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* Spinning loader */}
          <div className="flex items-center gap-2 text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Please wait...</span>
          </div>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-purple-400/40 rounded-full animate-float"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 3) * 20}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${3 + i * 0.5}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS for float animation */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.4;
          }
          50% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.8;
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default WorkspaceLoader;

