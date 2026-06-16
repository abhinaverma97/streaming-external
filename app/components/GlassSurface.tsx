"use client";

import { ReactNode } from "react";

interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
}

export default function GlassSurface({ children, className = "" }: GlassSurfaceProps) {
  return (
    <div className={`md:backdrop-blur-md bg-slate-950/90 md:bg-slate-950/40 border border-slate-800/50 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-2xl ${className}`}>
      {children}
    </div>
  );
}
