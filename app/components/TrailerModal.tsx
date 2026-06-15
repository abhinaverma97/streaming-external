"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface TrailerModalProps {
    videoKey: string;
    title: string;
    onClose: () => void;
}

export default function TrailerModal({ videoKey, title, onClose }: TrailerModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all"
                >
                    <X className="w-4 h-4" />
                </button>
                <iframe
                    src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
                    title={title}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    className="w-full h-full"
                />
            </div>
        </div>
    );
}
