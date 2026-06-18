"use client";

import { useRef, useCallback, useEffect, Children } from "react";

interface ScrollRowProps {
    children: React.ReactNode;
}

export default function ScrollRow({ children }: ScrollRowProps) {
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (rowRef.current) {
            rowRef.current.scrollLeft = 0;
        }
    }, [Children.count(children)]);

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
            
            <div ref={rowRef} className="grid grid-flow-col auto-cols-[calc((100%-1rem)/2)] sm:auto-cols-[calc((100%-2rem)/3)] md:auto-cols-[calc((100%-3rem)/4)] lg:auto-cols-[calc((100%-4rem)/5)] xl:auto-cols-[calc((100%-5rem)/6)] gap-4 overflow-x-auto py-6 -my-4 no-scrollbar snap-x snap-mandatory scroll-smooth relative z-10">
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
