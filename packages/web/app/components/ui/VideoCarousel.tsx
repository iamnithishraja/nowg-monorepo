import * as React from "react";
import { ChevronUp, ChevronDown, Volume2, VolumeX } from "lucide-react";

interface VideoItem {
  id: string;
  url: string;
  title?: string;
  description?: string;
  hasAudio?: boolean;
  duration: number;
}

interface VideoCarouselProps {
  videos: VideoItem[];
  className?: string;
}

export function VideoCarousel({ videos, className = "" }: VideoCarouselProps) {
  const [current, setCurrent] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [isMuted, setIsMuted] = React.useState(true);
  const videoRefs = React.useRef<(HTMLVideoElement | null)[]>([]);
  const isPlayingRef = React.useRef(isPlaying);
  const videoReadyRefs = React.useRef<boolean[]>(videos.map(() => false));
  const previousCurrentRef = React.useRef<number>(current);
  const isPlayingVideoRef = React.useRef<number | null>(null);
  isPlayingRef.current = isPlaying;

  const advance = React.useCallback(() => {
    setCurrent((c) => (c === videos.length - 1 ? 0 : c + 1));
  }, [videos.length]);

  // Reset tracking when videos array length changes (e.g., opening different project)
  React.useEffect(() => {
    videoReadyRefs.current = videos.map(() => false);
    isPlayingVideoRef.current = null;
    previousCurrentRef.current = current;
  }, [videos.length, current]);

  const prev = () => setCurrent((c) => (c === 0 ? videos.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === videos.length - 1 ? 0 : c + 1));

  const playVideo = React.useCallback((video: HTMLVideoElement, videoIndex: number) => {
    if (!video) return;
    
    // Prevent multiple play attempts for the same video
    if (isPlayingVideoRef.current === videoIndex && !video.paused) {
      return;
    }
    
    isPlayingVideoRef.current = videoIndex;
    
    // Check if video is ready to play
    if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
      const p = video.play();
      if (p) {
        p.catch(() => {
          // If play fails, try muting and playing again
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    } else {
      // Wait for video to be ready
      const handleCanPlay = () => {
        if (isPlayingRef.current && videoIndex === current) {
          const p = video.play();
          if (p) {
            p.catch(() => {
              video.muted = true;
              video.play().catch(() => {});
            });
          }
        }
        video.removeEventListener('canplay', handleCanPlay);
      };
      video.addEventListener('canplay', handleCanPlay);
    }
  }, [current]);

  const togglePlayPause = () => {
    setIsPlaying((p) => {
      const newState = !p;
      const v = videoRefs.current[current];
      if (v) {
        if (newState) {
          isPlayingVideoRef.current = null; // Reset to allow play
          playVideo(v, current);
        } else {
          v.pause();
          isPlayingVideoRef.current = null;
        }
      }
      return newState;
    });
  };

  const toggleMute = () => {
    setIsMuted((m) => {
      const newMuted = !m;
      videoRefs.current.forEach((v) => {
        if (v) v.muted = newMuted;
      });
      return newMuted;
    });
  };

  // Play current video, pause others, advance after duration via setTimeout
  React.useEffect(() => {
    const previousCurrent = previousCurrentRef.current;
    const videoSwitched = previousCurrent !== current;
    previousCurrentRef.current = current;

    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === current) {
        // Only reset currentTime if we actually switched videos
        if (videoSwitched) {
          v.currentTime = 0;
          isPlayingVideoRef.current = null; // Reset play tracking when switching
        }
        if (isPlayingRef.current) {
          playVideo(v, i);
        }
      } else {
        v.pause();
        // Clear play tracking for paused videos
        if (isPlayingVideoRef.current === i) {
          isPlayingVideoRef.current = null;
        }
      }
    });

    const ms = videos[current]?.duration * 1000 || 0;
    const timer = ms > 0 ? setTimeout(advance, ms) : null;

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [current, advance, playVideo]);

  const currentHasAudio = videos[current]?.hasAudio;

  return (
    <div
      className={`relative h-full w-full flex items-center justify-center ${className}`}
      style={{ background: "#080808" }}
    >
      {/* ---- Getting ready ---- */}
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
            color: "rgba(255,255,255,.55)",
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
                  ? "#7b4cff"
                  : "rgba(123,76,255,.25)",
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
              background: "#1a1030",
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
              background: "#221545",
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
              background: "rgba(123,76,255,.25)",
            }}
          >
            {/* Inner dark fill — contains BOTH video and text */}
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 14,
                background: "#0c0c0c",
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
                    src={v.url}
                    muted
                    playsInline
                    preload="auto"
                    onLoadedData={(e) => {
                      const video = e.currentTarget;
                      videoReadyRefs.current[i] = true;
                      // If this is the current video and we should be playing, play it
                      if (i === current && isPlayingRef.current) {
                        playVideo(video, i);
                      }
                    }}
                    onCanPlay={(e) => {
                      const video = e.currentTarget;
                      videoReadyRefs.current[i] = true;
                      // If this is the current video and we should be playing, play it
                      if (i === current && isPlayingRef.current) {
                        playVideo(video, i);
                      }
                    }}
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
                  />
                ))}

                {/* Mute/unmute button — only when current video has audio */}
                {currentHasAudio && (
                  <button
                    onClick={toggleMute}
                    style={{
                      position: "absolute",
                      bottom: 10,
                      right: 10,
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "rgba(0,0,0,.55)",
                      border: "1px solid rgba(255,255,255,.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      cursor: "pointer",
                      backdropFilter: "blur(8px)",
                      transition: "background .15s",
                      zIndex: 5,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(123,76,255,.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(0,0,0,.55)";
                    }}
                  >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                )}
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
                    color: "rgba(255,255,255,.45)",
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
      stroke="rgba(123,76,255,.7)"
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
        background: "rgba(123,76,255,.08)",
        border: "1px solid rgba(123,76,255,.20)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(123,76,255,.7)",
        cursor: "pointer",
        transition: "background .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(123,76,255,.18)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(123,76,255,.08)";
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
        background: "rgba(123,76,255,.08)",
        border: "1px solid rgba(123,76,255,.20)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(123,76,255,.7)",
        cursor: "pointer",
        transition: "background .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(123,76,255,.18)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(123,76,255,.08)";
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
