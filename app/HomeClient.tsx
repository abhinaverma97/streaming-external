"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

import { Navbar } from "./components/Navbar";
import SettingsOverlay from "./components/SettingsOverlay";
import { PlayerModal } from "./components/PlayerModal";
import { SearchInput } from "./components/SearchInput";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { SearchResultsSection } from "./components/SearchResultsSection";
import { TrendingSection } from "./components/TrendingSection";
import { ContinueWatchingSection } from "./components/ContinueWatchingSection";
import { WatchlistSection } from "./components/WatchlistSection";
import { HeroSection } from "./components/HeroSection";
import { buildEmbedUrl } from "./lib/sources-config";
import { extractTrailerUrl } from "./lib/tmdb-utils";
import { getWatchlistId } from "./lib/watchlist";
import { Movie, CwPlayContext } from "./lib/types";
import { getDetails } from "./lib/details-cache";

import { useSearch } from "./hooks/useSearch";
import { useSourcePrefs } from "./hooks/useSourcePrefs";
import { useUserLists } from "./hooks/useUserLists";
import { usePlayerProgress, flushGlobalProgress } from "./hooks/usePlayerProgress";

interface HomeClientProps {
    watchlist: any[];
    continueWatching: any[];
    history: any[];
    ratings: Record<string, any>;
    trendingMovies: any[];
    trendingTv: any[];
    defaultSource: string;
    enabledSources: string[];
}

