"use client";

import { useEffect, useRef } from "react";

/**
 * Attaches IntersectionObserver to a ref.
 * Adds/removes the `is-visible` CSS class on the element
 * so CSS handles all animation (no inline style thrashing).
 * One-shot: once visible, stops observing.
 */
export function useReveal(rootMargin = "-20px") {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Already visible from a previous mount (e.g. HMR)
    if (el.classList.contains("is-visible")) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      },
      { rootMargin, threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return ref;
}
