"use client";

import Image from "next/image";
import { memo, useRef } from "react";
import { Play, Film, Plus, Check } from "lucide-react";
import { getCardBackdropUrl } from "../lib/tmdb-utils";
import { useIntersectionObserver } from "../hooks/useIntersectionObserver";
import { useReveal } from "../hooks/useReveal";

interface MovieCardProps {
    item: {
        id?: number;
        movieDetails?: {
            id?: number;
            title?: string;
            name?: string;
            backdrop_path?: string;
            poster_path?: string;
        };
        title?: string;
        name?: string;
        backdrop_path?: string;
        poster_path?: string;
    };
    onClick: () => void;
    isActive?: boolean;
    progressPercent?: number;
    label?: React.ReactNode;
    showPlayOverlay?: boolean;
    priority?: boolean;
    onWatchlist?: (e: React.MouseEvent) => void;
    isInWatchlist?: boolean;
}

function MovieCardInner({ item, onClick, isActive, progressPercent, label, showPlayOverlay, priority, onWatchlist, isInWatchlist }: MovieCardProps) {
    const title = item.movieDetails?.title || item.movieDetails?.name || item.title || item.name || "Unknown Title";
    const backdropPath = item.movieDetails?.backdrop_path || item.backdrop_path;
    const posterPath = item.movieDetails?.poster_path || item.poster_path;

    const imageRef = useRef<HTMLDivElement>(null);
    const isImageVisible = useIntersectionObserver(imageRef, true, { rootMargin: "400px" });
    const revealRef = useReveal("0px");

    return (
        <div
            ref={revealRef as React.RefObject<HTMLDivElement>}
            onClick={onClick}
            className={`reveal-item flex-none cursor-pointer group snap-start w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]`}
        >
            <div
                ref={imageRef}
                className={`relative aspect-[16/9] rounded-xl overflow-hidden mb-2 border transition-all duration-300 shadow-md bg-slate-950 ${
                    isActive
                        ? "border-white shadow-[0_0_16px_rgba(255,255,255,0.18)]"
                        : "border-slate-800/40 group-hover:border-white/40"
                }`}
            >
                {isImageVisible ? (
                    <>
                        {backdropPath || posterPath ? (
                            <Image
                                src={getCardBackdropUrl(backdropPath || posterPath || "")}
                                alt={title}
                                fill
                                priority={priority}
                                loading={priority ? undefined : "lazy"}
                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
                                className={`object-cover transition-all duration-300 ${
                                    showPlayOverlay ? "md:brightness-90 md:group-hover:brightness-100" : "group-hover:scale-105"
                                }`}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-600 bg-slate-950">
                                <Film className="w-6 h-6" />
                            </div>
                        )}

                        {showPlayOverlay && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black">
                                    <Play className="w-3.5 h-3.5 fill-black pl-0.5" />
                                </div>
                            </div>
                        )}

                        {onWatchlist && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onWatchlist(e); }}
                                className="absolute top-2 right-2 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            >
                                {isInWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                        )}

                        {progressPercent !== undefined && (
                            <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-850">
                                <div className="h-full bg-white" style={{ width: `${progressPercent}%` }} />
                            </div>
                        )}
                    </>
                ) : null}
            </div>
            <div className="mt-1.5 text-sm font-light tracking-wide truncate group-hover:text-white transition-colors">
                {title}
                {label && (
                    <span className="text-[9px] text-slate-500 tracking-wider ml-2">{label}</span>
                )}
            </div>
            {progressPercent !== undefined && (
                <div className="text-[9px] text-slate-500 font-medium hidden md:block">
                    {Math.min(100, Math.round(progressPercent))}% completed
                </div>
            )}
        </div>
    );
}

export const MovieCard = memo(MovieCardInner);
