export default function GradientGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Fixed position container that centers the orb relative to viewport */}
      <div 
        className="absolute"
        style={{
          /* Position orb at a fixed point relative to the viewport center */
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -55%) rotate(-50deg)",
          /* Use clamp to keep consistent size across screens */
          width: "clamp(400px, 35vw, 600px)",
          height: "clamp(300px, 28vw, 450px)",
        }}
      >
        {/* Purple/Indigo curved line - bottom left */}
        <div
          className="absolute animate-glow-drift-1"
          style={{
            bottom: "0%",
            left: "0%",
            width: "70%",
            height: "122%",
            borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%",
            background: "radial-gradient(ellipse 70% 60% at 60% 50%, rgba(88, 80, 236, 0.85) 0%, rgba(99, 102, 241, 0.6) 30%, rgba(123, 76, 255, 0.35) 55%, transparent 80%)",
            filter: "blur(clamp(30px, 3vw, 45px))",
            transform: "rotate(-15deg)",
            willChange: "transform",
          }}
        />

        {/* Magenta/Pink curved line - top right, closer and overlapping */}
        <div
          className="absolute animate-glow-drift-2"
          style={{
            top: "-18%",
            right: "0%",
            width: "63%",
            height: "144%",
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            background: "radial-gradient(ellipse 65% 55% at 40% 50%, rgba(236, 72, 153, 0.8) 0%, rgba(219, 39, 119, 0.55) 35%, rgba(190, 24, 93, 0.3) 60%, transparent 85%)",
            filter: "blur(clamp(15px, 1.5vw, 20px))",
            willChange: "transform",
          }}
        />

        {/* Center blend area - where both colors meet */}
        <div
          className="absolute"
          style={{
            top: "30%",
            left: "25%",
            width: "47%",
            height: "49%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse at center, rgba(168, 85, 247, 0.4) 0%, rgba(139, 92, 246, 0.2) 40%, transparent 70%)",
            filter: "blur(clamp(35px, 3.5vw, 50px))",
            mixBlendMode: "screen",
          }}
        />
      </div>

      {/* CSS Keyframes for subtle movement */}
      <style>{`
        @keyframes glow-drift-1 {
          0%, 100% { transform: rotate(-15deg) translate(0, 0); }
          33% { transform: rotate(-12deg) translate(0.5vw, -0.3vw); }
          66% { transform: rotate(-18deg) translate(-0.3vw, 0.5vw); }
        }
        @keyframes glow-drift-2 {
          0%, 100% { transform: rotate(20deg) translate(0, 0); }
          33% { transform: rotate(23deg) translate(-0.4vw, 0.3vw); }
          66% { transform: rotate(17deg) translate(0.4vw, -0.4vw); }
        }
        .animate-glow-drift-1 {
          animation: glow-drift-1 18s ease-in-out infinite;
        }
        .animate-glow-drift-2 {
          animation: glow-drift-2 22s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
