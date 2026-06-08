"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useUserLists() {
    const { data, mutate: mutateData } = useSWR("/api/user/bootstrap", fetcher, { 
        fallbackData: { watchlist: [], continueWatching: [], history: [], ratings: {} } 
    });

    const fetchUserLists = async () => {
        await mutateData();
    };

    const handleRate = async (movie: any, rating: number) => {
        if (!movie || !movie.id) return;
        const prevRating = data?.ratings?.[movie.id];
        const director = movie.credits?.crew?.find((c: any) => c.job === "Director")?.name;
        const enrichedMovie = director ? { ...movie, director } : movie;
        
        mutateData((prev: any) => ({
            ...prev,
            ratings: {
                ...(prev?.ratings || {}),
                [movie.id]: { rating, movieDetails: enrichedMovie, ratedAt: Date.now() }
            }
        }), { revalidate: false });
        
        try {
            await fetch(`/api/ratings/${movie.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, movieDetails: enrichedMovie })
            });
        } catch {
            mutateData((prevState: any) => {
                const nextRatings = { ...(prevState?.ratings || {}) };
                if (prevRating) nextRatings[movie.id] = prevRating;
                else delete nextRatings[movie.id];
                return { ...prevState, ratings: nextRatings };
            }, { revalidate: false });
        }
    };

    return {
        watchlist: data?.watchlist || [],
        continueWatching: data?.continueWatching || [],
        history: data?.history || [],
        ratings: data?.ratings || {},
        fetchUserLists,
        handleRate,
    };
}