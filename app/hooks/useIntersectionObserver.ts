"use client";

import { useEffect, useState, RefObject } from "react";

export function useIntersectionObserver(
    ref: RefObject<Element | null>,
    initialIsVisible: boolean = false,
    options: IntersectionObserverInit = { rootMargin: "400px" }
): boolean {
    const [isIntersecting, setIsIntersecting] = useState(initialIsVisible);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(([entry]) => {
            setIsIntersecting(entry.isIntersecting);
        }, options);

        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, options.rootMargin]);

    return isIntersecting;
}
