"use client";

import { useState, useCallback } from "react";

export function useUserLists() {
    const [watchlist, setWatchlist] = useState<any[]>([]);
    const [continueWatching, setContinueWatching] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [ratings, setRatings] = useState<Record<string, any>>({});

    const fetchUserLists = useCallback(async () => {
        const res = await fetch(`/api/user-lists`);
        if (!res.ok) return;
        const data = await res.json();
        setWatchlist(data.watchlist || []);
        setContinueWatching(data.continueWatching || []);
        setHistory(data.history || []);
        setRatings(data.ratings || {});
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
