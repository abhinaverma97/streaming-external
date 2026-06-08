"use client";

import { memo } from "react";
import ScrollRow from "./ScrollRow";
import { MovieCard } from "./MovieCard";
import { Movie } from "../lib/types";

interface TrendingSectionProps {
    trending: Movie[];
    trendingType: "movie" | "tv";
    selectedMovieId: number | undefined;
    onTrendingTypeChange: (type: "movie" | "tv") => void;
    onCardClick: (movie: Movie) => void;
}

function TrendingSectionInner({ trending, trendingType, selectedMovieId, onTrendingTypeChange, onCardClick }: TrendingSectionProps) {
    return (
        <div className="snap-start snap-always scroll-mt-0 py-8">
            <div className="flex items-center gap-6 mb-5">
                <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-300">
                    Trending
                </h3>
                <div className="flex items-center gap-3 text-xs font-medium tracking-wider uppercase text-slate-500">
                    <button
                        onClick={() => onTrendingTypeChange('movie')}
                        className={`hover:text-slate-300 transition-colors ${trendingType === 'movie' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                    >
                        Movies
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                        onClick={() => onTrendingTypeChange('tv')}
                        className={`hover:text-slate-300 transition-colors ${trendingType === 'tv' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                    >
                        Series
                    </button>
                </div>
            </div>

            {trending.length > 0 ? (
                <ScrollRow>
                    {trending.map((movie, index) => (
                        <MovieCard
                            key={movie.id}
                            item={movie}
                            onClick={() => onCardClick(movie)}
                            isActive={selectedMovieId === movie.id}
                            priority={index < 4}
                        />
                    ))}
                </ScrollRow>
            ) : (
                <div className="flex items-center justify-center py-10 w-full">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                        <div className="text-[9px] font-medium tracking-[0.2em] uppercase text-slate-500">
                            Loading {trendingType === 'movie' ? 'Movies' : 'Series'}...
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export const TrendingSection = memo(TrendingSectionInner);
