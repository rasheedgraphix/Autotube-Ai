import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

export default function AutoTubeLogo({
  size = "md",
  showText = true,
  className = "",
}: LogoProps) {
  const iconSizeMap = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const textSizeMap = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* High-Tech Vector Logo Icon */}
      <div className={`relative ${iconSizeMap[size]} flex-shrink-0 group`}>
        {/* Ambient Glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 rounded-2xl blur-sm opacity-60 group-hover:opacity-100 transition duration-500" />

        {/* Main Logo Container */}
        <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-slate-900 via-red-950 to-slate-950 p-[1.5px] shadow-2xl overflow-hidden border border-red-500/40">
          {/* Inner Geometric Shield with YouTube Play & AI Nexus */}
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <defs>
              <linearGradient id="logoGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#b91c1c" />
              </linearGradient>
              <linearGradient id="logoGradSpark" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="logoGradBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f87171" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Background hexagon / rounded squircle */}
            <rect
              x="8"
              y="8"
              width="84"
              height="84"
              rx="24"
              fill="#090d16"
              stroke="url(#logoGradBorder)"
              strokeWidth="2.5"
            />

            {/* Circuit matrix lines in background */}
            <path
              d="M15 35H30L40 22M85 65H70L60 78M20 70L32 58M80 30L68 42"
              stroke="#ef4444"
              strokeOpacity="0.25"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Glowing Center YouTube Rounded Screen */}
            <rect
              x="22"
              y="28"
              width="56"
              height="44"
              rx="12"
              fill="url(#logoGradPrimary)"
              stroke="#fca5a5"
              strokeWidth="1.5"
            />

            {/* High-speed motion / viral ring */}
            <circle
              cx="50"
              cy="50"
              r="34"
              stroke="url(#logoGradSpark)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              className="animate-spin"
              style={{ transformOrigin: "50% 50%", animationDuration: "16s" }}
            />

            {/* Precision Play Triangle */}
            <path
              d="M44 39.5L62 50L44 60.5V39.5Z"
              fill="#ffffff"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))"
            />

            {/* Top Right AI Lightning / Spark */}
            <path
              d="M68 20L63 30H72L67 40"
              stroke="#fbbf24"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 0 6px rgba(251, 191, 36, 0.9))"
            />
          </svg>
        </div>
      </div>

      {/* Brand Name Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span
              className={`${textSizeMap[size]} font-black tracking-tight text-white flex items-center`}
            >
              Auto<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-amber-400">Tube</span>
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm shadow-red-950">
                Studio
              </span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-[11px] font-medium text-slate-400 tracking-wide">
            Autonomous Shorts & YouTube Publisher
          </p>
        </div>
      )}
    </div>
  );
}
