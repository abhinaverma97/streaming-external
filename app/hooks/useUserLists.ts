"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getWatchlistId } from "../lib/watchlist";

export function useUserLists(initialData?: {
    watchlist?: any[];
    continueWatching?: any[];
    ratings?: Record<string, any>;
}) {
    const [watchlist, setWatchlist] = useState<any[]>(initialData?.watchlist || []);
    const [continueWatching, setContinueWatching] = useState<any[]>(initialData?.continueWatching || []);
    const [ratings, setRatings] = useState<Record<string, any>>(initialData?.ratings || {});
    const ratingsRef = useRef(ratings);
    useEffect(() => { ratingsRef.current = ratings; }, [ratings]);
    const watchlistRef = useRef(watchlist);
    useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);

    const handleRate = useCallback(async (movie: any, rating: number, thoughts?: string) => {
        if (!movie || !movie.id) return;
        const prevRating = ratingsRef.current[movie.id];
        const director = movie.credits?.crew?.find((c: any) => c.job === "Director")?.name;
        const enrichedMovie = director ? { ...movie, director } : movie;

        setRatings(prev => ({
            ...prev,
            [movie.id]: { rating, movieDetails: enrichedMovie, ratedAt: Date.now(), thoughts: thoughts || "" }
        }));
        try {
            await fetch(`/api/ratings/${movie.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, movieDetails: enrichedMovie, thoughts: thoughts || "" })
            });
        } catch (err) {
            console.error(`[useUserLists] Failed to save rating: ${err}`);
            setRatings(prevState => {
                const next = { ...prevState };
                if (prevRating) next[movie.id] = prevRating;
                else delete next[movie.id];
                return next;
            });
        }
    }, []);

    const handleDeleteRating = useCallback(async (movieId: string | number) => {
        if (!movieId) return;
        const prevRating = ratingsRef.current[movieId];
        setRatings(prev => {
            const next = { ...prev };
            delete next[movieId];
            return next;
        });
        try {
            await fetch(`/api/ratings/${movieId}`, { method: "DELETE" });
        } catch (err) {
            console.error(`[useUserLists] Failed to delete rating: ${err}`);
            setRatings(prevState => {
                const next = { ...prevState };
                if (prevRating) next[movieId] = prevRating;
                return next;
            });
        }
    }, []);

    const handleToggleWatchlist = useCallback(async (movie: any) => {
        if (!movie || !movie.id) return;
        const wlId = getWatchlistId(movie);
        if (!wlId) return;

        const currentWatchlist = watchlistRef.current;
        const isQueued = currentWatchlist.some((item: any) => item.tmdbId === wlId);

        const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
        const details = {
            id: movie.id,
            title: movie.title || movie.name,
            poster_path: movie.poster_path,
            backdrop_path: movie.backdrop_path,
            vote_average: movie.vote_average,
            release_date: movie.release_date || movie.first_air_date,
            media_type: mediaType
        };

        const optimisticItem = {
            tmdbId: wlId,
            mediaType: mediaType,
            movieDetails: details,
            addedAt: Date.now()
        };

        setWatchlist(prev =>
            isQueued
                ? prev.filter((item: any) => item.tmdbId !== wlId)
                : [optimisticItem, ...prev]
        );

        try {
            if (isQueued) {
                await fetch(`/api/watchlist/${wlId}`, { method: "DELETE" });
            } else {
                await fetch(`/api/watchlist`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tmdbId: wlId, mediaType, movieDetails: details })
                });
            }
        } catch (err) {
            console.error(`[useUserLists] Failed to toggle watchlist: ${err}`);
            setWatchlist(currentWatchlist);
        }
    }, []);

    const refreshContinueWatching = useCallback(async () => {
        try {
            const res = await fetch(`/api/continue-watching`);
            if (res.ok) {
                const data = await res.json();
                setContinueWatching(data);
            }
        } catch (err) {
            console.error(`[useUserLists] Failed to refresh continue watching: ${err}`);
        }
    }, []);

    const refreshWatchlist = useCallback(async () => {
        try {
            const res = await fetch(`/api/watchlist`);
            if (res.ok) {
                const data = await res.json();
                setWatchlist(data);
            }
        } catch (err) {
            console.error(`[useUserLists] Failed to refresh watchlist: ${err}`);
        }
    }, []);

    return {
        watchlist,
        continueWatching,
        ratings,
        handleRate,
        handleDeleteRating,
        handleToggleWatchlist,
        refreshContinueWatching,
        refreshWatchlist,
    };
}
