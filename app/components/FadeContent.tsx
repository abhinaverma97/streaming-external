"use client";

import { ReactNode } from "react";
import { useReveal } from "../hooks/useReveal";

interface FadeContentProps {
  children: ReactNode;
  className?: string;
}

export default function FadeContent({ children, className = "" }: FadeContentProps) {
  const ref = useReveal("-10px");

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`reveal-item ${className}`}
    >
      {children}
    </div>
  );
}
