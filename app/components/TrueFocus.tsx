"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface TrueFocusProps {
  text: string;
  blurAmount?: number;
  animationDuration?: number;
  pauseDuration?: number;
}

export default function TrueFocus({
  text,
  blurAmount = 4,
  animationDuration = 0.5,
  pauseDuration = 1.8,
}: TrueFocusProps) {
  const words = text ? text.split(" ") : [];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (words.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % words.length);
    }, (animationDuration + pauseDuration) * 1000);
    return () => clearInterval(interval);
  }, [words.length, animationDuration, pauseDuration]);

  if (words.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-[0.35em] gap-y-2 items-center text-4xl md:text-5xl font-bold tracking-tight select-none">
      {words.map((word, index) => {
        const isActive = index === activeIndex;
        return (
          <span
            key={index}
            className="relative inline-block transition-all"
            style={{
              filter: isActive ? "none" : `blur(${blurAmount}px)`,
              opacity: isActive ? 1 : 0.35,
              transitionDuration: `${animationDuration}s`,
            }}
          >
            {word}
            {isActive && (
              <motion.span
                layoutId="focusBrackets"
                className="absolute -inset-x-2 -inset-y-1 block pointer-events-none"
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
              >
                {/* Custom Corner Brackets */}
                <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white"></span>
                <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white"></span>
                <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white"></span>
                <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white"></span>
              </motion.span>
            )}
          </span>
        );
      })}
    </div>
  );
}
