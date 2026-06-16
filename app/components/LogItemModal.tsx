"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, Trash2 } from "lucide-react";
import { StarRating } from "./StarRating";
import { getBackdropUrl, getPosterUrl } from "../lib/tmdb-utils";

interface LogItemModalProps {
    item: any;
    onClose: () => void;
    onRate: (movie: any, rating: number, thoughts?: string) => void;
    onDelete: (tmdbId: string) => void;
}

export function LogItemModal({ item, onClose, onRate, onDelete }: LogItemModalProps) {
    const [rating, setRating] = useState(item?.rating || 0);
    const [thoughts, setThoughts] = useState(item?.thoughts || "");

    useEffect(() => {
        setRating(item?.rating || 0);
        setThoughts(item?.thoughts || "");
    }, [item]);

    if (!item || !item.movieDetails) return null;
    const movieDetails = item.movieDetails;

    const handleSave = () => {
        if (rating > 0) {
            onRate(movieDetails, rating, thoughts);
        }
        onClose();
    };

    const handleDelete = () => {
        onDelete(movieDetails.id);
        onClose();
    };

    const bgImage = movieDetails.backdrop_path ? getBackdropUrl(movieDetails.backdrop_path) : (movieDetails.poster_path ? getPosterUrl(movieDetails.poster_path) : null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="relative w-full max-w-lg bg-[#090b14]/40 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Banner Header */}
                <div className="relative w-full h-40 md:h-56 bg-transparent shrink-0">
                    {bgImage && (
                        <Image
                            src={bgImage}
                            alt={movieDetails.title || movieDetails.name || "Banner"}
                            fill
                            className="object-cover opacity-50 mix-blend-overlay"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090b14]/80 via-transparent to-transparent" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/80 transition-colors z-10"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="absolute bottom-4 left-6 right-6">
                        <h2 className="text-xl md:text-2xl font-semibold text-white truncate drop-shadow-md">
                            {movieDetails.title || movieDetails.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-300 uppercase tracking-widest font-medium">
                            <span>{(movieDetails.release_date || movieDetails.first_air_date || "Unknown").split("-")[0]}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-600" />
                            <span>{movieDetails.media_type === "tv" || movieDetails.name ? "Series" : "Movie"}</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-6 overflow-y-auto no-scrollbar">
                    {/* Rating */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">Your Rating</span>
                        <StarRating
                            value={rating}
                            onChange={(val) => setRating(val)}
                        />
                    </div>

                    {/* Thoughts */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">Your Thoughts</span>
                        <textarea
                            value={thoughts}
                            onChange={(e) => setThoughts(e.target.value)}
                            disabled={rating === 0}
                            placeholder={rating === 0 ? "Rate the title first to add thoughts..." : "What did you think about it?"}
                            className="w-full h-32 px-4 py-3 text-sm text-white/90 bg-white/[0.02] border border-white/10 focus:border-white/20 rounded-xl resize-none outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors placeholder:text-white/20"
                        />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-white/[0.03] border-t border-white/[0.08] flex items-center justify-between shrink-0">
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Log
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-medium text-white/60 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={rating === 0}
                            className="px-5 py-2 text-xs font-semibold text-black bg-white rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
