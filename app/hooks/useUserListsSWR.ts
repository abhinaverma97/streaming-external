"use client";

import useSWR from "swr";
import { getWatchlistId } from "../lib/watchlist";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useUserLists() {
    const { data, mutate: mutateData, isLoading } = useSWR("/api/user/bootstrap", fetcher, { 
        fallbackData: { watchlist: [], continueWatching: [], history: [], ratings: {} } 
    });

    const fetchUserLists = async () => {
        await mutateData();
    };

    const handleRate = async (movie: any, rating: number, thoughts?: string) => {
        if (!movie || !movie.id) return;
        const prevRating = data?.ratings?.[movie.id];
        const director = movie.credits?.crew?.find((c: any) => c.job === "Director")?.name;
        const enrichedMovie = director ? { ...movie, director } : movie;
        
        mutateData((prev: any) => ({
            ...prev,
            ratings: {
                ...(prev?.ratings || {}),
                [movie.id]: { rating, movieDetails: enrichedMovie, ratedAt: Date.now(), thoughts: thoughts || "" }
            }
        }), { revalidate: false });
        
        try {
            await fetch(`/api/ratings/${movie.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, movieDetails: enrichedMovie, thoughts: thoughts || "" })
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

    const handleDeleteRating = async (movieId: string | number) => {
        if (!movieId) return;
        const prevRating = data?.ratings?.[movieId];
        
        mutateData((prev: any) => {
            const nextRatings = { ...(prev?.ratings || {}) };
            delete nextRatings[movieId];
            return { ...prev, ratings: nextRatings };
        }, { revalidate: false });
        
        try {
            await fetch(`/api/ratings/${movieId}`, { method: "DELETE" });
        } catch {
            mutateData((prevState: any) => {
                const nextRatings = { ...(prevState?.ratings || {}) };
                if (prevRating) nextRatings[movieId] = prevRating;
                return { ...prevState, ratings: nextRatings };
            }, { revalidate: false });
        }
    };

    const handleToggleWatchlist = async (movie: any) => {
        if (!movie || !movie.id) return;
        const wlId = getWatchlistId(movie);
        if (!wlId) return;

        const currentWatchlist = data?.watchlist || [];
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

        mutateData((prev: any) => {
            const nextWatchlist = isQueued 
                ? (prev?.watchlist || []).filter((item: any) => item.tmdbId !== wlId)
                : [optimisticItem, ...(prev?.watchlist || [])];
            return { ...prev, watchlist: nextWatchlist };
        }, { revalidate: false });

        try {
            if (isQueued) {
                await fetch(`/api/watchlist/${wlId}`, { method: "DELETE" });
            } else {
                await fetch(`/api/watchlist`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tmdbId: wlId,
                        mediaType: mediaType,
                        movieDetails: details
                    })
                });
            }
        } catch {
            mutateData((prev: any) => {
                return { ...prev, watchlist: currentWatchlist };
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
        handleDeleteRating,
        handleToggleWatchlist,
        isLoading,
    };
}