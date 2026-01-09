import React from "react";

export default function Background() {
  // Generate grid coordinates more efficiently
  const gridRows = 22;
  const gridCols = 35;
  const cellSize = 36;
  const startX = -20.0891;
  const startY = 9.2;

  // Predefined highlighted cells with enhanced properties
  const highlightedCells = [
    {
      x: 699.711,
      y: 81,
      opacity: 0.16,
      duration: 18,
      delay: 0,
      pulse: [0.9, 1, 0.9],
    },
    {
      x: 195.711,
      y: 153,
      opacity: 0.18,
      duration: 20,
      delay: 1,
      pulse: [0.9, 1, 0.9],
    },
    {
      x: 1023.71,
      y: 153,
      opacity: 0.18,
      duration: 19,
      delay: 2,
      pulse: [0.9, 1, 0.9],
    },
    {
      x: 123.711,
      y: 225,
      opacity: 0.18,
      duration: 21,
      delay: 3,
      pulse: [0.92, 1, 0.92],
    },
    {
      x: 1095.71,
      y: 225,
      opacity: 0.18,
      duration: 18,
      delay: 4,
      pulse: [0.92, 1, 0.92],
    },
    {
      x: 951.711,
      y: 297,
      opacity: 0.18,
      duration: 22,
      delay: 5,
      pulse: [0.92, 1, 0.92],
    },
    {
      x: 231.711,
      y: 333,
      opacity: 0.12,
      duration: 19,
      delay: 1.5,
      pulse: [0.93, 1, 0.93],
    },
    {
      x: 303.711,
      y: 405,
      opacity: 0.12,
      duration: 20,
      delay: 2.5,
      pulse: [0.93, 1, 0.93],
    },
    {
      x: 87.7109,
      y: 405,
      opacity: 0.18,
      duration: 18,
      delay: 0.8,
      pulse: [0.9, 1, 0.9],
    },
    {
      x: 519.711,
      y: 405,
      opacity: 0.16,
      duration: 22,
      delay: 1.8,
      pulse: [0.9, 1, 0.9],
    },
    {
      x: 771.711,
      y: 405,
      opacity: 0.18,
      duration: 19,
      delay: 2.8,
      pulse: [0.9, 1, 0.9],
    },
    {
      x: 591.711,
      y: 477,
      opacity: 0.12,
      duration: 21,
      delay: 3.8,
      pulse: [0.93, 1, 0.93],
    },
  ];

  return (
    <div className="absolute bg-background inset-0 z-0">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1220 810"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className="select-none"
      >
        <defs>
          {/* Enhanced gradients with better color transitions */}
          <linearGradient
            id="paint0_linear_enhanced"
            x1="35.0676"
            y1="23.6807"
            x2="903.8"
            y2="632.086"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="rgba(0,0,0,0)" stopOpacity="0" />
            <stop offset="0.3" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.3)" />
          </linearGradient>

          {/* Enhanced shimmer with more complex gradient */}
          <linearGradient id="shimmerGradient" x1="0" y1="0" x2="1" y2="0.5">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="20%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="80%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Enhanced flow stroke with smoother transitions */}
          <linearGradient id="flowStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="20%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="80%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Subtle noise pattern for texture */}
          <filter id="noiseFilter" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence baseFrequency="0.9" numOctaves="1" result="noise" />
            <feBlend in="noise" in2="SourceGraphic" mode="multiply" result="composite" />
          </filter>
        </defs>

        <g clipPath="url(#clip0_enhanced)">
          <mask
            id="mask0_enhanced"
            style={{ maskType: "alpha" }}
            maskUnits="userSpaceOnUse"
            x="10"
            y="-1"
            width="1200"
            height="812"
          >
            <rect
              x="10"
              y="-0.84668"
              width="1200"
              height="811.693"
              fill="url(#paint0_linear_enhanced)"
            />
          </mask>

          <g mask="url(#mask0_enhanced)">
            {/* Optimized Grid Generation */}
            <g opacity="0.8">
              {Array.from({ length: gridRows }, (_, row) =>
                Array.from({ length: gridCols }, (_, col) => (
                  <rect
                    key={`grid-${row}-${col}`}
                    x={startX + col * cellSize}
                    y={startY + row * cellSize}
                    width="35.6"
                    height="35.6"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="0.6"
                    strokeDasharray="2 2"
                    fill="none"
                  />
                ))
              )}
            </g>

            {/* Enhanced Flow Lines with Varied Animation */}
            <g opacity="0.08">
              {/* Horizontal flow lines with staggered animation */}
              {Array.from({ length: 10 }, (_, idx) => (
                <line
                  key={`h-flow-${idx}`}
                  x1="0"
                  y1={30 + idx * 78}
                  x2="1220"
                  y2={30 + idx * 78}
                  stroke="url(#flowStroke)"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeDasharray="3 12"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="15"
                    dur={`${8 + (idx % 4)}s`}
                    repeatCount="indefinite"
                    begin={`${idx * 0.5}s`}
                  />
                </line>
              ))}

              {/* Vertical flow lines with counter animation */}
              {Array.from({ length: 16 }, (_, idx) => (
                <line
                  key={`v-flow-${idx}`}
                  x1={20 + idx * 72}
                  y1="0"
                  x2={20 + idx * 72}
                  y2="810"
                  stroke="url(#flowStroke)"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeDasharray="3 12"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="15"
                    to="0"
                    dur={`${7 + ((idx + 1) % 4)}s`}
                    repeatCount="indefinite"
                    begin={`${idx * 0.3}s`}
                  />
                </line>
              ))}
            </g>

            {/* Enhanced Highlighted Cells */}
            <g>
              {highlightedCells.map((cell, idx) => (
                <rect
                  key={`highlight-${idx}`}
                  x={cell.x}
                  y={cell.y}
                  width="36"
                  height="36"
                  fill={`rgba(255,255,255,${cell.opacity})`}
                  rx="2"
                  className="drop-shadow-sm"
                >
                  <animate
                    attributeName="opacity"
                    values={cell.pulse.join(";")}
                    dur={`${cell.duration}s`}
                    begin={`${cell.delay}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="rx"
                    values="2;4;2"
                    dur={`${cell.duration * 2}s`}
                    begin={`${cell.delay}s`}
                    repeatCount="indefinite"
                  />
                </rect>
              ))}
            </g>

            {/* Enhanced Shimmer with Multiple Layers */}
            <g opacity="0.04">
              <rect
                x="-1220"
                y="0"
                width="600"
                height="810"
                fill="url(#shimmerGradient)"
                filter="url(#noiseFilter)"
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from="-1500 0"
                  to="1500 0"
                  dur="28s"
                  repeatCount="indefinite"
                />
              </rect>

              {/* Secondary shimmer for depth */}
              <rect
                x="-800"
                y="0"
                width="300"
                height="810"
                fill="url(#shimmerGradient)"
                opacity="0.5"
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from="-1000 0"
                  to="1300 0"
                  dur="35s"
                  repeatCount="indefinite"
                  begin="5s"
                />
              </rect>
            </g>

            {/* Subtle ambient particles */}
            <g opacity="0.03">
              {Array.from({ length: 8 }, (_, idx) => (
                <circle
                  key={`particle-${idx}`}
                  cx={150 + idx * 140}
                  cy={100 + (idx % 3) * 250}
                  r="1"
                  fill="rgba(255,255,255,0.6)"
                >
                  <animate
                    attributeName="opacity"
                    values="0;1;0"
                    dur={`${15 + idx * 2}s`}
                    repeatCount="indefinite"
                    begin={`${idx * 1.5}s`}
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values={`0,0; ${Number((Math.sin(idx) * 20).toFixed(3))},${Number((Math.cos(idx) * 30).toFixed(3))}; 0,0`}
                    dur={`${20 + idx}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
            </g>
          </g>
        </g>

        {/* Enhanced border with subtle glow */}
        <rect
          x="0.4"
          y="0.4"
          width="1219"
          height="809"
          rx="15.5"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.8"
          fill="none"
          className="drop-shadow-2xl"
        />

        {/* Clip path definition */}
        <clipPath id="clip0_enhanced">
          <rect width="1220" height="810" rx="16" fill="white" />
        </clipPath>
      </svg>
    </div>
  );
}
