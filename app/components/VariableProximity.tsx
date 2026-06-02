"use client";

import { useEffect, useRef, useState } from "react";

interface VariableProximityProps {
  text: string;
  fromWeight?: number;
  toWeight?: number;
  radius?: number;
  className?: string;
}

export default function VariableProximity({
  text,
  fromWeight = 300,
  toWeight = 800,
  radius = 160,
  className = "text-4xl md:text-5xl font-black tracking-tight text-white",
}: VariableProximityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const words = text ? text.split(" ") : [];
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseLeave = () => {
      setMousePos({ x: -1000, y: -1000 });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex flex-wrap gap-x-[0.35em] gap-y-2 items-center select-none ${className}`}
    >
      {words.map((word, wordIdx) => {
        return (
          <span key={wordIdx} className="inline-block whitespace-nowrap">
            {word.split("").map((char, charIdx) => {
              const globalIdx = wordIdx * 100 + charIdx;
              
              let weight = fromWeight;
              if (mousePos.x !== -1000) {
                const element = spanRefs.current[globalIdx];
                if (element) {
                  const rect = element.getBoundingClientRect();
                  const charX = rect.left + rect.width / 2;
                  const charY = rect.top + rect.height / 2;
                  const dist = Math.hypot(mousePos.x - charX, mousePos.y - charY);
                  if (dist < radius) {
                    const factor = 1 - dist / radius; // 0 to 1
                    weight = fromWeight + (toWeight - fromWeight) * factor;
                  }
                }
              }

              return (
                <span
                  key={charIdx}
                  ref={(el) => {
                    spanRefs.current[globalIdx] = el;
                  }}
                  className="inline-block transition-all duration-75 ease-out"
                  style={{
                    fontWeight: Math.round(weight),
                  }}
                >
                  {char}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}