export default function HomeClient({ watchlist: wl, continueWatching: cw, history, ratings: rt, trendingMovies, trendingTv, defaultSource, enabledSources }: HomeClientProps) {
    const {
        searchQuery, setSearchQuery,
        searchResults, isSearching,
        searchLoading,
        isMobileSearchOpen, setIsMobileSearchOpen,
        handleSearch, clearSearch,
    } = useSearch();

    const {
        defaultSource: currentDefaultSource,
        effectiveEnabledSources, effectiveSource,
        onSourcesChange,
    } = useSourcePrefs(defaultSource, enabledSources);

    // Tracks which source is active inside the current player session only.
    // Intentionally separate from effectiveSource (user's configured default).
    const [playerSource, setPlayerSource] = useState<string | null>(null);

    const {
        watchlist, continueWatching, ratings,
        handleRate, handleToggleWatchlist,
        refreshContinueWatching,
        refreshWatchlist,
    } = useUserLists({ watchlist: wl, continueWatching: cw, ratings: rt });

    const [trendingType, setTrendingType] = useState<"movie" | "tv">("movie");
    const trending = trendingType === "movie" ? trendingMovies : trendingTv;
    const [watchlistFilter, setWatchlistFilter] = useState<"all" | "movie" | "tv">("all");

    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
    const [selectedShowDetails, setSelectedShowDetails] = useState<any | null>(null);
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
    const [episodesList, setEpisodesList] = useState<number[]>([]);

    const filteredTrending = useMemo(() => {
        const historyIds = new Set((history as any[]).map(h => h.movieDetails?.id).filter(Boolean));
        return trending.filter(item => !historyIds.has(item.id));
    }, [trending, history]);

    const [cwPlayContext, setCwPlayContext] = useState<CwPlayContext | null>(null);

    const [showSettings, setShowSettings] = useState(false);

    const [activeStream, setActiveStream] = useState<{
        tmdbId: string; title: string; details: any; embedUrl: string;
    } | null>(null);
    const [playerError, setPlayerError] = useState<string | null>(null);

    const [heroTrailerUrl, setHeroTrailerUrl] = useState<string | null>(null);

    const heroAutoSelectDisabled = useRef(false);
    const lastProgressRef = useRef(0);
    const hasScrolledToSearch = useRef(false);

    const activeStreamRef = useRef(activeStream);
    useEffect(() => { activeStreamRef.current = activeStream; }, [activeStream]);
    const currentActiveSource = playerSource || effectiveSource;
    const activeSourceRef = useRef(currentActiveSource);
    useEffect(() => { activeSourceRef.current = currentActiveSource; }, [currentActiveSource]);

    // Player progress reporting. We intentionally do NOT pass a refresh
    // callback here — refreshing the CW list on every 5-second progress
    // tick is wasteful when the player modal is open over it. The list
    // is re-synced when the player closes (closePlayer) and when the
    // tab regains visibility (effect below).
    usePlayerProgress(activeStreamRef, activeSourceRef, lastProgressRef);

    // Re-sync CW + watchlist when the tab becomes visible (bfcache /
    // returning from another tab / mobile resume). The initial render
    // already has fresh SSR data, so no mount-time refetch needed.
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

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("search") === "open") {
            setIsMobileSearchOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        const pendingSearch = sessionStorage.getItem("pendingSearch");
        if (pendingSearch) {
            sessionStorage.removeItem("pendingSearch");
            setSearchQuery(pendingSearch);
        }
    }, [setIsMobileSearchOpen, setSearchQuery]);

    const loadMovieDetails = useCallback(async (tmdbId: number, mediaType: string = "movie") => {
        try {
            setHeroTrailerUrl(null);
            const details = await getDetails(tmdbId, mediaType as "movie" | "tv");
            if (!details) return;

            if (mediaType === "tv") {
                const normalized: Movie = {
                    ...details,
                    title: details.name,
                    release_date: details.first_air_date || "",
                    media_type: "tv",
                };
                setSelectedMovie(normalized);
                setSelectedShowDetails(details);
                setHeroTrailerUrl(extractTrailerUrl(details.videos));
                const validSeasons = (details.seasons || []).filter((s: any) => s.season_number > 0);
                if (validSeasons.length > 0) {
                    const initialSeason = validSeasons[0].season_number;
                    setSelectedSeason(initialSeason);
                    const epCount = validSeasons[0].episode_count || 1;
                    setEpisodesList(Array.from({ length: epCount }, (_, i) => i + 1));
                    setSelectedEpisode(1);
                } else {
                    setEpisodesList([]);
                }
            } else {
                setSelectedMovie({ ...details, media_type: "movie" });
                setSelectedShowDetails(null);
                setHeroTrailerUrl(extractTrailerUrl(details.videos));
            }
        } catch (err) {
            console.error(`[HomeClient] Failed to load movie details: ${err}`);
        }
    }, []);

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
    }, [continueWatching, trending, trendingType, activeStream, loadMovieDetails, selectedMovie]);

    const handleCardClick = useCallback((movie: Movie) => {
        heroAutoSelectDisabled.current = true;
        setSelectedMovie(movie);
        loadMovieDetails(movie.id, movie.media_type || "movie");
    }, [loadMovieDetails]);

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
            } catch (err) {
                console.error(`[HomeClient] Failed to parse pending stream: ${err}`);
            }
        }
    }, []);

    const playMovie = useCallback(async (
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
                const tmdbData = await getDetails(movie.id, "tv");
                if (!tmdbData) return;
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

        const baseTitle = movie.title || movie.name || "Untitled";
        let cleanTitle = baseTitle.replace(/ S\d{2}E\d{2}/g, "").trim();

        if (cleanTitle === "undefined" || cleanTitle === "Untitled") {
            cleanTitle = showName || selectedShowDetails?.name || selectedShowDetails?.title || movie.name || movie.title || "Untitled";
            cleanTitle = cleanTitle.replace(/ S\d{2}E\d{2}/g, "").trim();
        }

        const resolvedTitle = isTv ? `${cleanTitle} S${String(targetSeason).padStart(2, "0")}E${String(targetEpisode).padStart(2, "0")}` : cleanTitle;

        const tmdbId = isTv ? `tv-${movie.id}-${targetSeason}-${targetEpisode}` : String(movie.id);

        setPlayerError(null);

        // Always use the user's configured default (effectiveSource) for new plays.
        // sourceOverride is only for CW resumes with a saved source.
        const sourceToUse = sourceOverride || effectiveSource;
        setPlayerSource(sourceToUse);
        const embedUrl = buildEmbedUrl(sourceToUse, movie.id, isTv ? "tv" : "movie", targetSeason, targetEpisode, startTime);

        setActiveStream({ tmdbId, title: resolvedTitle, details: movie, embedUrl });
    }, [selectedSeason, selectedEpisode, selectedShowDetails, effectiveSource]);

    const changeEpisode = (season: number, episode: number) => {
        if (!activeStream) return;
        setSelectedSeason(season);
        setSelectedEpisode(episode);
        // Preserve whichever source is currently active in the player
        playMovie(activeStream.details, 0, season, episode, playerSource || effectiveSource);
    };

    const handleSourceChange = (newSource: string) => {
        // Only update the active player session's source — do NOT mutate
        // selectedSource / the user's configured default.
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
        setPlayerSource(null); // Reset ephemeral player source; future plays use the default
        refreshContinueWatching();
    };

    const handleCWResume = useCallback((item: any, src: string, parsedMovieId: number, fs: number, fe: number, mt: string) => {
        // CW items use their saved source as an override only for this play.
        // Do NOT mutate selectedSource / the user's default.
        const cwMovie = { ...(item.movieDetails || {}), id: parsedMovieId, media_type: mt };
        playMovie(cwMovie, item.timestamp, fs, fe, src || effectiveSource);
    }, [playMovie, effectiveSource]);

    const handleWatchlistCardClick = useCallback((item: any) => {
        const mt = item.mediaType || item.movieDetails?.media_type || "movie";
        handleCardClick({ ...(item.movieDetails || {}), media_type: mt });
    }, [handleCardClick]);

    return (
        <div className="relative h-screen flex flex-col overflow-hidden bg-black select-none text-slate-100">
            <div className="w-full flex-shrink-0 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pt-4 md:pt-3">
                <Navbar onSettingsClick={() => setShowSettings(true)} currentPath="/">
                    <SearchInput
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        handleSearch={handleSearch}
                        onClear={clearSearch}
                    />
                </Navbar>

                <div className="hero-transition flex-none w-full">
                    <HeroSection
                        selectedMovie={selectedMovie}
                        heroTrailerUrl={heroTrailerUrl}
                        cwPlayContext={cwPlayContext}
                        watchlist={watchlist}
                        ratings={ratings}
                        defaultSource={currentDefaultSource}
                        effectiveEnabledSources={effectiveEnabledSources}
                        activeStream={activeStream}
                        onPlay={playMovie}
                        onToggleWatchlist={handleToggleWatchlist}
                        onRate={handleRate}
                        getWatchlistId={getWatchlistId}
                    />
                </div>
            </div>

            <div className="content-transition w-full flex-1 overflow-y-auto no-scrollbar z-10 relative snap-y snap-mandatory">
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

                    <div className="flex flex-col gap-0 pb-20">
                        <TrendingSection
                            trending={filteredTrending}
                            trendingType={trendingType}
                            selectedMovieId={selectedMovie?.id}
                            onTrendingTypeChange={setTrendingType}
                            onCardClick={handleCardClick}
                            loading={false}
                        />

                        <ContinueWatchingSection
                            continueWatching={continueWatching}
                            effectiveEnabledSources={effectiveEnabledSources}
                            effectiveSource={effectiveSource}
                            onResume={handleCWResume}
                            isLoading={false}
                        />

                        <WatchlistSection
                            watchlist={watchlist}
                            watchlistFilter={watchlistFilter}
                            onFilterChange={setWatchlistFilter}
                            onCardClick={handleWatchlistCardClick}
                            isLoading={false}
                        />
                    </div>
                </div>
            </div>

            <PlayerModal
                activeStream={activeStream}
                playerError={playerError}
                effectiveSource={playerSource || effectiveSource}
                effectiveEnabledSources={effectiveEnabledSources}
                selectedShowDetails={selectedShowDetails}
                selectedSeason={selectedSeason}
                selectedEpisode={selectedEpisode}
                episodesList={episodesList}
                ratings={ratings}
                watchlist={watchlist}
                onClose={closePlayer}
                onSourceChange={handleSourceChange}
                onRate={handleRate}
                onChangeEpisode={changeEpisode}
                onToggleWatchlist={handleToggleWatchlist}
                onPlaySimilar={(movie: any) => {
                    if (activeStream) flushGlobalProgress();
                    playMovie(movie, 0);
                }}
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

            <SettingsOverlay
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onSourcesChange={onSourcesChange}
                initialEnabled={effectiveEnabledSources}
                initialDefaultSource={currentDefaultSource}
            />

        </div>
    );
}
