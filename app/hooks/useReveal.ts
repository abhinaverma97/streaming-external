"use client";

import { useEffect, useState, useRef } from "react";

export function useReveal(rootMargin = "0px") {
  const [isRevealed, setIsRevealed] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          // Once revealed, we don't need to observe anymore
          if (ref.current) observer.unobserve(ref.current);
        }
      },
      { rootMargin, threshold: 0.1 }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, isRevealed };
}
