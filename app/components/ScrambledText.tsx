"use client";

import { useState, useEffect, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$*%";
const CHARS_LEN = CHARS.length;

interface ScrambledTextProps {
    text: string;
    speed?: number;
}

export default function ScrambledText({ text, speed = 35 }: ScrambledTextProps) {
    const [displayedText, setDisplayedText] = useState(text);
    const iterationRef = useRef(0);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (!text) {
            setDisplayedText("");
            return;
        }

        iterationRef.current = 0;
        setDisplayedText(text);

        intervalRef.current = window.setInterval(() => {
            if (iterationRef.current >= text.length) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                return;
            }

            setDisplayedText(prev => {
                const newChars = text.split("").map((targetChar, index) => {
                    if (targetChar === " ") return " ";
                    if (index < iterationRef.current) return targetChar;
                    return CHARS[Math.floor(Math.random() * CHARS_LEN)];
                });
                return newChars.join("");
            });

            iterationRef.current += 1 / 2.5;
        }, speed);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [text, speed]);

    return <span>{displayedText}</span>;
}