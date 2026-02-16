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

  const prev = () => setCurrent((c) => (c === 0 ? videos.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === videos.length - 1 ? 0 : c + 1));

  return (
    <div className={`relative h-full w-full flex items-center justify-center ${className}`} style={{ background: "#2c2c33" }}>

      {/* ---- left dots ---- */}
      <div className="absolute left-5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-[6px] z-10">
        {videos.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: 5,
              height: i === current ? 20 : 5,
              borderRadius: 99,
              background: i === current ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.2)",
              transition: "all .3s ease",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      {/* ---- centre column ---- */}
      <div style={{ width: "62%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>

        {/* stacked-card wrapper */}
        <div style={{ position: "relative", width: "100%", paddingBottom: "82%" }}>

          {/* card behind-2 */}
          <div style={{
            position: "absolute", left: "5%", right: "5%", top: 0, bottom: "4%",
            borderRadius: 16, background: "rgba(255,255,255,.03)",
          }} />

          {/* card behind-1 */}
          <div style={{
            position: "absolute", left: "2.5%", right: "2.5%", top: "2%", bottom: "2%",
            borderRadius: 16, background: "rgba(255,255,255,.06)",
          }} />

          {/* front card */}
          <div style={{
            position: "absolute", inset: "4% 0 0 0",
            borderRadius: 16,
            background: "rgba(255,255,255,.10)",
            padding: 8,
            overflow: "hidden",
          }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 10, overflow: "hidden", position: "relative" }}>
              {videos.map((v, i) => (
                <video
                  key={v.id}
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
                    transition: "opacity .4s ease",
                    display: "block",
                  }}
                >
                  <source src={v.url} type="video/mp4" />
                </video>
              ))}
            </div>
          </div>
        </div>

        {/* text */}
        <h3 style={{ color: "#fff", fontSize: 17, fontWeight: 600, marginTop: 20, lineHeight: 1.3 }}>
          {videos[current].title}
        </h3>
        <p style={{ color: "#9a9aa3", fontSize: 13, lineHeight: 1.55, marginTop: 4 }}>
          {videos[current].description}
        </p>
      </div>

      {/* ---- right arrows ---- */}
      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-[6px] z-10">
        <NavBtn onClick={prev}><ChevronUp size={16} /></NavBtn>
        <GridIcon />
        <NavBtn onClick={next}><ChevronDown size={16} /></NavBtn>
      </div>
    </div>
  );
}

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#8a8a94", cursor: "pointer", transition: "background .15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
    >
      {children}
    </button>
  );
}

function GridIcon() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="#8a8a94">
        <rect x="1" y="1" width="6" height="6" rx="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" />
      </svg>
    </div>
  );
}

export default VideoCarousel;
