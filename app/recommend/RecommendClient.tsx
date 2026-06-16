"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { FadeImage } from "../components/FadeImage";
import { Film, Plus, Check, Play, RotateCw, RefreshCw, X } from "lucide-react";
import { Navbar } from "../components/Navbar";
import SettingsOverlay from "../components/SettingsOverlay";
import { PlayerModal } from "../components/PlayerModal";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { buildEmbedUrl } from "../lib/sources-config";
import { getBackdropUrl } from "../lib/tmdb-utils";
import { getWatchlistId } from "../lib/watchlist";
import { useSourcePrefs } from "../hooks/useSourcePrefs";
import { useUserLists } from "../hooks/useUserLists";
import { usePlayerProgress, flushGlobalProgress } from "../hooks/usePlayerProgress";
import { useSearch } from "../hooks/useSearch";
import { SearchInput } from "../components/SearchInput";
import { useRouter } from "next/navigation";
import { CardSkeleton } from "../components/CardSkeleton";

interface RecommendClientProps {
    watchlist: any[];
    ratings: Record<string, any>;
    defaultSource: string;
    enabledSources: string[];
}

export default function RecommendClient({ watchlist: wl, ratings: rt, defaultSource, enabledSources }: RecommendClientProps) {
    const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [activeStream, setActiveStream] = useState<{
        tmdbId: string; title: string; details: any; embedUrl: string;
    } | null>(null);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [selectedShowDetails, setSelectedShowDetails] = useState<any | null>(null);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);
    const [episodesList, setEpisodesList] = useState<number[]>([]);

    const {
        searchQuery, setSearchQuery,
        searchResults, isSearching,
        searchLoading,
        isMobileSearchOpen, setIsMobileSearchOpen,
        handleSearch
    } = useSearch();

    const router = useRouter();
    const handleDesktopSearch = (e: any) => {
        e.preventDefault();
        if (searchQuery) {
            sessionStorage.setItem("pendingSearch", searchQuery);
            router.push("/");
        }
    };

    const lastProgressRef = useRef(0);
    const activeStreamRef = useRef(activeStream);
    useEffect(() => { activeStreamRef.current = activeStream; }, [activeStream]);

    const {
        effectiveEnabledSources, effectiveSource,
        onSourcesChange,
    } = useSourcePrefs(defaultSource, enabledSources);

    // Tracks which source is active in the current player session only.
    const [playerSource, setPlayerSource] = useState<string | null>(null);

    const currentActiveSource = playerSource || effectiveSource;
    const activeSourceRef = useRef(currentActiveSource);
    useEffect(() => { activeSourceRef.current = currentActiveSource; }, [currentActiveSource]);

    const {
        watchlist, ratings,
        handleRate, handleToggleWatchlist,
        refreshContinueWatching,
    } = useUserLists({ watchlist: wl, ratings: rt });

    usePlayerProgress(activeStreamRef, activeSourceRef, lastProgressRef, refreshContinueWatching);

    const [recommendations, setRecommendations] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchRecs = useCallback(async () => {
        try {
            const res = await fetch("/api/recommend");
            const data = await res.json();
            setRecommendations(data);
        } catch (err) {
            console.error(`[RecommendClient] Failed to fetch recommendations: ${err}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRecs(); }, [fetchRecs]);

    useEffect(() => {
        if (!recommendations?.isGenerating) return;
        const id = setInterval(fetchRecs, 10000);
        return () => clearInterval(id);
    }, [recommendations?.isGenerating, fetchRecs]);

    const isRefreshingOrGenerating = refreshing || !!recommendations?.isGenerating;
    const displayError = recommendations?.error || error;

    const handleRefresh = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const res = await fetch("/api/recommend", { method: "POST" });
            if (res.ok) {
                setRecommendations((prev: any) => ({ ...prev, isGenerating: true }));
                fetchRecs();
            } else {
                const data = await res.json();
                setError(data.error || "Failed to trigger generation");
            }
        } catch (err: any) {
            setError(err.message || "Failed to trigger generation");
        } finally {
            setRefreshing(false);
        }
    };

    const cancelGeneration = async () => {
        try {
            await fetch("/api/recommend/cancel", { method: "POST" });
            setRecommendations((prev: any) => ({ ...prev, isGenerating: false }));
            fetchRecs();
        } catch (err) {
            console.error(`[RecommendClient] Failed to cancel generation: ${err}`);
        }
    };

    const items = (() => {
        if (!recommendations) return [];
        const movies = (recommendations.recommendedMovies || []).map((m: any) => ({ ...m, _type: "movie" }));
        const tvShows = (recommendations.recommendedTvShows || []).map((t: any) => ({ ...t, _type: "tv" }));
        return [...movies, ...tvShows];
    })();

    const filteredItems = items.filter((item: any) => {
        if (filter === "all") return true;
        return item._type === filter;
    });

    const isInWatchlist = (item: any) => {
        if (!item.id) return false;
        const wlId = getWatchlistId(item);
        return (watchlist as any[]).some((w) => w.tmdbId === wlId);
    };

    const playRecommendation = async (item: any) => {
        if (!item.id) {
            setError("Media not found in database.");
            return;
        }
        
        const isTv = item.media_type === "tv" || item._type === "tv";
        const tmdbId = isTv ? `tv-${item.id}-1-1` : String(item.id);
        const title = item.title || item.name || "Untitled";
        const resolvedTitle = isTv ? `${title} S01E01` : title;
        if (isTv) {
            try {
                const res = await fetch(`/api/tv/${item.id}`);
                const data = await res.json();
                const tmdbData = data.tmdb || data;
                setSelectedShowDetails(tmdbData);
                const seasonObj = tmdbData.seasons?.find((s: any) => s.season_number === 1);
                const epCount = seasonObj?.episode_count || 1;
                setSelectedSeason(1); setSelectedEpisode(1);
                setEpisodesList(Array.from({ length: epCount }, (_, i) => i + 1));
            } catch (err) { console.error(`[RecommendClient] Failed to load TV details for playback: ${err}`); setSelectedShowDetails(null); setEpisodesList([]); }
        } else {
            setSelectedShowDetails(null); setEpisodesList([]); setSelectedSeason(1); setSelectedEpisode(1);
        }
        setPlayerError(null);
        const embedUrl = buildEmbedUrl(effectiveSource, item.id, isTv ? "tv" : "movie", isTv ? 1 : undefined, isTv ? 1 : undefined, 0);
        setPlayerSource(effectiveSource);
        setActiveStream({ tmdbId, title: resolvedTitle, details: item, embedUrl });
    };

    const handleSourceChange = (newSource: string) => {
        // Only update the active player session — do NOT mutate the user's default.
        setPlayerSource(newSource);
        if (!activeStream) return;
        const isTv = activeStream.details?.media_type === "tv" || activeStream.details?.mediaType === "tv";
        const startAt = lastProgressRef.current > 0 ? Math.floor(lastProgressRef.current) : undefined;
        const newUrl = buildEmbedUrl(newSource, activeStream.details?.id, isTv ? "tv" : "movie", isTv ? selectedSeason : undefined, isTv ? selectedEpisode : undefined, startAt);
        setActiveStream({ ...activeStream, embedUrl: newUrl });
    };

    const closePlayer = () => {
        flushGlobalProgress();
        setActiveStream(null);
        setPlayerError(null);
        setPlayerSource(null); // Reset ephemeral source
        refreshContinueWatching();
    };

    const changeEpisode = (season: number, episode: number) => {
        if (!activeStream) return;
        setSelectedSeason(season); setSelectedEpisode(episode);
        setActiveStream({ ...activeStream, embedUrl: buildEmbedUrl(playerSource || effectiveSource, activeStream.details.id, "tv", season, episode, 0) });
    };

    const generatedAt = recommendations?.generatedAt;
    const formattedDate = generatedAt ? new Date(generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
    const movieCount = (recommendations?.recommendedMovies || []).length;
    const tvCount = (recommendations?.recommendedTvShows || []).length;
    const totalCount = movieCount + tvCount;

    return (
        <main className="min-h-screen bg-black text-slate-100 font-sans selection:bg-white/20 pb-20 relative overflow-hidden">
            <div className="w-full flex-shrink-0 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pt-4 md:pt-3">
                <Navbar onSettingsClick={() => setShowSettings(true)} currentPath="/recommend">
                    <SearchInput
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        handleSearch={handleDesktopSearch}
                    />
                </Navbar>
            </div>

            <div className="hero-transition w-full flex-1 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pb-12">

                <div className="flex items-center justify-center gap-4 md:gap-6 mt-8 md:mt-16 mb-4 text-[10px] font-medium tracking-[0.2em] text-slate-500 uppercase">
                    <span>{totalCount} <span className="text-slate-600">recommended</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>{movieCount} <span className="text-slate-600">movies</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>{tvCount} <span className="text-slate-600">series</span></span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-8 md:mb-12 text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-300">
                    <button onClick={() => setFilter("all")}
                        className={`transition-colors duration-200 cursor-pointer ${filter === "all" ? "text-white" : "text-slate-500 hover:text-white"}`}>All</button>
                    <span className="text-white/20 font-light">|</span>
                    <button onClick={() => setFilter("movie")}
                        className={`transition-colors duration-200 cursor-pointer ${filter === "movie" ? "text-white" : "text-slate-500 hover:text-white"}`}>Movies</button>
                    <span className="text-white/20 font-light">|</span>
                    <button onClick={() => setFilter("tv")}
                        className={`transition-colors duration-200 cursor-pointer ${filter === "tv" ? "text-white" : "text-slate-500 hover:text-white"}`}>Series</button>
                    <span className="text-white/20 font-light">|</span>
                    <button onClick={handleRefresh} disabled={isRefreshingOrGenerating}
                        className={`transition-colors duration-200 flex items-center gap-1.5 ${isRefreshingOrGenerating ? "text-slate-500" : "text-slate-500 hover:text-white cursor-pointer"}`}>
                        <RotateCw className={`w-3 h-3 ${isRefreshingOrGenerating ? "animate-spin" : ""}`} />
                        {isRefreshingOrGenerating ? "Generating..." : "Refresh"}
                    </button>
                    {isRefreshingOrGenerating && (
                        <button onClick={cancelGeneration}
                            className="transition-colors duration-200 flex items-center justify-center p-1 rounded-full text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            title="Cancel Generation">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {formattedDate && (
                    <div className="text-center mb-6 text-[10px] text-slate-600 tracking-wide">Last updated {formattedDate}</div>
                )}

                {displayError && (recommendations && totalCount > 0) && (
                    <div className="text-xs text-rose-400 mb-6 max-w-md mx-auto bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3 text-center">{displayError}</div>
                )}

                {loading ? (
                    <CardSkeleton layout="grid" count={12} />
                ) : (!recommendations || totalCount === 0) && displayError ? (
                    <div className="text-center py-32 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.15)]">
                            <X className="w-6 h-6 text-rose-500" />
                        </div>
                        <div className="text-[11px] text-rose-400/80 uppercase tracking-widest font-light max-w-md mx-auto px-4 leading-relaxed mt-2">{displayError}</div>
                        {displayError.toLowerCase().includes("api key") ? (
                            <button onClick={() => setShowSettings(true)}
                                className="mt-2 flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all active:scale-95 cursor-pointer">
                                Configure Settings
                            </button>
                        ) : (
                            <button onClick={handleRefresh} disabled={isRefreshingOrGenerating}
                                className="mt-2 flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all active:scale-95 cursor-pointer disabled:opacity-50">
                                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingOrGenerating ? "animate-spin" : ""}`} /> Try Again
                            </button>
                        )}
                    </div>
                ) : !recommendations || totalCount === 0 ? (
                    <div className="text-center py-32 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                            <Film className="w-6 h-6 text-white/20" />
                        </div>
                        <div className="text-[11px] text-white/40 uppercase tracking-widest font-light">No recommendations yet. Rate some movies and TV shows to get started.</div>
                        <button onClick={handleRefresh}
                            className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all active:scale-95 cursor-pointer">
                            <RefreshCw className="w-3.5 h-3.5" /> Generate Now
                        </button>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-32">
                        <div className="text-[11px] text-white/40 uppercase tracking-widest font-light">No {filter === "movie" ? "movies" : "series"} in recommendations.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6 md:gap-x-5 md:gap-y-10">
                        {filteredItems.map((item: any) => {
                            const key = item.id || item.title;
                            const inWatchlist = isInWatchlist(item);
                            const backdropPath = item.backdrop_path || item.poster_path;
                            const title = item.title || item.name || "Untitled";
                            const year = (item.release_date || item.first_air_date || "").split("-")[0];

                            return (
                                <div key={key} className="group flex flex-col cursor-pointer">
                                    <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800/40 shadow-md group-hover:border-white/40 transition-all duration-300"
                                        onClick={() => playRecommendation(item)}>
                                        {backdropPath ? (
                                            <FadeImage src={getBackdropUrl(backdropPath)} alt={title} fill
                                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 15vw"
                                                className="object-cover brightness-90 group-hover:brightness-100" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                                                <Film className="w-6 h-6 text-slate-600" />
                                            </div>
                                        )}

                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black shadow-lg">
                                                <Play className="w-4 h-4 fill-black pl-0.5" />
                                            </div>
                                        </div>

                                        <button onClick={(e) => { e.stopPropagation(); handleToggleWatchlist(item); }}
                                            className="hidden md:flex absolute top-2.5 right-2.5 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-white/20 items-center justify-center text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                                            {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>

                                    <div className="mt-4 px-1 flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors duration-300">
                                                {title}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-500 uppercase tracking-[0.2em] font-medium">
                                                <span>{year || "N/A"}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                <span>{item.media_type === "tv" ? "Series" : "Movie"}</span>
                                            </div>
                                        </div>
                                        <div className="md:hidden flex items-center gap-1.5 shrink-0">
                                            <button onClick={(e) => { e.stopPropagation(); handleToggleWatchlist(item); }}
                                                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/80 active:scale-95 transition-transform">
                                                {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <PlayerModal activeStream={activeStream} playerError={playerError}
                effectiveSource={playerSource || effectiveSource} effectiveEnabledSources={effectiveEnabledSources}
                selectedShowDetails={selectedShowDetails} selectedSeason={selectedSeason} selectedEpisode={selectedEpisode}
                episodesList={episodesList} ratings={ratings} onClose={closePlayer} onSourceChange={handleSourceChange}
                onRate={handleRate} onChangeEpisode={changeEpisode} />

            <MobileBottomNav
                activeStream={activeStream}
                isMobileSearchOpen={isMobileSearchOpen}
                setIsMobileSearchOpen={setIsMobileSearchOpen}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearch={handleSearch}
                searchResults={searchResults}
                isSearching={isSearching}
                searchLoading={searchLoading}
                setShowSettings={setShowSettings}
                currentPath="/recommend"
                onCardClick={(movie: any) => {
                    sessionStorage.setItem("pendingStream", JSON.stringify(movie));
                    window.location.href = "/";
                }}
            />

            <SettingsOverlay isOpen={showSettings} onClose={() => setShowSettings(false)} onSourcesChange={onSourcesChange} />
        </main>
    );
}
