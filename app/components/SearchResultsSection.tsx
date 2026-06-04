"use client";

import { memo } from "react";
import ScrollRow from "./ScrollRow";
import { MovieCard } from "./MovieCard";
import { Movie } from "../lib/types";

interface SearchResultsSectionProps {
    isSearching: boolean;
    searchLoading: boolean;
    searchQuery: string;
    searchResults: Movie[];
    onCardClick: (movie: Movie) => void;
}

function SearchResultsSectionInner({ isSearching, searchLoading, searchQuery, searchResults, onCardClick }: SearchResultsSectionProps) {
    if (!isSearching || !searchQuery) return null;

    return (
        <div id="search-results-section" className="mb-10 snap-start snap-always scroll-mt-0 pt-4">
            <h2 className="text-[10px] font-semibold mb-5 tracking-[0.28em] uppercase text-slate-300">
                Search Results
            </h2>
            {searchLoading ? (
                <div className="flex items-center justify-center py-12 w-full">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                </div>
            ) : searchResults.length > 0 ? (
                <ScrollRow>
                    {searchResults.map((movie, index) => (
                        <MovieCard
                            key={movie.id}
                            item={movie}
                            onClick={() => onCardClick(movie)}
                            priority={index < 4}
                        />
                    ))}
                </ScrollRow>
            ) : (
                <div className="flex items-center justify-center py-12 w-full">
                    <p className="text-sm text-slate-500 font-light tracking-wide">
                        No results found for &ldquo;{searchQuery}&rdquo;
                    </p>
                </div>
            )}
        </div>
    );
}

export const SearchResultsSection = memo(SearchResultsSectionInner);
