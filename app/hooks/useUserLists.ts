"use client";

import { useState, useCallback } from "react";

export function useUserLists() {
    const [watchlist, setWatchlist] = useState<any[]>([]);
    const [continueWatching, setContinueWatching] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [ratings, setRatings] = useState<Record<string, any>>({});

    const fetchUserLists = useCallback(async () => {
        const results = await Promise.allSettled([
            fetch(`/api/watchlist`),
            fetch(`/api/continue-watching`),
            fetch(`/api/history`),
            fetch(`/api/ratings`)
        ]);
        const [watchRes, contRes, histRes, ratingsRes] = results;
        if (watchRes.status === "fulfilled") {
            try { setWatchlist(await watchRes.value.json()); } catch {}
        }
        if (contRes.status === "fulfilled") {
            try { setContinueWatching(await contRes.value.json()); } catch {}
        }
        if (histRes.status === "fulfilled") {
            try { setHistory(await histRes.value.json()); } catch {}
        }
        if (ratingsRes.status === "fulfilled") {
            try { setRatings(await ratingsRes.value.json()); } catch {}
        }
    }, []);

    const handleRate = useCallback(async (movie: any, rating: number) => {
        if (!movie || !movie.id) return;
        const prevRating = ratings[movie.id];
        setRatings(prev => ({
            ...prev,
            [movie.id]: { rating, movieDetails: movie, ratedAt: Date.now() }
        }));
        try {
            await fetch(`/api/ratings/${movie.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, movieDetails: movie })
            });
        } catch {
            setRatings(prevState => {
                const next = { ...prevState };
                if (prevRating) next[movie.id] = prevRating;
                else delete next[movie.id];
                return next;
            });
        }
    }, [ratings]);

    return {
        watchlist,
        continueWatching,
        history,
        ratings,
        fetchUserLists,
        handleRate,
    };
}
