"use client";

import { useState, useCallback, useEffect, useRef } from "react";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "1070730380f5fee0d87cf0382670b255";

// Module-scoped LRU cache of search queries -> results.
// Persists across mounts within a session; cleared on full reload.
const SEARCH_CACHE_MAX = 50;
const searchCache = new Map<string, any[]>();

function searchCacheGet(q: string): any[] | undefined {
    const v = searchCache.get(q);
    if (v) {
        searchCache.delete(q);
        searchCache.set(q, v);
    }
    return v;
}

function searchCacheSet(q: string, results: any[]) {
    if (searchCache.size >= SEARCH_CACHE_MAX) {
        const oldest = searchCache.keys().next().value;
        if (oldest) searchCache.delete(oldest);
    }
    searchCache.set(q, results);
}

export function useSearch() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const doSearch = useCallback(async (query: string) => {
        const trimmed = query.trim();
        if (!trimmed) {
            setSearchResults([]);
            setIsSearching(false);
            setSearchLoading(false);
            return;
        }
        setIsSearching(true);

        // Serve cached results immediately if we've seen this exact query.
        const cacheKey = trimmed.toLowerCase();
        const cached = searchCacheGet(cacheKey);
        if (cached) {
            setSearchResults(cached);
            setSearchLoading(false);
            return;
        }

        setSearchLoading(true);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&api_key=${TMDB_KEY}`;
            const res = await fetch(url, { signal: controller.signal });

            if (!res.ok) {
                if (abortControllerRef.current === controller) {
                    setSearchLoading(false);
                }
                return;
            }

            const data = await res.json();
            
            if (abortControllerRef.current !== controller) return;
            
            const tagged = (data.results || [])
                .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
                .map((movie: any) => ({
                    ...movie,
                    media_type: movie.media_type
                }));

            searchCacheSet(cacheKey, tagged);
            setSearchResults(tagged);
        } catch (err: any) {
            if (err.name === "AbortError") return;
        } finally {
            if (abortControllerRef.current === controller) {
                setSearchLoading(false);
                // NOTE: do NOT set isSearching(false) here — that would
                // unmount the SearchResultsSection immediately after results arrive.
                // isSearching is only reset when the query is cleared.
            }
        }
    }, []);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    const searchTimerRef = useRef<any>(null);

    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            setSearchLoading(false);
            return;
        }
        searchTimerRef.current = setTimeout(() => doSearch(searchQuery), 500);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [searchQuery, doSearch]);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        doSearch(searchQuery);
    }, [searchQuery, doSearch]);

    const clearSearch = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setSearchQuery("");
        setSearchResults([]);
        setIsSearching(false);
        setSearchLoading(false);
    }, []);

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        searchLoading,
        isMobileSearchOpen,
        setIsMobileSearchOpen,
        handleSearch,
        clearSearch,
    };
}
