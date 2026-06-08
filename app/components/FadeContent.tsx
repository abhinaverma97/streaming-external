"use client";

import { ReactNode } from "react";
import { useReveal } from "../hooks/useReveal";

interface FadeContentProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export default function FadeContent({
  children,
  delay = 0,
  duration = 0.5,
  className = "",
}: FadeContentProps) {
  const { ref, isRevealed } = useReveal("0px");

  return (
    <div
      ref={ref}
      className={`transition-all ease-out ${className} ${
        isRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDuration: `${duration}s`, transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}
