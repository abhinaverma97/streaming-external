"use client";

import { ReactNode } from "react";
import { useReveal } from "../hooks/useReveal";

interface FadeContentProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export default function FadeContent({
  children,
  className = "",
  delay = 0,
}: FadeContentProps) {
  const ref = useReveal("-10px");

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`reveal-item ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
