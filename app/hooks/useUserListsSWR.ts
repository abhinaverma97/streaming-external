"use client";

import useSWR from "swr";
import { mutate } from "swr";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useUserLists() {
    const { data: watchlist, mutate: mutateWatchlist } = useSWR("/api/watchlist", fetcher, { fallbackData: [] });
    const { data: continueWatching, mutate: mutateContinueWatching } = useSWR("/api/continue-watching", fetcher, { fallbackData: [] });
    const { data: history, mutate: mutateHistory } = useSWR("/api/history", fetcher, { fallbackData: [] });
    const { data: ratings, mutate: mutateRatings } = useSWR("/api/ratings", fetcher, { fallbackData: {} });

    const fetchUserLists = async () => {
        await Promise.all([
            mutate("/api/watchlist"),
            mutate("/api/continue-watching"),
            mutate("/api/history"),
            mutate("/api/ratings"),
        ]);
    };

    const handleRate = async (movie: any, rating: number) => {
        if (!movie || !movie.id) return;
        const prevRating = ratings?.[movie.id];
        const director = movie.credits?.crew?.find((c: any) => c.job === "Director")?.name;
        const enrichedMovie = director ? { ...movie, director } : movie;
        mutateRatings((prev: Record<string, any>) => ({
            ...prev,
            [movie.id]: { rating, movieDetails: enrichedMovie, ratedAt: Date.now() }
        }), { revalidate: false });
        try {
            await fetch(`/api/ratings/${movie.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, movieDetails: enrichedMovie })
            });
        } catch {
            mutateRatings((prevState: Record<string, any>) => {
                const next = { ...prevState };
                if (prevRating) next[movie.id] = prevRating;
                else delete next[movie.id];
                return next;
            }, { revalidate: false });
        }
    };

    return {
        watchlist: watchlist || [],
        continueWatching: continueWatching || [],
        history: history || [],
        ratings: ratings || {},
        fetchUserLists,
        handleRate,
    };
}