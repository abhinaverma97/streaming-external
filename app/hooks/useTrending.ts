"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Movie } from "../lib/types";

const trendingCache = new Map<string, { data: Movie[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useTrending(initialType: "movie" | "tv" = "movie") {
    const [trending, setTrending] = useState<Movie[]>([]);
    const [trendingType, setTrendingType] = useState<"movie" | "tv">(initialType);
    const [loading, setLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchTrending = useCallback(async (type: "movie" | "tv") => {
        const cacheKey = `trending-${type}`;
        const cached = trendingCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            setTrending(cached.data);
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setLoading(true);
        setTrending([]);
        try {
            const endpoint = type === "movie" ? "movies" : "tv";
            const res = await fetch(`/api/${endpoint}/trending`, {
                signal: abortControllerRef.current.signal,
            });
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            const items = (data.results || []).map((m: any) => ({
                ...m,
                media_type: m.media_type || type,
            }));
            trendingCache.set(cacheKey, { data: items, timestamp: Date.now() });
            setTrending(items);
        } catch (e) {
            if ((e as Error).name !== "AbortError") {
                console.error("Trending fetch error:", e);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrending(trendingType);
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [trendingType, fetchTrending]);

    return { trending, trendingType, setTrendingType, loading, refetch: fetchTrending };
}