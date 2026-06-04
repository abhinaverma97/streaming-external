"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export function useSearch() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    const doSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=multi`);
            const data = await res.json();
            const tagged = (data.results || []).map((movie: any) => ({
                ...movie,
                media_type: movie.media_type || "multi"
            }));
            setSearchResults(tagged);
            setTimeout(() => {
                const section = document.getElementById("search-results-section");
                if (section) {
                    section.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 100);
        } catch {
            // ignore
        }
    }, []);

    const searchTimerRef = useRef<any>(null);

    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        searchTimerRef.current = setTimeout(() => doSearch(searchQuery), 300);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [searchQuery, doSearch]);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        doSearch(searchQuery);
    }, [searchQuery, doSearch]);

    const clearSearch = useCallback(() => {
        setSearchQuery("");
        setSearchResults([]);
        setIsSearching(false);
    }, []);

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        isMobileSearchOpen,
        setIsMobileSearchOpen,
        handleSearch,
        clearSearch,
    };
}
