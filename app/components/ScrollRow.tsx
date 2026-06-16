"use client";

import { useRef, useCallback, useEffect } from "react";

interface ScrollRowProps {
    children: React.ReactNode;
}

export default function ScrollRow({ children }: ScrollRowProps) {
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (rowRef.current) {
            rowRef.current.scrollLeft = 0;
        }
    }, []);

    const scroll = useCallback((direction: 'left' | 'right') => {
        if (rowRef.current) {
            const { clientWidth } = rowRef.current;
            const scrollAmount = direction === 'left' ? -clientWidth * 0.7 : clientWidth * 0.7;
            rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }, []);

    return (
        <div className="relative w-full group/row">
            <button
                onClick={(e) => { e.stopPropagation(); scroll('left'); }}
                className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 z-20 cursor-pointer"
                aria-label="Scroll Left"
            />
            
            <div ref={rowRef} className="flex gap-4 overflow-x-auto py-6 -my-4 px-2 -mx-2 no-scrollbar snap-x snap-mandatory scroll-smooth relative z-10">
                {children}
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); scroll('right'); }}
                className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 z-20 cursor-pointer"
                aria-label="Scroll Right"
            />
        </div>
    );
}
