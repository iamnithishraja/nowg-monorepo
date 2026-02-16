import * as React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface VideoItem {
  id: string;
  url: string;
  title?: string;
  description?: string;
}

interface VideoCarouselProps {
  videos: VideoItem[];
  className?: string;
}

export function VideoCarousel({ videos, className = "" }: VideoCarouselProps) {
  const [current, setCurrent] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const videoRefs = React.useRef<(HTMLVideoElement | null)[]>([]);

  const prev = () => setCurrent((c) => (c === 0 ? videos.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === videos.length - 1 ? 0 : c + 1));

  const togglePlayPause = () => {
    setIsPlaying((p) => {
      const newState = !p;
      videoRefs.current.forEach((v) => {
        if (v) {
          if (newState) v.play().catch(() => {});
          else v.pause();
        }
      });
      return newState;
    });
  };

  React.useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c === videos.length - 1 ? 0 : c + 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [isPlaying, videos.length]);

  return (
    <div
      className={`relative h-full w-full flex items-center justify-center ${className}`}
      style={{ background: "#2c2c33" }}
    >
      {/* ---- Getting ready spinner ---- */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <GettingReadyIcon />
        <span
          style={{
            color: "rgba(255,255,255,.65)",
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Getting ready...
        </span>
      </div>

      {/* ---- Left dot indicators ---- */}
      <div
        style={{
          position: "absolute",
          left: 24,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 7,
          zIndex: 10,
        }}
      >
        {videos.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: 5,
              height: i === current ? 22 : 5,
              borderRadius: 99,
              background:
                i === current
                  ? "rgba(255,255,255,.8)"
                  : "rgba(255,255,255,.18)",
              transition: "all .3s ease",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      {/* ---- Centre column ---- */}
      <div
        style={{
          width: "60%",
          maxWidth: 520,
          marginTop: 40,
        }}
      >
        {/* Stacked-card wrapper (video + text all inside) */}
        <div
          style={{ position: "relative", width: "100%", paddingBottom: "88%" }}
        >
          {/* Card behind-2 (smallest, topmost) */}
          <div
            style={{
              position: "absolute",
              left: "8%",
              right: "8%",
              top: 0,
              bottom: "10%",
              borderRadius: 16,
              background: "#44444d",
            }}
          />

          {/* Card behind-1 */}
          <div
            style={{
              position: "absolute",
              left: "4%",
              right: "4%",
              top: "5%",
              bottom: "5%",
              borderRadius: 16,
              background: "#4a4a52",
            }}
          />

          {/* Front card — border wrapper */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "10%",
              bottom: 0,
              borderRadius: 16,
              padding: 2,
              background: "rgba(255,255,255,.10)",
            }}
          >
            {/* Inner dark fill — contains BOTH video and text */}
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 14,
                background: "#35353d",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Video section */}
              <div
                style={{
                  flex: 1,
                  margin: 6,
                  marginBottom: 0,
                  borderRadius: 10,
                  overflow: "hidden",
                  position: "relative",
                  minHeight: 0,
                }}
              >
                {videos.map((v, i) => (
                  <video
                    key={v.id}
                    ref={(el) => {
                      videoRefs.current[i] = el;
                    }}
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{
                      position: i === 0 ? "relative" : "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      opacity: i === current ? 1 : 0,
                      transition: "opacity .5s ease",
                      display: "block",
                    }}
                  >
                    <source src={v.url} type="video/mp4" />
                  </video>
                ))}
              </div>

              {/* Text section — inside the card */}
              <div style={{ padding: "18px 20px 22px" }}>
                <h3
                  style={{
                    color: "#fff",
                    fontSize: 19,
                    fontWeight: 600,
                    lineHeight: 1.3,
                    margin: 0,
                  }}
                >
                  {videos[current].title}
                </h3>
                <p
                  style={{
                    color: "#9a9aa3",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    marginTop: 6,
                    marginBottom: 0,
                  }}
                >
                  {videos[current].description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Right navigation controls ---- */}
      <div
        style={{
          position: "absolute",
          right: 24,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 7,
          zIndex: 10,
        }}
      >
        <NavBtn onClick={prev}>
          <ChevronUp size={16} />
        </NavBtn>
        <PausePlayBtn isPlaying={isPlaying} onClick={togglePlayPause} />
        <NavBtn onClick={next}>
          <ChevronDown size={16} />
        </NavBtn>
      </div>

      <style>{`
        @keyframes carousel-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ---- Sub-components ---- */

function GettingReadyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(255,255,255,.55)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function NavBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#8a8a94",
        cursor: "pointer",
        transition: "background .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,.06)";
      }}
    >
      {children}
    </button>
  );
}

function PausePlayBtn({
  isPlaying,
  onClick,
}: {
  isPlaying: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#8a8a94",
        cursor: "pointer",
        transition: "background .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,.06)";
      }}
    >
      {isPlaying ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="2" y="1" width="3.5" height="12" rx="1" />
          <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M3 1.5v11l9-5.5L3 1.5z" />
        </svg>
      )}
    </button>
  );
}

export default VideoCarousel;
