"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
    Play,
    Plus,
    Check,
    Star,
    Search,
    X,
    Film,
    AlertCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Home as HomeIcon,
    List,
    Settings as SettingsIcon,
    Volume2,
    VolumeX
} from "lucide-react";


import VariableProximity from "./components/VariableProximity";
import ScrambledText from "./components/ScrambledText";
import GlassSurface from "./components/GlassSurface";
import FadeContent from "./components/FadeContent";
import Dither from "./components/Dither";
import ScrollRow from "./components/ScrollRow";
import Navbar from "./components/Navbar";
import SettingsOverlay from "./components/SettingsOverlay";
import { SOURCES, getSource, buildEmbedUrl } from "./lib/sources-config";

interface Movie {
    id: number;
    title?: string;
    name?: string;
    overview: string;
    poster_path: string;
    backdrop_path: string;
    vote_average: number;
    release_date?: string;
    first_air_date?: string;
    media_type?: string;
    genres?: { id: number; name: string }[];
}

export default function Home() {
    // Movie categories
    const [trending, setTrending] = useState<Movie[]>([]);
    const [trendingType, setTrendingType] = useState<"movie" | "tv">("movie");
    const [watchlistFilter, setWatchlistFilter] = useState<"all" | "movie" | "tv">("all");


    // User lists from Backend
    const [watchlist, setWatchlist] = useState<any[]>([]);
    const [continueWatching, setContinueWatching] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [ratings, setRatings] = useState<Record<string, any>>({});

    // Selected Movie for Hero box
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

    // TV Show selection states
    const [searchType, setSearchType] = useState<"movie" | "tv" | "multi">("multi");
    const [selectedShowDetails, setSelectedShowDetails] = useState<any | null>(null);
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
    const [episodesList, setEpisodesList] = useState<number[]>([]);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Movie[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    // Continue Watching hero context
    const [cwPlayContext, setCwPlayContext] = useState<{
        movieId: number;
        timestamp: number;
        source?: string;
        season?: number;
        episode?: number;
        percent: number;
        isTv: boolean;
    } | null>(null);

    // Settings overlay
    const [showSettings, setShowSettings] = useState(false);
    const [selectedSource, setSelectedSource] = useState(() => {
        try { const v = localStorage.getItem("bitcine-default-source"); if (v && SOURCES.some((s) => s.id === v)) return v; } catch {}
        return "vidfast";
    });
    const defaultSourceRef = useRef(selectedSource);
    const [enabledSources, setEnabledSources] = useState<string[]>(() => {
        try { const raw = localStorage.getItem("bitcine-enabled-sources"); if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) return p; } } catch {}
        return SOURCES.map((s) => s.id);
    });

    // Active streaming state
    const [activeStream, setActiveStream] = useState<{
        tmdbId: string;
        title: string;
        details: any;
        embedUrl: string;
    } | null>(null);
    const [playerError, setPlayerError] = useState<string | null>(null);

    // Hero Trailer State
    const [heroTrailerUrl, setHeroTrailerUrl] = useState<string | null>(null);
    const [showHeroTrailer, setShowHeroTrailer] = useState(false);
    const [heroTrailerMuted, setHeroTrailerMuted] = useState(true);

    useEffect(() => {
        setShowHeroTrailer(false);
        let timer: any;
        if (heroTrailerUrl && !activeStream) {
            timer = setTimeout(() => setShowHeroTrailer(true), 3000);
        }
        return () => clearTimeout(timer);
    }, [heroTrailerUrl, activeStream]);

    const heroIframeRef = useRef<HTMLIFrameElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<HTMLIFrameElement>(null);
    const progressTimeoutRef = useRef<any>(null);
    const activeStreamRef = useRef(activeStream);
    activeStreamRef.current = activeStream;
    const selectedSourceRef = useRef(selectedSource);
    selectedSourceRef.current = selectedSource;
    const heroAutoSelectDisabled = useRef(false);

    const effectiveEnabledSources = enabledSources.length > 0 ? enabledSources : SOURCES.map((s) => s.id);
    const effectiveSource = effectiveEnabledSources.includes(selectedSource) ? selectedSource : (effectiveEnabledSources[0] || "vidfast");

    const onSourcesChange = (enabled: string[], defaultSource: string) => {
        setEnabledSources(enabled);
        setSelectedSource((prev) => {
            if (enabled.includes(prev)) return prev;
            return defaultSource;
        });
        defaultSourceRef.current = defaultSource;
        localStorage.setItem("bitcine-enabled-sources", JSON.stringify(enabled));
        localStorage.setItem("bitcine-default-source", defaultSource);
        fetch("/api/source-prefs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled, defaultSource })
        }).catch(() => {});
    };

    useEffect(() => {
        fetchUserLists();
        fetchSourcePrefs();
    }, []);

    const fetchSourcePrefs = async () => {
        try {
            const res = await fetch("/api/source-prefs");
            if (!res.ok) return;
            const data = await res.json();
            if (data.enabled && Array.isArray(data.enabled) && data.enabled.length > 0) {
                setEnabledSources(data.enabled);
                localStorage.setItem("bitcine-enabled-sources", JSON.stringify(data.enabled));
            }
            if (data.defaultSource && SOURCES.some((s) => s.id === data.defaultSource)) {
                setSelectedSource(data.defaultSource);
                defaultSourceRef.current = data.defaultSource;
                localStorage.setItem("bitcine-default-source", data.defaultSource);
            }
        } catch {}
    };

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const endpoint = trendingType === "movie" ? "movies" : "tv";
                const res = await fetch(`/api/${endpoint}/trending`);
                const data = await res.json();
                const trendingItems = (data.results || []).map((m: any) => ({ ...m, media_type: m.media_type || trendingType }));
                setTrending(trendingItems);
            } catch (e) {
                console.error("Error loading trending", e);
            }
        };
        fetchTrending();
    }, [trendingType]);

    // Hero decision: prefer continue watching, fall back to trending
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
                if (parts.length >= 2) { const maybeId = parseInt(parts[1], 10); }
                if (parts.length >= 4) { fs = parseInt(parts[2], 10); fe = parseInt(parts[3], 10); }
            }
            if (!fs || isNaN(fs)) fs = 1;
            if (!fe || isNaN(fe)) fe = 1;
            setCwPlayContext({ movieId: item.movieDetails?.id, timestamp: item.timestamp, source: item.source, season: fs, episode: fe, percent, isTv: mt === "tv" });
            if (selectedMovie?.id !== item.movieDetails?.id) {
                loadMovieDetails(item.movieDetails?.id, mt);
            }
        } else if (trending.length > 0) {
            setCwPlayContext(null);
            if (selectedMovie?.id !== trending[0].id) {
                loadMovieDetails(trending[0].id, trendingType);
            }
        }
    }, [continueWatching, trending, activeStream]);



    const fetchUserLists = async () => {
        try {
            const [watchRes, contRes, histRes, ratingsRes] = await Promise.all([
                fetch(`/api/watchlist`),
                fetch(`/api/continue-watching`),
                fetch(`/api/history`),
                fetch(`/api/ratings`)
            ]);
            setWatchlist(await watchRes.json());
            setContinueWatching(await contRes.json());
            setHistory(await histRes.json());
            setRatings(await ratingsRes.json());
        } catch (e) {
            console.error("Error loading user lists", e);
        }
    };

    const handleRate = async (movie: Movie, rating: number) => {
        if (!movie || !movie.id) return;
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
        } catch (e) {
            console.error("Error saving rating", e);
        }
    };

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

                    const trailer = data.tmdb.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || data.tmdb.videos?.results?.find((v: any) => v.site === "YouTube");
                    setHeroTrailerUrl(trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null);

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

                    const trailer = data.tmdb.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || data.tmdb.videos?.results?.find((v: any) => v.site === "YouTube");
                    setHeroTrailerUrl(trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null);
                }
            }
        } catch (e) {
            console.error("Error loading movie details", e);
        }
    };

    // ── Watchlist Management ──────────────────────────────────────────────────

    const getWatchlistId = (movie: Movie) => {
        return movie.media_type === "tv" ? `tv-${movie.id}` : String(movie.id);
    };

    const toggleWatchlist = async (movie: Movie) => {
        const watchlistId = getWatchlistId(movie);
        if (!watchlistId) return;
        const isQueued = watchlist.some((item) => item.tmdbId === watchlistId);
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
        } catch (e) {
            console.error("Watchlist error", e);
        }
    };

    // ── Search Logic ──────────────────────────────────────────────────────────

    const doSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${searchType}`);
            const data = await res.json();
            const tagged = (data.results || []).map((movie: any) => ({
                ...movie,
                media_type: movie.media_type || searchType
            }));
            setSearchResults(tagged);
            setTimeout(() => {
                const section = document.getElementById("search-results-section");
                if (section) {
                    section.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 100);
        } catch (e) {
            console.error("Search error", e);
        }
    }, [searchType]);

    const searchTimerRef = useRef<any>(null);

    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        searchTimerRef.current = setTimeout(() => doSearch(searchQuery), 300);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [searchQuery, doSearch]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        doSearch(searchQuery);
    };

    // ── Playback / Streaming ──────────────────────────────────────────────────

    const handleCardClick = (movie: Movie) => {
        heroAutoSelectDisabled.current = true;
        setSelectedMovie(movie);
        loadMovieDetails(movie.id, movie.media_type || "movie");
    };

    const reportProgress = async (currentTime: number, duration: number) => {
        const stream = activeStreamRef.current;
        const source = selectedSourceRef.current;
        if (!stream || !duration || currentTime < 5) return;

        try {
            const resolvedMediaType = stream.details.media_type || stream.details.mediaType || (stream.tmdbId.startsWith("tv-") ? "tv" : "movie");
            console.log(`[${getSource(source).name}] Progress: ${Math.round(currentTime)}s / ${Math.round(duration)}s (${Math.round((currentTime / duration) * 100)}%)`);
            await fetch(`/api/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tmdbId: stream.tmdbId,
                    mediaType: resolvedMediaType,
                    timestamp: currentTime,
                    duration,
                    source,
                    movieDetails: {
                        id: stream.details.id,
                        title: stream.details.title || stream.details.name || "Untitled",
                        poster_path: stream.details.poster_path,
                        backdrop_path: stream.details.backdrop_path,
                        vote_average: stream.details.vote_average,
                        release_date: stream.details.release_date,
                        media_type: resolvedMediaType
                    }
                })
            });
            fetchUserLists();
        } catch (e) {
            console.error(e);
        }
    };

    const knownOrigins = SOURCES.flatMap((s) => s.origins);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (!knownOrigins.includes(event.origin)) return;

            const stream = activeStreamRef.current;
            if (!stream) return;

            try {
                const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                if (!msg || !msg.data) return;

                const dtype = msg.type;
                const d = msg.data;

                const sourceName = (() => { const s = SOURCES.find((x) => x.origins.includes(event.origin)); return s ? s.name : event.origin; })();
                console.log(`[${sourceName}] Event: ${dtype}${dtype === "PLAYER_EVENT" || dtype === "WATCH_PROGRESS" ? ` (${d.event || d.eventType})` : ""}`);

                let evt: string | undefined;
                let currentTime: number | undefined;
                let duration: number | undefined;
                let mediaId: number | string | undefined;

                if (dtype === "PLAYER_EVENT") {
                    evt = d.event;
                    currentTime = d.currentTime;
                    duration = d.duration;
                    mediaId = d.tmdbId ?? d.mtmdbId ?? d.id;
                } else if (dtype === "WATCH_PROGRESS") {
                    evt = d.eventType;
                    currentTime = d.currentTime;
                    duration = d.duration;
                    mediaId = d.mediaId;
                }

                if (dtype === "MEDIA_DATA") {
                    const entries = Array.isArray(d) ? d : Object.values(d);
                    for (const entry of entries) {
                        if (entry && entry.progress && entry.id && String(entry.id) === String(stream.details?.id)) {
                            currentTime = entry.progress.watched;
                            duration = entry.progress.duration;
                            if (currentTime && duration) {
                                reportProgress(currentTime, duration);
                            }
                            break;
                        }
                    }
                    return;
                }

                if (!evt || currentTime === undefined || !duration) return;
                if (String(mediaId) !== String(stream.details?.id)) return;

                if (evt === "timeupdate" && currentTime >= 0 && duration > 0) {
                    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
                    progressTimeoutRef.current = setTimeout(() => reportProgress(currentTime, duration), 500);
                }

                if (evt === "ended") {
                    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
                    reportProgress(currentTime || duration, duration);
                }
            } catch {
                // ignore parse errors
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    const playMovie = async (
        movie: Movie,
        startTime: number = 0,
        forceSeason?: number,
        forceEpisode?: number,
        sourceOverride?: string
    ) => {
        const isTv = movie.media_type === "tv" || (!selectedShowDetails && movie.media_type === "tv");

        let targetSeason = forceSeason !== undefined ? forceSeason : selectedSeason;
        let targetEpisode = forceEpisode !== undefined ? forceEpisode : selectedEpisode;

        console.log(`[playMovie] isTv=${isTv} movie.id=${movie.id} targetSeason=${targetSeason} targetEpisode=${targetEpisode} startTime=${startTime} sourceOverride=${sourceOverride}`);

        if (isTv && forceSeason === undefined && forceEpisode === undefined) {
            const watchlistId = getWatchlistId(movie);
            if (watchlistId.startsWith("tv-")) {
                const parts = watchlistId.split("-");
                if (parts.length >= 4) {
                    targetSeason = parseInt(parts[2], 10);
                    targetEpisode = parseInt(parts[3], 10);
                }
            }
        }

        if (isTv) {
            setSelectedSeason(targetSeason);
            setSelectedEpisode(targetEpisode);
            if (!selectedShowDetails || selectedShowDetails.id !== movie.id) {
                fetch(`/api/tv/${movie.id}`).then(r => r.json()).then(data => {
                    const tmdbData = data.tmdb || data;
                    setSelectedShowDetails(tmdbData);
                    const seasonObj = tmdbData.seasons ? tmdbData.seasons.find((s: any) => s.season_number === targetSeason) : null;
                    const epCount = seasonObj ? seasonObj.episode_count : 1;
                    setEpisodesList(Array.from({ length: epCount }, (_, i) => i + 1));
                });
            } else {
                const seasons = selectedShowDetails.seasons || selectedShowDetails.tmdb?.seasons;
                const seasonObj = seasons ? seasons.find((s: any) => s.season_number === targetSeason) : null;
                const epCount = seasonObj ? seasonObj.episode_count : 1;
                setEpisodesList(Array.from({ length: epCount }, (_, i) => i + 1));
            }
        }

        let baseTitle = movie.title || movie.name || "Untitled";
        let cleanTitle = baseTitle.replace(/ S\d{2}E\d{2}/g, "").trim();

        if (cleanTitle === "undefined" || cleanTitle === "Untitled") {
            cleanTitle = selectedShowDetails?.name || selectedShowDetails?.title || movie.name || movie.title || "Untitled";
            cleanTitle = cleanTitle.replace(/ S\d{2}E\d{2}/g, "").trim();
        }

        const resolvedTitle = isTv ? `${cleanTitle} S${String(targetSeason).padStart(2, "0")}E${String(targetEpisode).padStart(2, "0")}` : cleanTitle;

        const tmdbId = isTv ? `tv-${movie.id}-${targetSeason}-${targetEpisode}` : String(movie.id);

        setPlayerError(null);

        const effectiveSource = sourceOverride || selectedSource;
        const srcName = getSource(effectiveSource).name;
        const embedUrl = buildEmbedUrl(effectiveSource, movie.id, isTv ? "tv" : "movie", targetSeason, targetEpisode, startTime);
        console.log(`[playMovie] embedUrl=${embedUrl}`);
        console.log(`[${srcName}] Playing ${isTv ? `S${targetSeason}E${targetEpisode}` : ""} ${cleanTitle}`);

        setActiveStream({
            tmdbId,
            title: resolvedTitle,
            details: movie,
            embedUrl
        });
    };

    const changeEpisode = (season: number, episode: number) => {
        if (!activeStream) return;

        setSelectedSeason(season);
        setSelectedEpisode(episode);

        playMovie(activeStream.details, 0, season, episode);
    };

    const handleSeasonChangeInPlayer = (seasonNum: number) => {
        setSelectedSeason(seasonNum);
        const seasonObj = selectedShowDetails?.seasons?.find((s: any) => s.season_number === seasonNum);
        const epCount = seasonObj ? seasonObj.episode_count : 1;
        const newEpList = Array.from({ length: epCount }, (_, i) => i + 1);
        setEpisodesList(newEpList);
        setSelectedEpisode(1);
        changeEpisode(seasonNum, 1);
    };

    const goToPrevEpisode = () => {
        if (selectedEpisode > 1) { changeEpisode(selectedSeason, selectedEpisode - 1); return; }
        const prevSeason = selectedShowDetails?.seasons?.filter((s: any) => s.season_number > 0).find((s: any) => s.season_number === selectedSeason - 1);
        if (prevSeason && prevSeason.episode_count > 0) changeEpisode(prevSeason.season_number, prevSeason.episode_count);
    };

    const goToNextEpisode = () => {
        const seasonObj = selectedShowDetails?.seasons?.find((s: any) => s.season_number === selectedSeason);
        const maxEp = seasonObj?.episode_count || 1;
        if (selectedEpisode < maxEp) { changeEpisode(selectedSeason, selectedEpisode + 1); return; }
        const nextSeason = selectedShowDetails?.seasons?.filter((s: any) => s.season_number > 0).find((s: any) => s.season_number === selectedSeason + 1);
        if (nextSeason && nextSeason.episode_count > 0) changeEpisode(nextSeason.season_number, 1);
    };

    const closePlayer = () => {
        setActiveStream(null);
        setPlayerError(null);
    };

    const handleSourceChange = (newSource: string) => {
        const oldName = getSource(selectedSource).name;
        const newName = getSource(newSource).name;
        console.log(`[Player] Source switch: ${oldName} → ${newName}`);
        setSelectedSource(newSource);
        if (!activeStream) return;
        const isTv = activeStream.details?.media_type === "tv" || activeStream.details?.mediaType === "tv";
        const newUrl = buildEmbedUrl(
            newSource,
            activeStream.details?.id,
            isTv ? "tv" : "movie",
            isTv ? selectedSeason : undefined,
            isTv ? selectedEpisode : undefined
        );
        setActiveStream({ ...activeStream, embedUrl: newUrl });
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    const getPosterUrl = (path: string) =>
        path ? `https://image.tmdb.org/t/p/w500${path}` : "https://via.placeholder.com/500x750?text=No+Poster";

    const getBackdropUrl = (path: string) =>
        path ? `https://image.tmdb.org/t/p/w1280${path}` : "";

    const getCardBackdropUrl = (path: string) =>
        path ? `https://image.tmdb.org/t/p/w500${path}` : "https://via.placeholder.com/500x281?text=No+Preview";

    const getMovieThemeColor = (movie: Movie | null): [number, number, number] => {
        if (!movie) return [0.15, 0.15, 0.18];

        let hash = 0;
        const titleText = movie.title || movie.name || "";
        for (let i = 0; i < titleText.length; i++) {
            hash = titleText.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = Math.abs(hash) % 360;
        const s = 0.35;
        const v = 0.18;

        const c = v * s;
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
        const m = v - c;

        let r = 0, g = 0, b = 0;
        if (hue < 60) { r = c; g = x; }
        else if (hue < 120) { r = x; g = c; }
        else if (hue < 180) { g = c; b = x; }
        else if (hue < 240) { g = x; b = c; }
        else if (hue < 300) { r = x; b = c; }
        else { r = c; b = x; }

        return [r + m, g + m, b + m];
    };

    return (
        <div className="relative h-screen flex flex-col overflow-hidden bg-black select-none text-slate-100">

            {/* ── STICKY TOP AREA (Header + Hero Card) ── never scrolls */}
            <div className="w-full flex-shrink-0 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pt-4 md:pt-0">

                {/* Header — unified single-line sleek navbar (Desktop Only) */}
                <Navbar onSettingsClick={() => setShowSettings(true)} currentPath="/">
                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex items-center justify-end gap-4 flex-1">
                        <div className="relative w-48 md:w-64">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pr-6 py-1 bg-transparent focus:outline-none text-inherit placeholder-slate-600 transition-all duration-300"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setSearchResults([]);
                                        setIsSearching(false);
                                    }}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </form>
                </Navbar>




                {/* Expanded Hero Card Panel */}
                <section className="relative h-[62vh] md:h-[66vh] w-full rounded-2xl overflow-hidden border border-slate-800/40 shadow-2xl bg-[#090b14]/40 backdrop-blur-xl mt-4 md:mt-0">
                    {selectedMovie && (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedMovie.id}
                                className="absolute inset-0 z-0"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <Image
                                    src={getBackdropUrl(selectedMovie.backdrop_path)}
                                    alt={selectedMovie.title || selectedMovie.name || "Movie Backdrop"}
                                    fill
                                    priority
                                    className={`object-cover object-center pointer-events-none transition-opacity duration-1000 ${showHeroTrailer ? 'opacity-0' : 'opacity-100'}`}
                                />
                                {heroTrailerUrl && !activeStream && (
                                    <div className={`absolute inset-0 z-0 bg-black transition-opacity duration-1000 pointer-events-none flex items-center justify-center overflow-hidden ${showHeroTrailer ? 'opacity-100' : 'opacity-0'}`}>
                                        <div className="w-[170%] h-[170%] md:w-[140%] md:h-[140%] relative scale-105 md:scale-110">
                                            <iframe 
                                                key={heroTrailerUrl}
                                                ref={heroIframeRef}
                                                width="100%"
                                                height="100%"
                                                src={`https://www.youtube.com/embed/${heroTrailerUrl.split("v=")[1]}?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&enablejsapi=1&loop=1&playlist=${heroTrailerUrl.split("v=")[1]}`}
                                                allow="autoplay; encrypted-media"
                                                frameBorder="0"
                                                className="w-full h-full pointer-events-none"
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#090b14]/50 via-[#090b14]/20 to-transparent pointer-events-none z-10" />
                                <div className="absolute inset-0 bg-gradient-to-r from-[#090b14]/40 via-[#090b14]/10 to-transparent pointer-events-none z-10" />
                            </motion.div>
                        </AnimatePresence>
                    )}

                    {/* Hero Content Overlay */}
                    <div className="absolute inset-0 z-10 flex flex-col justify-end p-5 md:p-14 gap-3 md:gap-5">
                        {selectedMovie && (
                            <FadeContent key={selectedMovie.id} className="max-w-2xl flex flex-col gap-2 md:gap-4">

                                <div className="mb-1 md:mb-2 max-w-[90vw]">
                                    <VariableProximity text={selectedMovie.title || selectedMovie.name || ""} fromWeight={300} toWeight={800} radius={180} className="text-xl sm:text-2xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight" />
                                </div>

                                {/* Meta details */}
                                <div className="flex items-center gap-3.5 text-xs md:text-sm text-slate-300 font-medium">
                                    <span className="flex items-center gap-1 text-slate-100">
                                        <Star className="w-3.5 h-3.5 fill-white text-white" />
                                        {selectedMovie.vote_average?.toFixed(1) || "n/a"}
                                    </span>
                                    <span>|</span>
                                    <span>{selectedMovie.release_date?.substring(0, 4) || "n/a"}</span>
                                    <span>|</span>
                                    <span className="truncate max-w-[200px] text-slate-400">
                                        {selectedMovie.genres?.map(g => g.name).join(", ") || "Movie"}
                                    </span>
                                    {heroTrailerUrl && (
                                        <>
                                            <span>|</span>
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    const iframe = heroIframeRef.current;
                                                    if (iframe && iframe.contentWindow) {
                                                        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: heroTrailerMuted ? 'unMute' : 'mute', args: [] }), '*');
                                                    }
                                                    setHeroTrailerMuted(!heroTrailerMuted); 
                                                }}
                                                className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors pointer-events-auto"
                                            >
                                                {heroTrailerMuted ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Synopsis */}
                                <p className="text-slate-300 text-[11px] md:text-sm line-clamp-2 md:line-clamp-3 leading-relaxed max-w-xl">
                                    {selectedMovie.overview}
                                </p>



                                {/* Minimalist Action Buttons */}
                                <div className="flex items-center gap-2 md:gap-3.5 mt-1 md:mt-2">
                                    <button
                                        onClick={() => {
                                            if (cwPlayContext && cwPlayContext.movieId === selectedMovie.id) {
                                                const src = cwPlayContext.source && effectiveEnabledSources.includes(cwPlayContext.source)
                                                    ? cwPlayContext.source : defaultSourceRef.current;
                                                if (src) setSelectedSource(src);
                                                playMovie(selectedMovie, cwPlayContext.timestamp, cwPlayContext.season, cwPlayContext.episode, src);
                                            } else {
                                                playMovie(selectedMovie, 0, undefined, undefined, defaultSourceRef.current);
                                            }
                                        }}
                                        className="px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-white hover:bg-slate-200 text-slate-950 font-bold text-[11px] md:text-sm flex items-center gap-1.5 transition-all duration-300 shadow-md active:scale-95"
                                    >
                                        <Play className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                                        {cwPlayContext && cwPlayContext.movieId === selectedMovie.id ? (
                                            <>Resume</>
                                        ) : (
                                            <>Play</>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => toggleWatchlist(selectedMovie)}
                                        className="px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 backdrop-blur-sm text-white font-semibold text-[11px] md:text-sm flex items-center gap-1.5 transition-all duration-300 active:scale-95"
                                    >
                                        {(() => {
                                            const wlId = getWatchlistId(selectedMovie);
                                            return wlId && watchlist.some(item => item.tmdbId === wlId);
                                        })() ? (
                                            <>
                                                <Check className="w-3.5 h-3.5 text-slate-200" /> Watchlist
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-3.5 h-3.5" /> Watchlist
                                            </>
                                        )}
                                    </button>

                                    <div className="ml-2">
                                        <StarRating 
                                            value={ratings[selectedMovie.id]?.rating || 0} 
                                            onChange={(val) => handleRate(selectedMovie, val)} 
                                        />
                                    </div>
                                </div>
                            </FadeContent>
                        )}
                    </div>
                </section>
            </div>

            {/* ── VERTICAL SCROLLABLE BOTTOM AREA ── */}
            <div className="w-full flex-1 overflow-y-auto no-scrollbar z-10 relative mt-3 snap-y snap-mandatory">
                <div className="max-w-[96vw] mx-auto px-6 md:px-12">

                    {/* Search Results */}
                    {isSearching && searchResults.length > 0 && (
                        <div id="search-results-section" className="mb-10 snap-start snap-always scroll-mt-0 pt-4">
                            <h2 className="text-[10px] font-semibold mb-5 tracking-[0.28em] uppercase text-slate-300">
                                Search Results
                            </h2>
                            <ScrollRow>
                                {searchResults.map((movie, index) => (
                                    <div
                                        key={movie.id}
                                        onClick={() => handleCardClick(movie)}
                                        className="flex-none cursor-pointer group snap-start w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]"
                                    >
                                        <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-2 border border-slate-800/40 group-hover:border-white/40 transition-all duration-300 shadow-md bg-slate-950">
                                            <Image
                                                src={getCardBackdropUrl(movie.backdrop_path)}
                                                alt={movie.title || movie.name || "Preview"}
                                                fill
                                                priority={index < 4}
                                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
                                                className="object-cover group-hover:scale-105 transition-all duration-300"
                                            />
                                        </div>
                                        <div className="mt-1.5 text-sm font-light tracking-wide truncate group-hover:text-white transition-colors">
                                            {movie.title || movie.name}
                                        </div>
                                    </div>
                                ))}
                            </ScrollRow>
                        </div>
                    )}

                    <div className="flex flex-col gap-0 pb-32 md:pb-12">

                        {/* Trending */}
                        <FadeContent className="snap-start snap-always scroll-mt-0 pt-8 pb-10">
                            <div className="flex items-center gap-6 mb-5">
                                <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-300">
                                    Trending
                                </h3>
                                <div className="flex items-center gap-3 text-xs font-medium tracking-wider uppercase text-slate-500">
                                    <button
                                        onClick={() => setTrendingType('movie')}
                                        className={`hover:text-slate-300 transition-colors ${trendingType === 'movie' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                                    >
                                        Movies
                                    </button>
                                    <span className="text-slate-700">|</span>
                                    <button
                                        onClick={() => setTrendingType('tv')}
                                        className={`hover:text-slate-300 transition-colors ${trendingType === 'tv' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                                    >
                                        Series
                                    </button>
                                </div>
                            </div>

                            {trending.length > 0 ? (
                                <ScrollRow>
                                    {trending.map((movie, index) => (
                                        <div
                                            key={movie.id}
                                            onClick={() => handleCardClick(movie)}
                                            className="flex-none cursor-pointer group snap-start w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]"
                                        >
                                            <div className={`relative aspect-[16/9] rounded-xl overflow-hidden mb-2 border transition-all duration-300 shadow-md bg-slate-950 ${selectedMovie?.id === movie.id
                                                ? "border-white shadow-[0_0_16px_rgba(255,255,255,0.18)]"
                                                : "border-slate-800/40 group-hover:border-white/40"
                                                }`}>
                                                <Image
                                                    src={getCardBackdropUrl(movie.backdrop_path)}
                                                    alt={movie.title || movie.name || "Preview"}
                                                    fill
                                                    priority={index < 4}
                                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
                                                    className="object-cover group-hover:scale-105 transition-all duration-300"
                                                />
                                            </div>
                                            <div className="mt-1.5 text-sm font-light tracking-wide truncate group-hover:text-white transition-colors">
                                                {movie.title || movie.name}
                                            </div>
                                        </div>
                                    ))}
                                </ScrollRow>
                            ) : (
                                <div className="flex items-center justify-center py-10 w-full">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                                        <div className="text-[9px] font-medium tracking-[0.2em] uppercase text-slate-500">
                                            Loading {trendingType === 'movie' ? 'Movies' : 'Series'}...
                                        </div>
                                    </div>
                                </div>
                            )}
                        </FadeContent>

                        {/* Continue Watching */}
                        {continueWatching.length > 0 && (
                            <FadeContent className="snap-start snap-always scroll-mt-0 pt-8 pb-10">
                                <h3 className="text-[10px] font-semibold mb-5 tracking-[0.28em] uppercase text-slate-300">
                                    Continue Watching
                                </h3>
                                <ScrollRow>
                                    {continueWatching.map((item: any) => {
                                        const percent = Math.min(100, Math.round((item.timestamp / item.duration) * 100));
                                        return (
                                        <div
                                            key={item.tmdbId}
                                            className="flex-none group cursor-pointer snap-start w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]"
                                            onClick={() => {
                                                const mt = item.mediaType || item.movieDetails?.media_type || "movie";
                                                let src = item.source;
                                                if (src && !effectiveEnabledSources.includes(src)) {
                                                    console.log(`[Continue Watching] Saved source ${getSource(src).name} is disabled, falling back to default`);
                                                    src = effectiveSource;
                                                }
                                                if (src) { console.log(`[Continue Watching] Resuming with source: ${getSource(src).name}`); setSelectedSource(src); }
                                                let parsedMovieId = item.movieDetails?.id;
                                                let fs: number | undefined;
                                                let fe: number | undefined;
                                                if (item.tmdbId?.startsWith("tv-")) {
                                                    const parts = item.tmdbId.split("-");
                                                    if (parts.length >= 2) {
                                                        const maybeId = parseInt(parts[1], 10);
                                                        if (!isNaN(maybeId)) parsedMovieId = maybeId;
                                                    }
                                                    if (parts.length >= 4) {
                                                        fs = parseInt(parts[2], 10);
                                                        fe = parseInt(parts[3], 10);
                                                    }
                                                }
                                                if (!fs || isNaN(fs)) fs = 1;
                                                if (!fe || isNaN(fe)) fe = 1;
                                                const cwMovie = { ...item.movieDetails, id: parsedMovieId, media_type: mt };
                                                console.log(`[Continue Watching] ${item.tmdbId} parsedMovieId=${parsedMovieId} fs=${fs} fe=${fe} mt=${mt} src=${src}`);
                                                playMovie(cwMovie, item.timestamp, fs, fe, src);
                                            }}
                                            >
                                                <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-slate-800/50 group-hover:border-white/40 transition-all duration-300 bg-slate-950 shadow-md">
                                                    {item.movieDetails?.backdrop_path ? (
                                                        <Image
                                                            src={getBackdropUrl(item.movieDetails.backdrop_path)}
                                                            alt={item.movieDetails.title}
                                                            fill
                                                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
                                                            className="object-cover brightness-90 group-hover:brightness-100 transition-all duration-300"
                                                        />
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center text-slate-600 bg-slate-950">
                                                            <Film className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black">
                                                            <Play className="w-3.5 h-3.5 fill-black pl-0.5" />
                                                        </div>
                                                    </div>
                                                    <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-850">
                                                        <div className="h-full bg-white" style={{ width: `${percent}%` }} />
                                                    </div>
                                                </div>
                                                <div className="mt-1.5 text-sm font-light tracking-wide truncate group-hover:text-white transition-colors">
                                                    {item.movieDetails?.title || "Unknown Title"}
                                                    {item.tmdbId?.startsWith("tv-") && (() => {
                                                        const parts = item.tmdbId.split("-");
                                                        if (parts.length >= 4) {
                                                            const s = String(parts[2]).padStart(2, "0");
                                                            const e = String(parts[3]).padStart(2, "0");
                                                            return <span className="text-[9px] text-slate-500 tracking-wider ml-2">S{s} E{e}</span>;
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                                <div className="text-[9px] text-slate-500 font-medium">
                                                    {percent}% completed
                                                </div>
                                            </div>
                                        );
                                    })}
                                </ScrollRow>
                            </FadeContent>
                        )}

                        {/* Watchlist */}
                        {(() => {
                            const filteredWatchlist = watchlist.filter((item: any) => watchlistFilter === "all" || item.mediaType === watchlistFilter);
                            return filteredWatchlist.length > 0 && (
                            <FadeContent className="snap-start snap-always scroll-mt-0 pt-8 pb-10">
                                <div className="flex items-center gap-6 mb-5">
                                    <h3 className="text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-300">
                                        Watchlist
                                    </h3>
                                    <div className="flex items-center gap-3 text-xs font-medium tracking-wider uppercase text-slate-500">
                                        <button
                                            onClick={() => setWatchlistFilter('all')}
                                            className={`hover:text-slate-300 transition-colors ${watchlistFilter === 'all' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                                        >
                                            All
                                        </button>
                                        <span className="text-slate-700">|</span>
                                        <button
                                            onClick={() => setWatchlistFilter('movie')}
                                            className={`hover:text-slate-300 transition-colors ${watchlistFilter === 'movie' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                                        >
                                            Movies
                                        </button>
                                        <span className="text-slate-700">|</span>
                                        <button
                                            onClick={() => setWatchlistFilter('tv')}
                                            className={`hover:text-slate-300 transition-colors ${watchlistFilter === 'tv' ? 'text-white cursor-default' : 'cursor-pointer'}`}
                                        >
                                            Series
                                        </button>
                                    </div>
                                </div>
                                <ScrollRow>
                                    {filteredWatchlist.map((item: any) => (
                                        <div
                                            key={item.tmdbId}
                                            onClick={() => {
                                                const mt = item.mediaType || item.movieDetails?.media_type || "movie";
                                                handleCardClick({ ...item.movieDetails, media_type: mt });
                                            }}
                                            className="flex-none cursor-pointer group snap-start w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]"
                                        >
                                            <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-2 border border-slate-800/40 group-hover:border-white/40 transition-all duration-300 shadow-md bg-slate-950">
                                                <Image
                                                    src={getCardBackdropUrl(item.movieDetails.backdrop_path)}
                                                    alt={item.movieDetails.title || item.movieDetails.name || "Preview"}
                                                    fill
                                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
                                                    className="object-cover group-hover:scale-105 transition-all duration-300"
                                                />
                                            </div>
                                            <div className="mt-1.5 text-sm font-light tracking-wide truncate group-hover:text-white transition-colors">
                                                {item.movieDetails.title || item.movieDetails.name}
                                            </div>
                                        </div>
                                    ))}
                                </ScrollRow>
                            </FadeContent>
                        );
                    })()}




                    </div>
                </div>
            </div>

            {/* ── VIDEO PLAYER MODAL OVERLAY ── */}
            <AnimatePresence>
                {activeStream && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex flex-col items-center justify-start md:justify-center p-4 pt-10 pb-20 md:p-6 backdrop-blur-3xl overflow-y-auto w-full h-full"
                    >
                        {/* Player Header */}
                        <div className="w-full max-w-7xl flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base md:text-lg font-light tracking-wide text-white/95 flex items-center gap-2">
                                    <ScrambledText text={activeStream.title} />
                                </h2>
                            </div>
                            <div>
                                <button
                                    onClick={closePlayer}
                                    className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95 duration-200 cursor-pointer"
                                >
                                    <X className="w-4.5 h-4.5" />
                                </button>
                            </div>
                        </div>

                        {/* Split Screen Player + Glassmorphic Sidebar Layout */}
                        <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch justify-center h-auto lg:h-[62vh] xl:h-[66vh]">

                            {/* Left Column: VidKing Embed */}
                            <div ref={playerContainerRef} className="flex-none md:flex-grow w-full lg:w-[72%] aspect-video lg:aspect-auto relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-2xl">
                                {activeStream?.embedUrl && (
                                    <iframe
                                        ref={playerRef}
                                        src={activeStream.embedUrl}
                                        className="w-full h-full"
                                        allow="autoplay; fullscreen"
                                        allowFullScreen
                                    />
                                )}
                                {playerError && (
                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center gap-4 bg-black/80">
                                        <div className="flex flex-col items-center gap-3 text-rose-500">
                                            <AlertCircle className="w-10 h-10 stroke-[1.5]" />
                                            <div className="text-white/90 font-light tracking-wider text-sm">Playback Error</div>
                                            <div className="text-xs text-white/50 max-w-md font-light">{playerError}</div>
                                            <button
                                                onClick={closePlayer}
                                                className="px-5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/95 rounded-full mt-2 text-xs font-medium active:scale-95 transition-all cursor-pointer"
                                            >
                                                Go Back
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Glassmorphic Sidebar */}
                            <GlassSurface className="w-full lg:w-80 xl:w-96 p-5 flex flex-col gap-6 !border-white/[0.03] !bg-transparent !backdrop-blur-none h-auto max-h-[70vh] lg:max-h-full overflow-y-auto no-scrollbar rounded-2xl !shadow-none">

                                {/* Source Selector */}
                                <div className="flex flex-col gap-2 pb-4 border-b border-white/[0.05]">
                                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1">Source</span>
                                    <CustomSelect
                                        value={effectiveSource}
                                        onChange={(val: string) => handleSourceChange(val)}
                                        options={SOURCES.filter((s) => effectiveEnabledSources.includes(s.id)).map((s) => ({ value: s.id, label: s.name }))}
                                    />
                                </div>

                                {/* Rating System */}
                                <div className="flex flex-col gap-3 pb-4 border-b border-white/[0.05]">
                                    <VariableProximity
                                        text="Rate Title"
                                        fromWeight={400}
                                        toWeight={800}
                                        radius={80}
                                        className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1"
                                    />
                                    <StarRating 
                                        value={ratings[activeStream.details?.id]?.rating || 0} 
                                        onChange={(val) => activeStream.details && handleRate(activeStream.details, val)} 
                                    />
                                </div>

                                {/* TV Season/Episode Selector */}
                                {selectedShowDetails && (
                                    <div className="flex flex-col gap-3 pb-4 border-b border-white/[0.05]">
                                        <VariableProximity
                                            text="TV Episode Control"
                                            fromWeight={400}
                                            toWeight={800}
                                            radius={80}
                                            className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1"
                                        />
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[8px] font-medium uppercase tracking-[0.15em] text-white/30 mb-0.5">Season</span>
                                                <CustomSelect
                                                    value={selectedSeason}
                                                    onChange={(val: number) => handleSeasonChangeInPlayer(val)}
                                                    options={selectedShowDetails.seasons?.filter((s: any) => s.season_number > 0).map((s: any) => ({ value: s.season_number, label: s.name || `Season ${s.season_number}` })) || []}
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <span className="text-[8px] font-medium uppercase tracking-[0.15em] text-white/30 mb-0.5">Episode</span>
                                                <CustomSelect
                                                    value={selectedEpisode}
                                                    onChange={(val: number) => changeEpisode(selectedSeason, val)}
                                                    options={episodesList.map(epNum => ({ value: epNum, label: `Episode ${epNum}` }))}
                                                />
                                            </div>
                                        </div>

                                        {/* Prev/Next Navigation */}
                                        <div className="flex items-center justify-between gap-2 mt-1">
                                            <button
                                                onClick={goToPrevEpisode}
                                                disabled={selectedEpisode <= 1 && (!selectedShowDetails?.seasons?.some((s: any) => s.season_number === selectedSeason - 1))}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/10 disabled:opacity-25 disabled:cursor-not-allowed text-white/70 hover:text-white text-xs transition-all active:scale-95"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5" /> Prev
                                            </button>
                                            <span className="text-[10px] text-white/30 font-mono tracking-wider">
                                                S{String(selectedSeason).padStart(2, "0")} E{String(selectedEpisode).padStart(2, "0")}
                                            </span>
                                            <button
                                                onClick={goToNextEpisode}
                                                disabled={selectedEpisode >= (selectedShowDetails?.seasons?.find((s: any) => s.season_number === selectedSeason)?.episode_count || 1) && (!selectedShowDetails?.seasons?.some((s: any) => s.season_number === selectedSeason + 1))}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/10 disabled:opacity-25 disabled:cursor-not-allowed text-white/70 hover:text-white text-xs transition-all active:scale-95"
                                            >
                                                Next <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                            </GlassSurface>

                        </div>


                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Bottom Navigation */}
            {!activeStream && (
                <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-[400px]">
                    <nav className="flex items-center justify-between px-6 py-4 rounded-full bg-[#090b14]/70 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">

                    {/* Home */}
                    <Link href="/" className="flex flex-col items-center gap-1 text-slate-200">
                        <HomeIcon className="w-5 h-5" />
                    </Link>

                    {/* Log */}
                    <Link href="/log" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200">
                        <List className="w-5 h-5" />
                    </Link>

                    {/* Search Toggle */}
                    <button onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200">
                        <Search className="w-5 h-5" />
                    </button>

                    {/* Settings */}
                    <button onClick={() => setShowSettings(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200">
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                </nav>
                
                {/* Mobile Search Input Overlay */}
                <AnimatePresence>
                    {isMobileSearchOpen && (
                        <motion.form 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            onSubmit={(e) => { handleSearch(e); setIsMobileSearchOpen(false); }}
                            className="absolute bottom-full mb-4 left-0 w-full"
                        >
                            <input
                                type="text"
                                placeholder="Search movies..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-6 py-4 rounded-3xl bg-[#090b14]/90 backdrop-blur-2xl border border-white/10 text-sm focus:outline-none focus:border-white/20 text-white placeholder-slate-500 shadow-2xl"
                                autoFocus
                            />
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>
            )}

            {/* ── SETTINGS OVERLAY ── */}
            <SettingsOverlay isOpen={showSettings} onClose={() => setShowSettings(false)} onSourcesChange={onSourcesChange} />

        </div>
    );
}

function CustomSelect({ value, onChange, options, className = "" }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find((o: any) => o.value === value) || options[0];

    return (
        <div ref={ref} className={`relative flex flex-col w-full ${className}`}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 cursor-pointer transition-all duration-200"
            >
                <span className="truncate">{selectedOption?.label || "Select..."}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0b0c10] border border-white/10 rounded-xl overflow-hidden z-[100] shadow-2xl max-h-48 overflow-y-auto no-scrollbar">
                    {options.map((opt: any) => (
                        <div
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`px-3 py-2 text-xs cursor-pointer transition-colors ${value === opt.value ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0);

    return (
        <div className="flex items-center gap-1 w-fit transition-all duration-300">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChange(star); }}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                >
                    <Star
                        className={`w-3.5 h-3.5 transition-all duration-300 ${
                            star <= (hover || value) ? "fill-slate-300 text-slate-300 drop-shadow-[0_0_6px_rgba(203,213,225,0.4)]" : "text-white/20"
                        }`}
                    />
                </button>
            ))}
        </div>
    );
}
