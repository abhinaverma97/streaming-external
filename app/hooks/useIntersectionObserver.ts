"use client";

import { useEffect, useState, RefObject } from "react";

const DEFAULT_OPTIONS: IntersectionObserverInit = { rootMargin: "400px" };

export function useIntersectionObserver(
    ref: RefObject<Element | null>,
    initialIsVisible: boolean = false,
    options: IntersectionObserverInit = DEFAULT_OPTIONS
): boolean {
    const [isVisible, setIsVisible] = useState(initialIsVisible);

    useEffect(() => {
        if (isVisible) return; // Already visible — one-shot, never hide again
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, options);

        observer.observe(element);
        return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ref, isVisible, options.rootMargin]);

    return isVisible;
}
