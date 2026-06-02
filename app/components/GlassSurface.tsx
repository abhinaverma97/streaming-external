"use client";

import { ReactNode } from "react";

interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function GlassSurface({ children, className = "", onClick }: GlassSurfaceProps) {
  return (
    <div
      onClick={onClick}
      className={`backdrop-blur-md bg-slate-950/40 border border-slate-800/50 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-2xl ${
        onClick ? "cursor-pointer hover:bg-slate-900/50 transition-all duration-300" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
