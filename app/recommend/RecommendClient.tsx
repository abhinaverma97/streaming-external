"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { getDetails } from "../lib/details-cache";
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
    username?: string;
}

export default function RecommendClient({ watchlist: wl, ratings: rt, defaultSource, enabledSources, username }: RecommendClientProps) {
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
    const pendingPlayRef = useRef<AbortController | null>(null);

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
        refreshWatchlist,
    } = useUserLists({ watchlist: wl, ratings: rt });

    // See HomeClient: we intentionally don't refresh CW on every progress tick.
    usePlayerProgress(activeStreamRef, activeSourceRef, lastProgressRef);

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

    // Re-sync user lists when the tab becomes visible (bfcache / tab return).
    // SSR already delivered fresh data on the initial render.
    useEffect(() => {
        const onVis = () => {
            if (document.visibilityState === "visible") {
                refreshContinueWatching();
                refreshWatchlist();
            }
        };
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [refreshContinueWatching, refreshWatchlist]);

    useEffect(() => { fetchRecs(); }, [fetchRecs]);

    // Poll while generating: back off from 10s → 30s, stop when tab is
    // hidden, and resume when it becomes visible again.
    useEffect(() => {
        if (!recommendations?.isGenerating) return;
        let cancelled = false;
        let delay = 10000;
        const maxDelay = 30000;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const tick = () => {
            if (cancelled) return;
            if (document.visibilityState === "hidden") {
                timer = setTimeout(tick, 5000);
                return;
            }
            fetchRecs();
            delay = Math.min(delay + 5000, maxDelay);
            timer = setTimeout(tick, delay);
        };
        timer = setTimeout(tick, delay);

        const onVis = () => {
            if (document.visibilityState === "visible" && recommendations?.isGenerating) {
                fetchRecs();
            }
        };
        document.addEventListener("visibilitychange", onVis);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [recommendations?.isGenerating, fetchRecs]);

    // Periodically check if recommendations are stale (>2h old) and re-fetch
    useEffect(() => {
        if (!recommendations?.generatedAt || recommendations?.isGenerating) return;
        const checkStale = setInterval(() => {
            const age = Date.now() - recommendations.generatedAt * 1000;
            if (age > 2 * 60 * 60 * 1000) {
                fetchRecs();
            }
        }, 5 * 60 * 1000);
        return () => clearInterval(checkStale);
    }, [recommendations?.generatedAt, recommendations?.isGenerating, fetchRecs]);

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

    const deduplicatedItems = useMemo(() => {
        const seen = new Set<string>();
        return items.filter((item: any) => {
            const key = `${item._type}-${item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [items]);

    const filteredItems = useMemo(() => {
        return deduplicatedItems.filter((item: any) => {
            if (filter !== "all" && item._type !== filter) return false;
            if (ratings[item.id]) return false;
            if (isInWatchlist(item)) return false;
            return true;
        });
    }, [deduplicatedItems, filter, ratings, watchlist]);

    const isInWatchlist = (item: any) => {
        if (!item.id) return false;
        const wlId = getWatchlistId(item);
        return (watchlist as any[]).some((w) => w.tmdbId === wlId);
    };

    const playRecommendation = async (item: any) => {
        // Cancel any in-flight play attempt to prevent race conditions
        if (pendingPlayRef.current) pendingPlayRef.current.abort();
        const controller = new AbortController();
        pendingPlayRef.current = controller;

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
                const tmdbData = await getDetails(item.id, "tv");
                if (controller.signal.aborted) return;
                if (tmdbData) {
                    setSelectedShowDetails(tmdbData);
                    const seasonObj = tmdbData.seasons?.find((s: any) => s.season_number === 1);
                    const epCount = seasonObj?.episode_count || 1;
                    setSelectedSeason(1); setSelectedEpisode(1);
                    setEpisodesList(Array.from({ length: epCount }, (_, i) => i + 1));
                } else {
                    setSelectedShowDetails(null); setEpisodesList([]);
                }
            } catch (err) { console.error(`[RecommendClient] Failed to load TV details for playback: ${err}`); setSelectedShowDetails(null); setEpisodesList([]); }
        } else {
            setSelectedShowDetails(null); setEpisodesList([]); setSelectedSeason(1); setSelectedEpisode(1);
        }
        if (controller.signal.aborted) return;
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

    const renderCard = (item: any) => {
        const key = `${item._type || "x"}-${item.id || item.title}`;
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
    const formattedDate = generatedAt ? new Date(generatedAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
    const madeForYouItems = useMemo(() => {
        if (filter === "all") {
            const movies = (recommendations?.madeForYou?.movies || []).filter((item: any) => !ratings[item.id]).map((item: any) => ({ ...item, _type: "movie" as const }));
            const tv = (recommendations?.madeForYou?.tv || []).filter((item: any) => !ratings[item.id]).map((item: any) => ({ ...item, _type: "tv" as const }));
            return [...movies, ...tv];
        }
        const key = filter === "movie" ? "movies" : "tv";
        const items = recommendations?.madeForYou?.[key] || [];
        const type = filter === "movie" ? "movie" : "tv";
        return items.filter((item: any) => !ratings[item.id]).map((item: any) => ({ ...item, _type: type }));
    }, [recommendations, filter, ratings]);

    const newToYouItems = useMemo(() => {
        if (filter === "all") {
            const movies = (recommendations?.newToYou?.movies || []).filter((item: any) => !ratings[item.id]).map((item: any) => ({ ...item, _type: "movie" as const }));
            const tv = (recommendations?.newToYou?.tv || []).filter((item: any) => !ratings[item.id]).map((item: any) => ({ ...item, _type: "tv" as const }));
            return [...movies, ...tv];
        }
        const key = filter === "movie" ? "movies" : "tv";
        const items = recommendations?.newToYou?.[key] || [];
        const type = filter === "movie" ? "movie" : "tv";
        return items.filter((item: any) => !ratings[item.id]).map((item: any) => ({ ...item, _type: type }));
    }, [recommendations, filter, ratings]);

    const allMovies = (recommendations?.madeForYou?.movies?.length || 0)
        + (recommendations?.newToYou?.movies?.length || 0)
        + (recommendations?.recommendedMovies?.length || 0);
    const allTvShows = (recommendations?.madeForYou?.tv?.length || 0)
        + (recommendations?.newToYou?.tv?.length || 0)
        + (recommendations?.recommendedTvShows?.length || 0);
    const totalCount = allMovies + allTvShows;
    const hasAnyItems = totalCount > 0;
    const filteredMovieCount = filteredItems.filter((i: any) => i._type === "movie").length;
    const filteredTvCount = filteredItems.filter((i: any) => i._type === "tv").length;

    return (
        <main className="min-h-screen bg-black text-slate-100 font-sans selection:bg-white/20 pb-20 relative overflow-hidden">
            <div className="w-full flex-shrink-0 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pt-4 md:pt-3">
                <Navbar onSettingsClick={() => setShowSettings(true)} currentPath="/recommend" username={username}>
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
                    <span>{filteredMovieCount} <span className="text-slate-600">movies</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>{filteredTvCount} <span className="text-slate-600">series</span></span>
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
                        <button onClick={() => setShowSettings(true)}
                            className="mt-2 flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all active:scale-95 cursor-pointer">
                            Configure Settings
                        </button>
                    </div>
                ) : !hasAnyItems ? (
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
                ) : (
                    <>
                        {(madeForYouItems.length > 0 || newToYouItems.length > 0) && (
                            <div className="mb-10 space-y-10">
                                {madeForYouItems.length > 0 && (
                                    <div>
                                        <div className="mb-3">
                                            <h2 className="text-base md:text-lg font-semibold text-slate-100">Made for You</h2>
                                            <p className="text-[10px] text-slate-500 mt-0.5 tracking-wide">Picks tailored to your taste</p>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-6 md:gap-x-5">
                                            {madeForYouItems.map(renderCard)}
                                        </div>
                                    </div>
                                )}

                                {newToYouItems.length > 0 && (
                                    <div>
                                        <div className="mb-3">
                                            <h2 className="text-base md:text-lg font-semibold text-slate-100">New to You</h2>
                                            <p className="text-[10px] text-slate-500 mt-0.5 tracking-wide">Step outside your comfort zone</p>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-6 md:gap-x-5">
                                            {newToYouItems.map(renderCard)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mb-6 border-t border-white/[0.04]" />

                        {filteredItems.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="text-[11px] text-white/40 uppercase tracking-widest font-light">
                                    No {filter === "movie" ? "movies" : "series"} in main recommendations.
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-base md:text-lg font-semibold text-slate-100 mb-4">More Recommendations</h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6 md:gap-x-5 md:gap-y-10">
                                    {filteredItems.map(renderCard)}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <PlayerModal activeStream={activeStream} playerError={playerError}
                effectiveSource={playerSource || effectiveSource} effectiveEnabledSources={effectiveEnabledSources}
                selectedShowDetails={selectedShowDetails} selectedSeason={selectedSeason} selectedEpisode={selectedEpisode}
                episodesList={episodesList} ratings={ratings} watchlist={watchlist}
                onClose={closePlayer} onSourceChange={handleSourceChange}
                onRate={handleRate} onChangeEpisode={changeEpisode}
                onToggleWatchlist={handleToggleWatchlist}
                onPlaySimilar={(movie: any) => playRecommendation(movie)}
                initialTab="details" />

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

            <SettingsOverlay
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onSourcesChange={onSourcesChange}
                initialEnabled={effectiveEnabledSources}
                initialDefaultSource={effectiveSource}
                username={username}
            />
        </main>
    );
}
