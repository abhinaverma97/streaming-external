"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";

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
    const words = useMemo(() => text ? text.split(" ") : [], [text]);
    const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
    const charRectsRef = useRef<DOMRect[]>([]);
    const charElementsRef = useRef<(HTMLSpanElement | null)[]>([]);

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

    // Pre-compute character positions when layout changes
    useEffect(() => {
        if (!containerRef.current) return;
        const spans = containerRef.current.querySelectorAll("span[data-char]");
        charRectsRef.current = Array.from(spans).map(el => el.getBoundingClientRect());
    }, [text]);

    return (
        <div
            ref={containerRef}
            className={`flex flex-wrap gap-x-[0.35em] gap-y-2 items-center select-none ${className}`}
        >
            {words.map((word, wordIdx) => (
                <span key={wordIdx} className="inline-block whitespace-nowrap">
                    {word.split("").map((char, charIdx) => {
                        const globalIdx = wordIdx * 100 + charIdx;
                        const rect = charRectsRef.current[globalIdx];

                        let weight = fromWeight;
                        if (mousePos.x !== -1000 && rect) {
                            const charX = rect.left + rect.width / 2;
                            const charY = rect.top + rect.height / 2;
                            const dist = Math.hypot(mousePos.x - charX, mousePos.y - charY);
                            if (dist < radius) {
                                const factor = 1 - dist / radius;
                                weight = fromWeight + (toWeight - fromWeight) * factor;
                            }
                        }

                        return (
                            <span
                                key={charIdx}
                                ref={(el) => {
                                    charElementsRef.current[globalIdx] = el;
                                }}
                                data-char="true"
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
            ))}
        </div>
    );
}
