"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export function useSearch() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const doSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            setSearchLoading(false);
            return;
        }
        setIsSearching(true);
        setSearchLoading(true);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            let res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=1070730380f5fee0d87cf0382670b255&query=${encodeURIComponent(query)}&include_adult=false`, {
                signal: controller.signal
            });

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
                
            setSearchResults(tagged);
        } catch (err: any) {
            if (err.name === "AbortError") return;
        } finally {
            if (abortControllerRef.current === controller) {
                setSearchLoading(false);
            }
        }
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
