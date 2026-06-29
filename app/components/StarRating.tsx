"use client";

import { useState, memo } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
    value: number;
    onChange: (v: number) => void;
}

function StarRatingInner({ value, onChange }: StarRatingProps) {
    const [hover, setHover] = useState(0);

    return (
        <div className="flex items-center gap-1 w-fit transition-all duration-300">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChange(star); }}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                >
                    <Star
                        className={`w-3.5 h-3.5 transition-all duration-300 ${
                            star <= (hover || value) ? "fill-slate-300 text-slate-300 drop-shadow-[0_0_6px_rgba(203,213,225,0.4)]" : "text-white/20"
                        }`}
                    />
                </button>
            ))}
        </div>
    );
}

export const StarRating = memo(StarRatingInner);
