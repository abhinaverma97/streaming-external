"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";

import { Navbar } from "./components/Navbar";
import SettingsOverlay from "./components/SettingsOverlay";
import { PlayerModal } from "./components/PlayerModal";

import FadeContent from "./components/FadeContent";
import ScrollRow from "./components/ScrollRow";
import { SearchInput } from "./components/SearchInput";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { SearchResultsSection } from "./components/SearchResultsSection";
import { TrendingSection } from "./components/TrendingSection";
import { ContinueWatchingSection } from "./components/ContinueWatchingSection";
import { WatchlistSection } from "./components/WatchlistSection";
import { MovieCard } from "./components/MovieCard";
import { HeroSection } from "./components/HeroSection";
import { SOURCES, getSource, buildEmbedUrl } from "./lib/sources-config";
import { extractTrailerUrl } from "./lib/tmdb-utils";
import { getWatchlistId } from "./lib/watchlist";
import { Movie } from "./lib/types";

import { useSearch } from "./hooks/useSearch";
import { useSourcePrefs } from "./hooks/useSourcePrefs";
import { useUserLists } from "./hooks/useUserListsSWR";
import { usePlayerProgress } from "./hooks/usePlayerProgress";
import { useTrending } from "./hooks/useTrending";

const DEBUG = false;
const CN = "relative aspect-[16/9] rounded-xl overflow-hidden mb-2 border border-slate-800/40 group-hover:border-white/40 transition-all duration-300 shadow-md bg-slate-950";

