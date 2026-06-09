"use client";

import { memo } from "react";
import ScrollRow from "./ScrollRow";
import { MovieCard } from "./MovieCard";
import { CardSkeleton } from "./CardSkeleton";

interface WatchlistSectionProps {
    watchlist: any[];
    watchlistFilter: "all" | "movie" | "tv";
    onFilterChange: (filter: "all" | "movie" | "tv") => void;
    onCardClick: (item: any) => void;
    isLoading?: boolean;
}

function WatchlistSectionInner({ watchlist, watchlistFilter, onFilterChange, onCardClick, isLoading }: WatchlistSectionProps) {
    const filteredWatchlist = watchlist.filter((item: any) =>
        watchlistFilter === "all" || item.mediaType === watchlistFilter
    );

    if (!isLoading && filteredWatchlist.length === 0) return null;

    return (
        <div className="snap-start snap-always scroll-mt-0 py-8">
            <div className="flex items-center gap-6 mb-5">
                <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-300">
                    Watchlist
                </h3>
                <div className="flex items-center gap-3 text-xs font-medium tracking-wider uppercase text-slate-500">
                    <button
                        onClick={() => onFilterChange('all')}
                        className={`hover:text-slate-300 transition-colors ${watchlistFilter === 'all' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                    >
                        All
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                        onClick={() => onFilterChange('movie')}
                        className={`hover:text-slate-300 transition-colors ${watchlistFilter === 'movie' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                    >
                        Movies
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                        onClick={() => onFilterChange('tv')}
                        className={`hover:text-slate-300 transition-colors ${watchlistFilter === 'tv' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                    >
                        Series
                    </button>
                </div>
            </div>
            {isLoading ? (
                <CardSkeleton layout="row" />
            ) : (
                <ScrollRow>
                    {filteredWatchlist.map((item: any) => (
                        <MovieCard
                            key={item.tmdbId}
                            item={item}
                            onClick={() => onCardClick(item)}
                        />
                    ))}
                </ScrollRow>
            )}
        </div>
    );
}

export const WatchlistSection = memo(WatchlistSectionInner);
