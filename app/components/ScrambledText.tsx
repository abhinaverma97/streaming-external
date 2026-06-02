"use client";

import { useState, useEffect } from "react";

interface ScrambledTextProps {
  text: string;
  speed?: number;
}

export default function ScrambledText({ text, speed = 35 }: ScrambledTextProps) {
  const [displayedText, setDisplayedText] = useState(text);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$*%";

  useEffect(() => {
    let active = true;
    let iteration = 0;
    const interval = setInterval(() => {
      if (!active) return;
      
      setDisplayedText(() =>
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < iteration) {
              return text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }
      iteration += 1 / 2.5;
    }, speed);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [text, speed]);

  return <span>{displayedText}</span>;
}