export default function Home() {
    // ── Search ──
    const {
        searchQuery, setSearchQuery,
        searchResults, isSearching,
        searchLoading,
        isMobileSearchOpen, setIsMobileSearchOpen,
        handleSearch, clearSearch,
    } = useSearch();

    // ── Source Prefs ──
    const {
        selectedSource, setSelectedSource,
        defaultSource, enabledSources,
        effectiveEnabledSources, effectiveSource,
        onSourcesChange,
    } = useSourcePrefs();

    // ── User Lists ──
    const {
        watchlist, continueWatching, history, ratings,
        fetchUserLists, handleRate,
    } = useUserLists();

    // ── Movie Categories ──
    const { trending, trendingType, setTrendingType } = useTrending("movie");
    const [watchlistFilter, setWatchlistFilter] = useState<"all" | "movie" | "tv">("all");

    // ── Selected Movie for Hero ──
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

    // ── TV Show Selection ──
    const [selectedShowDetails, setSelectedShowDetails] = useState<any | null>(null);
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
    const [episodesList, setEpisodesList] = useState<number[]>([]);

    // ── Filtered Trending (exclude history) ──
    const filteredTrending = useMemo(() => {
        const historyIds = new Set((history as any[]).map(h => h.movieDetails?.id).filter(Boolean));
        return trending.filter(item => !historyIds.has(item.id));
    }, [trending, history]);

    // ── Continue Watching Hero Context ──
    const [cwPlayContext, setCwPlayContext] = useState<{
        movieId: number; timestamp: number; source?: string;
        season?: number; episode?: number; percent: number; isTv: boolean;
    } | null>(null);

    // ── Settings ──
    const [showSettings, setShowSettings] = useState(false);

    // ── Active Stream ──
    const [activeStream, setActiveStream] = useState<{
        tmdbId: string; title: string; details: any; embedUrl: string;
    } | null>(null);
    const [playerError, setPlayerError] = useState<string | null>(null);

    // ── Hero Trailer ──
    const [heroTrailerUrl, setHeroTrailerUrl] = useState<string | null>(null);

    // ── Refs ──
    const heroAutoSelectDisabled = useRef(false);
    const lastProgressRef = useRef(0);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<HTMLIFrameElement>(null);
    const hasScrolledToSearch = useRef(false);

    const activeStreamRef = useRef(activeStream);
    useEffect(() => { activeStreamRef.current = activeStream; }, [activeStream]);
    const selectedSourceRef = useRef(selectedSource);
    useEffect(() => { selectedSourceRef.current = selectedSource; }, [selectedSource]);

    // ── Player Progress Hook ──
    usePlayerProgress(activeStreamRef, selectedSourceRef, lastProgressRef, fetchUserLists);

    // ── Fetch user lists on mount ──
    useEffect(() => { fetchUserLists(); }, []);

    // ── Auto-scroll to search results on desktop ──
    useEffect(() => {
        if (isSearching && !searchLoading && searchResults.length > 0 && !hasScrolledToSearch.current) {
            const el = document.getElementById("search-results-section");
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
                hasScrolledToSearch.current = true;
            }
        }
        if (!isSearching) {
            hasScrolledToSearch.current = false;
        }
    }, [isSearching, searchLoading, searchResults]);

    // ── Open mobile search from redirect ──
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("search") === "open") {
            setIsMobileSearchOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [setIsMobileSearchOpen]);

    // ── Hero Decision ──
    useEffect(() => {
        if (activeStream || heroAutoSelectDisabled.current) return;
        if (continueWatching.length > 0) {
            const item = continueWatching[0];
            const mt = item.mediaType || item.movieDetails?.media_type || "movie";
            const percent = Math.min(100, Math.round((item.timestamp / item.duration) * 100));
            let fs: number | undefined;
            let fe: number | undefined;
            if (item.tmdbId?.startsWith("tv-")) {
                const parts = item.tmdbId.split("-");
                if (parts.length >= 4) { fs = parseInt(parts[2], 10); fe = parseInt(parts[3], 10); }
            }
            if (!fs || isNaN(fs)) fs = 1;
            if (!fe || isNaN(fe)) fe = 1;
            setCwPlayContext({ movieId: item.movieDetails?.id, timestamp: item.timestamp, source: item.source, season: fs, episode: fe, percent, isTv: mt === "tv" });
            if (item.movieDetails?.id && selectedMovie?.id !== item.movieDetails?.id) {
                loadMovieDetails(item.movieDetails?.id, mt);
            }
        } else if (trending.length > 0) {
            setCwPlayContext(null);
            if (selectedMovie?.id !== trending[0].id) {
                loadMovieDetails(trending[0].id, trendingType);
            }
        }
    }, [continueWatching, trending, activeStream]);

    // ── Helpers ──

    const loadMovieDetails = async (tmdbId: number, mediaType: string = "movie") => {
        try {
            setHeroTrailerUrl(null);
            if (mediaType === "tv") {
                const res = await fetch(`/api/tv/${tmdbId}`);
                const data = await res.json();
                if (data.tmdb) {
                    const normalized: Movie = {
                        ...data.tmdb,
                        title: data.tmdb.name,
                        release_date: data.tmdb.first_air_date || "",
                        media_type: "tv"
                    };
                    setSelectedMovie(normalized);
                    setSelectedShowDetails(data.tmdb);
                    setHeroTrailerUrl(extractTrailerUrl(data.tmdb.videos));

                    const validSeasons = (data.tmdb.seasons || []).filter((s: any) => s.season_number > 0);
                    if (validSeasons.length > 0) {
                        const initialSeason = validSeasons[0].season_number;
                        setSelectedSeason(initialSeason);
                        const epCount = validSeasons[0].episode_count || 1;
                        setEpisodesList(Array.from({ length: epCount }, (_, i) => i + 1));
                        setSelectedEpisode(1);
                    } else {
                        setEpisodesList([]);
                    }
                }
            } else {
                const res = await fetch(`/api/movie/${tmdbId}`);
                const data = await res.json();
                if (data.tmdb) {
                    setSelectedMovie({ ...data.tmdb, media_type: "movie" });
                    setSelectedShowDetails(null);
                    setHeroTrailerUrl(extractTrailerUrl(data.tmdb.videos));
                }
            }
        } catch {}
    };

    const handleCardClick = (movie: Movie) => {
        heroAutoSelectDisabled.current = true;
        setSelectedMovie(movie);
        loadMovieDetails(movie.id, movie.media_type || "movie");
    };

    // ── Load Pending Stream from other pages ──
    useEffect(() => {
        const pending = sessionStorage.getItem("pendingStream");
        if (pending) {
            try {
                const movie = JSON.parse(pending);
                sessionStorage.removeItem("pendingStream");
                setTimeout(() => {
                    handleCardClick(movie);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }, 50);
            } catch (e) {}
        }
    }, []);

    const toggleWatchlist = async (movie: Movie) => {
        const watchlistId = getWatchlistId(movie);
        if (!watchlistId) return;
        const isQueued = (watchlist as any[]).some((item) => item.tmdbId === watchlistId);
        try {
            if (isQueued) {
                await fetch(`/api/watchlist/${watchlistId}`, { method: "DELETE" });
            } else {
                await fetch(`/api/watchlist`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tmdbId: watchlistId,
                        mediaType: movie.media_type,
                        movieDetails: {
                            id: movie.id,
                            title: movie.title,
                            poster_path: movie.poster_path,
                            backdrop_path: movie.backdrop_path,
                            vote_average: movie.vote_average,
                            release_date: movie.release_date,
                            media_type: movie.media_type
                        }
                    })
                });
            }
            fetchUserLists();
        } catch {}
    };

    const playMovie = async (
        movie: Movie,
        startTime: number = 0,
        forceSeason?: number,
        forceEpisode?: number,
        sourceOverride?: string
    ) => {
        const isTv = movie.media_type === "tv";

        let targetSeason = forceSeason !== undefined ? forceSeason : selectedSeason;
        let targetEpisode = forceEpisode !== undefined ? forceEpisode : selectedEpisode;

        if (isTv && forceSeason === undefined && forceEpisode === undefined) {
            const wlId = getWatchlistId(movie);
            if (wlId.startsWith("tv-")) {
                const parts = wlId.split("-");
                if (parts.length >= 4) {
                    targetSeason = parseInt(parts[2], 10);
                    targetEpisode = parseInt(parts[3], 10);
                }
            }
        }

        if (!isTv) {
            setSelectedShowDetails(null);
            setEpisodesList([]);
            setSelectedSeason(1);
            setSelectedEpisode(1);
        }

        let showName: string | undefined;

        if (isTv) {
            setSelectedSeason(targetSeason);
            setSelectedEpisode(targetEpisode);
            if (!selectedShowDetails || selectedShowDetails.id !== movie.id) {
                const res = await fetch(`/api/tv/${movie.id}`);
                const data = await res.json();
                const tmdbData = data.tmdb || data;
                showName = tmdbData.name || tmdbData.title;
                setSelectedShowDetails(tmdbData);

                if (forceSeason === undefined && forceEpisode === undefined) {
                    const validSeasons = (tmdbData.seasons || []).filter((s: any) => s.season_number > 0);
                    if (validSeasons.length > 0) {
                        targetSeason = validSeasons[0].season_number;
                        targetEpisode = 1;
                        setSelectedSeason(targetSeason);
                        setSelectedEpisode(targetEpisode);
                    }
                }

                const seasonObj = tmdbData.seasons ? tmdbData.seasons.find((s: any) => s.season_number === targetSeason) : null;
                const epCount = seasonObj ? seasonObj.episode_count : 1;
                setEpisodesList(Array.from({ length: epCount }, (_, i) => i + 1));
            } else {
                showName = selectedShowDetails.name || selectedShowDetails.title;
                const seasons = selectedShowDetails.seasons || selectedShowDetails.tmdb?.seasons;
                const seasonObj = seasons ? seasons.find((s: any) => s.season_number === targetSeason) : null;
                const epCount = seasonObj ? seasonObj.episode_count : 1;
                setEpisodesList(Array.from({ length: epCount }, (_, i) => i + 1));
            }
        }

        let baseTitle = movie.title || movie.name || "Untitled";
        let cleanTitle = baseTitle.replace(/ S\d{2}E\d{2}/g, "").trim();

        if (cleanTitle === "undefined" || cleanTitle === "Untitled") {
            cleanTitle = showName || selectedShowDetails?.name || selectedShowDetails?.title || movie.name || movie.title || "Untitled";
            cleanTitle = cleanTitle.replace(/ S\d{2}E\d{2}/g, "").trim();
        }

        const resolvedTitle = isTv ? `${cleanTitle} S${String(targetSeason).padStart(2, "0")}E${String(targetEpisode).padStart(2, "0")}` : cleanTitle;

        const tmdbId = isTv ? `tv-${movie.id}-${targetSeason}-${targetEpisode}` : String(movie.id);

        setPlayerError(null);

        const effectiveSource = sourceOverride || selectedSource;
        if (effectiveSource !== selectedSource) setSelectedSource(effectiveSource);
        const embedUrl = buildEmbedUrl(effectiveSource, movie.id, isTv ? "tv" : "movie", targetSeason, targetEpisode, startTime);

        setActiveStream({ tmdbId, title: resolvedTitle, details: movie, embedUrl });
    };

    const changeEpisode = (season: number, episode: number) => {
        if (!activeStream) return;
        setSelectedSeason(season);
        setSelectedEpisode(episode);
        playMovie(activeStream.details, 0, season, episode);
    };

    const handleSourceChange = (newSource: string) => {
        setSelectedSource(newSource);
        if (!activeStream) return;
        const isTv = activeStream.details?.media_type === "tv" || activeStream.details?.mediaType === "tv";
        const startAt = lastProgressRef.current > 0 ? Math.floor(lastProgressRef.current) : undefined;
        const newUrl = buildEmbedUrl(
            newSource,
            activeStream.details?.id,
            isTv ? "tv" : "movie",
            isTv ? selectedSeason : undefined,
            isTv ? selectedEpisode : undefined,
            startAt
        );
        setActiveStream({ ...activeStream, embedUrl: newUrl });
    };

    const closePlayer = () => {
        setActiveStream(null);
        setPlayerError(null);
        fetchUserLists();
    };

    const handleCWResume = useCallback((item: any, src: string, parsedMovieId: number, fs: number, fe: number, mt: string) => {
        if (src) setSelectedSource(src);
        const cwMovie = { ...(item.movieDetails || {}), id: parsedMovieId, media_type: mt };
        playMovie(cwMovie, item.timestamp, fs, fe, src);
    }, [playMovie, setSelectedSource]);

    const handleSettingsOpen = useCallback(() => setShowSettings(true), [setShowSettings]);
    const handleSettingsClose = useCallback(() => setShowSettings(false), [setShowSettings]);

    const handleWatchlistCardClick = useCallback((item: any) => {
        const mt = item.mediaType || item.movieDetails?.media_type || "movie";
        handleCardClick({ ...(item.movieDetails || {}), media_type: mt });
    }, [handleCardClick]);

    // ── Render ──

    return (
        <div className="relative h-screen flex flex-col overflow-hidden bg-black select-none text-slate-100">

            {/* ── STICKY TOP AREA ── */}
            <div className="w-full flex-shrink-0 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pt-4 md:pt-0">
                <Navbar onSettingsClick={handleSettingsOpen} currentPath="/">
                    <SearchInput
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        handleSearch={handleSearch}
                        onClear={clearSearch}
                    />
                </Navbar>

                <HeroSection
                    selectedMovie={selectedMovie}
                    heroTrailerUrl={heroTrailerUrl}
                    cwPlayContext={cwPlayContext}
                    watchlist={watchlist}
                    ratings={ratings}
                    defaultSource={defaultSource}
                    effectiveEnabledSources={effectiveEnabledSources}
                    selectedSource={selectedSource}
                    activeStream={activeStream}
                    onPlay={playMovie}
                    onToggleWatchlist={toggleWatchlist}
                    onRate={handleRate}
                    getWatchlistId={getWatchlistId}
                />
            </div>

            {/* ── SCROLLABLE BOTTOM AREA ── */}
            <div className="w-full flex-1 overflow-y-auto no-scrollbar z-10 relative snap-y snap-mandatory">
                <div className="max-w-[96vw] mx-auto px-6 md:px-12">
                    <div className="hidden md:block">
                        <SearchResultsSection
                            isSearching={isSearching}
                            searchLoading={searchLoading}
                            searchQuery={searchQuery}
                            searchResults={searchResults}
                            onCardClick={handleCardClick}
                        />
                    </div>

                    <div className="flex flex-col gap-0 pb-28 md:pb-12">
                        <TrendingSection
                            trending={filteredTrending}
                            trendingType={trendingType}
                            selectedMovieId={selectedMovie?.id}
                            onTrendingTypeChange={setTrendingType}
                            onCardClick={handleCardClick}
                        />

                        <ContinueWatchingSection
                            continueWatching={continueWatching}
                            effectiveEnabledSources={effectiveEnabledSources}
                            effectiveSource={effectiveSource}
                            onResume={handleCWResume}
                            DEBUG={DEBUG}
                        />

                        <WatchlistSection
                            watchlist={watchlist}
                            watchlistFilter={watchlistFilter}
                            onFilterChange={setWatchlistFilter}
                            onCardClick={handleWatchlistCardClick}
                        />
                    </div>
                </div>
            </div>

            {/* ── VIDEO PLAYER MODAL ── */}
            <PlayerModal
                activeStream={activeStream}
                playerError={playerError}
                playerContainerRef={playerContainerRef}
                playerRef={playerRef}
                effectiveSource={effectiveSource}
                effectiveEnabledSources={effectiveEnabledSources}
                selectedShowDetails={selectedShowDetails}
                selectedSeason={selectedSeason}
                selectedEpisode={selectedEpisode}
                episodesList={episodesList}
                ratings={ratings}
                onClose={closePlayer}
                onSourceChange={handleSourceChange}
                onRate={handleRate}
                onChangeEpisode={changeEpisode}
            />

            <MobileBottomNav
                activeStream={activeStream}
                isMobileSearchOpen={isMobileSearchOpen}
                setIsMobileSearchOpen={setIsMobileSearchOpen}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearch={handleSearch}
                setShowSettings={setShowSettings}
                currentPath="/"
                searchResults={searchResults}
                isSearching={isSearching}
                searchLoading={searchLoading}
                onCardClick={handleCardClick}
            />

            <SettingsOverlay isOpen={showSettings} onClose={handleSettingsClose} onSourcesChange={onSourcesChange} />

        </div>
    );
}
