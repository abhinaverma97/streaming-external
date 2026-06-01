"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
    Play,
    Plus,
    Check,
    Star,
    Clock,
    Search,
    TrendingUp,
    Sliders,
    X,
    Loader2,
    Film,
    AlertCircle,
    Upload,
    Download,
    ChevronDown,
    Home as HomeIcon,
    List,
    Trash2,
    Volume2,
    VolumeX,
    Maximize,
    Minimize
} from "lucide-react";
import Hls from "hls.js";


import VariableProximity from "./components/VariableProximity";
import ScrambledText from "./components/ScrambledText";
import GlassSurface from "./components/GlassSurface";
import FadeContent from "./components/FadeContent";
import Dither from "./components/Dither";
import ScrollRow from "./components/ScrollRow";


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Movie {
    id: number;
    imdb_id?: string;
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

    // Torrent quality and selections states
    const [selectedMovieTorrents, setSelectedMovieTorrents] = useState<any[]>([]);
    const [availableTorrents, setAvailableTorrents] = useState<any[]>([]);
    const [activeTorrentHash, setActiveTorrentHash] = useState<string | null>(null);
    const [isQualityExpanded, setIsQualityExpanded] = useState(true);

    // Storage stats states
    const [storageStats, setStorageStats] = useState<{ totalBytes: number; movies: any[] } | null>(null);

    // HLS Audio tracks states
    const [audioTracks, setAudioTracks] = useState<any[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(0);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [sourceDuration, setSourceDuration] = useState<number | null>(null);
    const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
    const [playerPaused, setPlayerPaused] = useState(true);
    const [uiVisible, setUiVisible] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [seekOffset, setSeekOffset] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [frozenFrame, setFrozenFrame] = useState<string | null>(null);
    const hideTimerRef = useRef<any>(null);
    const seekingRef = useRef(false);
    const seekDurRef = useRef(0);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Movie[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    // Active streaming state
    const [activeStream, setActiveStream] = useState<{
        imdbId: string;
        title: string;
        details: any;
        hlsUrl?: string;
    } | null>(null);
    const [videoQuality, setVideoQuality] = useState("");
    const [hlsReadyUrl, setHlsReadyUrl] = useState<string | null>(null);
    const [probingCodecs, setProbingCodecs] = useState(false);
    const [hlsErrorMsg, setHlsErrorMsg] = useState<string | null>(null);

    const [subtitleCues, setSubtitleCues] = useState<{start: number; end: number; text: string}[]>([]);
    const [subtitleName, setSubtitleName] = useState("");

    // Active stream status indicators (peers, speed, etc)
    const [torrentStatus, setTorrentStatus] = useState<any>(null);

    const [torrentSubs, setTorrentSubs] = useState<any[]>([]);

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

    // Video Ref & status polls
    const videoRef = useRef<HTMLVideoElement>(null);
    const heroIframeRef = useRef<HTMLIFrameElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const progressIntervalRef = useRef<any>(null);
    const statusIntervalRef = useRef<any>(null);
    const subsPollIntervalRef = useRef<any>(null);
    const playerListenersCleanupRef = useRef<(() => void) | null>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);

    const showUi = () => {
        setUiVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setUiVisible(false), 3000);
    };

    const formatTime = (t: number) => {
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`;
    };

    useEffect(() => {

        fetchUserLists();
        fetchStorageStats();

        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFsChange);

        // Suppress harmless AbortError from Hls.js destroying the video fetch
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            if (event.reason && event.reason.name === 'AbortError') {
                event.preventDefault();
            }
        };
        window.addEventListener("unhandledrejection", handleUnhandledRejection);
        return () => {
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
            document.removeEventListener("fullscreenchange", onFsChange);
        };
    }, []);

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const endpoint = trendingType === "movie" ? "movies" : "tv";
                const res = await fetch(`${API_BASE}/api/${endpoint}/trending`);
                const data = await res.json();
                const trendingItems = (data.results || []).map((m: any) => ({ ...m, media_type: m.media_type || trendingType }));
                setTrending(trendingItems);

                if (trendingItems.length > 0) {
                    loadMovieDetails(trendingItems[0].id, trendingType);
                }
            } catch (e) {
                console.error("Error loading trending", e);
            }
        };
        fetchTrending();
    }, [trendingType]);



    const fetchUserLists = async () => {
        try {
            const [watchRes, contRes, histRes, ratingsRes] = await Promise.all([
                fetch(`${API_BASE}/api/watchlist`),
                fetch(`${API_BASE}/api/continue-watching`),
                fetch(`${API_BASE}/api/history`),
                fetch(`${API_BASE}/api/ratings`)
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
            await fetch(`${API_BASE}/api/ratings/${movie.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, movieDetails: movie })
            });
        } catch (e) {
            console.error("Error saving rating", e);
        }
    };

    const fetchStorageStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/storage`);
            if (res.ok) {
                setStorageStats(await res.json());
            }
        } catch (e) {
            console.error("Error fetching storage stats", e);
        }
    };

    const handleDeleteAllStorage = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/storage/all`, { method: "DELETE" });
            if (res.ok) {
                fetchStorageStats();
                fetchUserLists();
            }
        } catch (e) {
            console.error("Error clearing storage", e);
        }
    };

    const formatStorageSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    };

    const formatSpeed = (bytes: number) => {
        if (!bytes || bytes === 0) return "0 B/s";
        const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    };

    const loadMovieDetails = async (tmdbId: number, mediaType: string = "movie") => {
        try {
            setHeroTrailerUrl(null);
            if (mediaType === "tv") {
                const res = await fetch(`${API_BASE}/api/tv/${tmdbId}`);
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
                    setSelectedMovieTorrents([]);

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
                const res = await fetch(`${API_BASE}/api/movie/${tmdbId}`);
                const data = await res.json();
                if (data.tmdb) {
                    setSelectedMovie({ ...data.tmdb, media_type: "movie" });
                    setSelectedShowDetails(null);
                    setSelectedMovieTorrents(data.yts?.torrents || []);

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
        return movie.imdb_id || (movie.media_type === "tv" ? `tv-${movie.id}` : null);
    };

    const toggleWatchlist = async (movie: Movie) => {
        const watchlistId = getWatchlistId(movie);
        if (!watchlistId) return;
        const isQueued = watchlist.some((item) => item.imdbId === watchlistId);
        try {
            if (isQueued) {
                await fetch(`${API_BASE}/api/watchlist/${watchlistId}`, { method: "DELETE" });
            } else {
                await fetch(`${API_BASE}/api/watchlist`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        imdbId: watchlistId,
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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`);
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
    };

    // ── Playback / Streaming ──────────────────────────────────────────────────

    const handleCardClick = (movie: Movie) => {
        setSelectedMovie(movie);
        loadMovieDetails(movie.id, movie.media_type || "movie");
    };

    const triggerAudioTracksFetch = (sessionId: string) => {
        setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/stream/${sessionId}/audio-tracks`);
                if (res.ok) {
                    const tracks = await res.json();
                    setAudioTracks(tracks);
                }
            } catch (e) {
                console.error("Error fetching audio tracks", e);
            }
        }, 3500);
    };

    const changeAudioTrack = async (trackId: number) => {
        if (!activeSessionId || !videoRef.current) return;
        const video = videoRef.current;
        const currentTime = video.currentTime;
        const isPaused = video.paused;

        setProbingCodecs(true);
        setHlsReadyUrl(null);
        setCurrentAudioTrack(trackId);

        const newUrl = `${API_BASE}/api/stream/${activeSessionId}/hls/index.m3u8?audioTrack=${trackId}`;
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        for (let i = 0; i < 30; i++) {
            try {
                const res = await fetch(newUrl, { cache: "no-store" });
                if (res.ok) {
                    const contentType = res.headers.get("content-type") || "";
                    if (contentType.includes("application/vnd.apple.mpegurl")) {
                        setHlsReadyUrl(newUrl);
                        setProbingCodecs(false);

                        if (hlsRef.current) {
                            hlsRef.current.destroy();
                        }

                        const handleLoadedMetadata = () => {
                            video.currentTime = currentTime;
                            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
                            if (!isPaused) {
                                video.play().catch(() => { });
                            }
                        };
                        video.addEventListener("loadedmetadata", handleLoadedMetadata);

                        if (Hls.isSupported()) {
                            const hls = new Hls({
                                maxBufferLength: 30,
                                maxBufferSize: 60 * 1000 * 1000
                            });
                            hlsRef.current = hls;
                            hls.loadSource(newUrl);
                            hls.attachMedia(video);
                        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                            video.src = newUrl;
                        }
                        return;
                    }
                }
            } catch (e) { }
            await sleep(1000);
        }

        setHlsErrorMsg("HLS playlist generation timed out for new audio track.");
        setProbingCodecs(false);
    };

    const playMovie = async (
        movie: Movie,
        startTime: number = 0,
        selectedTorrent?: { hash: string; quality: string },
        forceSeason?: number,
        forceEpisode?: number
    ) => {
        const isTv = movie.media_type === "tv" || (!movie.imdb_id && selectedShowDetails);

        let targetSeason = forceSeason !== undefined ? forceSeason : selectedSeason;
        let targetEpisode = forceEpisode !== undefined ? forceEpisode : selectedEpisode;

        if (isTv && movie.imdb_id && movie.imdb_id.startsWith("tv-") && forceSeason === undefined && forceEpisode === undefined) {
            const parts = movie.imdb_id.split("-");
            if (parts.length >= 4) {
                targetSeason = parseInt(parts[2], 10);
                targetEpisode = parseInt(parts[3], 10);
            }
        }

        if (isTv) {
            setSelectedSeason(targetSeason);
            setSelectedEpisode(targetEpisode);
            if (!selectedShowDetails || selectedShowDetails.id !== movie.id) {
                fetch(`${API_BASE}/api/tv/${movie.id}`).then(r => r.json()).then(data => {
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
        
        // Retroactive fix for database corruption where title was saved as literal "undefined S01E01"
        if (cleanTitle === "undefined" || cleanTitle === "Untitled") {
            cleanTitle = selectedShowDetails?.name || selectedShowDetails?.title || movie.name || movie.title || "Untitled";
            cleanTitle = cleanTitle.replace(/ S\d{2}E\d{2}/g, "").trim();
        }

        const resolvedTitle = isTv ? `${cleanTitle} S${String(targetSeason).padStart(2, "0")}E${String(targetEpisode).padStart(2, "0")}` : cleanTitle;

        setActiveStream({
            imdbId: movie.imdb_id || `tv-${movie.id}-${targetSeason}-${targetEpisode}`,
            title: resolvedTitle,
            details: movie
        });

        setProbingCodecs(true);
        setHlsReadyUrl(null);
        setHlsErrorMsg(null);
        setTorrentStatus(null);
        setTorrentSubs([]);
        setSubtitleCues([]);
        setSubtitleName("");

        try {
            let hash = "";
            let title = "";
            let torrentsList: any[] = [];

            if (isTv) {
                const epRes = await fetch(`${API_BASE}/api/tv/${movie.id}/season/${targetSeason}/episode/${targetEpisode}`);
                const epData = await epRes.json();
                torrentsList = epData.yts?.torrents || [];
                setAvailableTorrents(torrentsList);

                if (torrentsList.length === 0) {
                    throw new Error("No torrents found for this episode.");
                }

                let selected = torrentsList[0];
                if (selectedTorrent) {
                    selected = torrentsList.find((t: any) => t.hash === selectedTorrent.hash) || selected;
                } else if (videoQuality) {
                    selected = torrentsList.find((t: any) => t.quality.toLowerCase().includes(videoQuality.toLowerCase())) || selected;
                }

                hash = selected.hash;
                title = selected.quality;
            } else {
                let torrents = selectedMovieTorrents;
                // Fetch new torrents if we're clicking a card that isn't the currently selected hero movie
                if (selectedMovie?.id !== movie.id || torrents.length === 0) {
                    const res = await fetch(`${API_BASE}/api/movie/${movie.id}`);
                    const data = await res.json();
                    torrents = data.yts?.torrents || [];
                    if (selectedMovie?.id === movie.id) {
                        setSelectedMovieTorrents(torrents);
                    }
                }
                torrentsList = torrents;
                setAvailableTorrents(torrentsList);

                if (torrentsList.length === 0) {
                    throw new Error("No torrents found for this movie.");
                }

                let selected = torrentsList[0];
                if (selectedTorrent) {
                    selected = torrentsList.find((t: any) => t.hash === selectedTorrent.hash) || selected;
                } else if (videoQuality) {
                    selected = torrentsList.find((t: any) => t.quality.toLowerCase().includes(videoQuality.toLowerCase())) || selected;
                }

                hash = selected.hash;
                title = selected.quality;
            }

            if (hash === activeTorrentHash && activeSessionId) {
                if (startTime > 0 && videoRef.current) {
                    const relativeSeek = startTime - seekOffset;
                    videoRef.current.currentTime = relativeSeek >= 0 ? relativeSeek : startTime;
                }
                return;
            }

            setSeekOffset(0);
            setActiveTorrentHash(hash);

            const body: any = {
                hash,
                title
            };

            const startRes = await fetch(`${API_BASE}/api/stream/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const startData = await startRes.json();

            if (startRes.ok && startData.hlsUrl) {
                setActiveSessionId(startData.sessionId);
                if (startData.sourceDuration) {
                    setSourceDuration(startData.sourceDuration);
                }
                pollHlsReady(API_BASE + startData.hlsUrl, startData.sessionId, startTime);
                triggerAudioTracksFetch(startData.sessionId);
                
                // Fetch local subs from torrent and poll download status
                const fetchSubs = () => {
                    fetch(`${API_BASE}/api/stream/${startData.sessionId}/subs`)
                        .then(res => res.json())
                        .then(subs => setTorrentSubs(subs || []))
                        .catch(() => {});
                };
                fetchSubs();
                if (subsPollIntervalRef.current) clearInterval(subsPollIntervalRef.current);
                subsPollIntervalRef.current = setInterval(fetchSubs, 2000);
            } else {
                throw new Error(startData.error || "Failed to start HLS session");
            }
        } catch (err: any) {
            setHlsErrorMsg(err.message || "Error starting stream");
            setProbingCodecs(false);
        }
    };

    const changeTorrentQuality = async (torrent: any) => {
        if (!activeStream) return;
        const video = videoRef.current;
        const absTime = video ? (seekOffset + video.currentTime) : 0;

        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        playMovie(activeStream.details, absTime, { hash: torrent.hash, quality: torrent.quality });
    };

    const changeEpisode = async (season: number, episode: number) => {
        if (!activeStream) return;

        // Stop current stream
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        // Update state first
        setSelectedSeason(season);
        setSelectedEpisode(episode);

        // Call playMovie with startTime = 0 and force the season/episode
        playMovie(activeStream.details, 0, undefined, season, episode);
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

    const pollHlsReady = async (hlsUrl: string, sessionId: string, startTime: number) => {
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        startTorrentStatusPolling(sessionId);

        // If resuming past the start, restart ffmpeg at the target position
        // so Hls.js doesn't have to wait for segments from byte 0
        let effectiveUrl = hlsUrl;
        let adjustedStart = startTime;
        if (startTime > 0) {
            try {
                const seekUrl = `${hlsUrl}?audioTrack=${currentAudioTrack}&startTime=${startTime}`;
                await fetch(`${API_BASE}/api/stream/${sessionId}/seek`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ time: startTime, audioTrack: currentAudioTrack })
                });
                for (let i = 0; i < 120; i++) {
                    try {
                        const res = await fetch(seekUrl, { cache: "no-store" });
                        if (res.ok) {
                            const ct = res.headers.get("content-type") || "";
                            if (ct.includes("application/vnd.apple.mpegurl")) {
                                await sleep(2000);
                                setSeekOffset(startTime);
                                effectiveUrl = seekUrl;
                                adjustedStart = 0;
                                break;
                            }
                        }
                    } catch (e) {}
                    await sleep(1000);
                }
            } catch (e) {
                // fall through — try loading from start, adjustedStart stays as startTime
            }
        }

        // Poll for the playlist (seeked or from start)
        for (let i = 0; i < 90; i++) {
            try {
                const res = await fetch(effectiveUrl, { cache: "no-store" });
                if (res.ok) {
                    const contentType = res.headers.get("content-type") || "";
                    if (contentType.includes("application/vnd.apple.mpegurl")) {
                        await sleep(4000); 
                        setHlsReadyUrl(effectiveUrl);
                        setProbingCodecs(false);
                        setTimeout(() => {
                            initializeVideoPlayer(effectiveUrl, adjustedStart);
                        }, 100);
                        return;
                    }
                }
            } catch (e) {
                // ignore
            }
            await sleep(1000);
        }

        setHlsErrorMsg("HLS playlist generation timed out. Ensure ffmpeg is installed.");
        setProbingCodecs(false);
    };

    const initializeVideoPlayer = (url: string, startTime: number) => {
        const video = videoRef.current;
        if (!video) return;

        if (hlsRef.current) {
            hlsRef.current.destroy();
        }

        if (playerListenersCleanupRef.current) {
            playerListenersCleanupRef.current();
            playerListenersCleanupRef.current = null;
        }

        const onTimeUpdate = () => setPlayerCurrentTime(video.currentTime);
        const onPlay = () => setPlayerPaused(false);
        const onPause = () => setPlayerPaused(true);

        video.addEventListener("timeupdate", onTimeUpdate);
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);

        playerListenersCleanupRef.current = () => {
            video.removeEventListener("timeupdate", onTimeUpdate);
            video.removeEventListener("play", onPlay);
            video.removeEventListener("pause", onPause);
        };

        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxBufferSize: 60 * 1000 * 1000
            });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (startTime > 0) {
                    video.currentTime = startTime;
                }
                video.play().catch(() => { });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            setHlsErrorMsg(`Playback error: ${data.details}`);
                            hls.destroy();
                            break;
                    }
                }
            });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            video.addEventListener("loadedmetadata", () => {
                if (startTime > 0) {
                    video.currentTime = startTime;
                }
                video.play().catch(() => { });
            });
        }

        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = setInterval(reportProgress, 5000);
    };

    const reportProgress = async () => {
        const video = videoRef.current;
        if (!video || !activeStream) return;
        const timestamp = seekOffset + video.currentTime;
        const duration = sourceDuration || video.duration;
        if (!duration || isNaN(duration) || timestamp < 5) return;

        try {
            const resolvedMediaType = activeStream.details.media_type || activeStream.details.mediaType || (activeStream.imdbId.startsWith("tv-") ? "tv" : "movie");
            await fetch(`${API_BASE}/api/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imdbId: activeStream.imdbId,
                    mediaType: resolvedMediaType,
                    sessionId: activeSessionId,
                    timestamp,
                    duration,
                    movieDetails: {
                        id: activeStream.details.id,
                        title: activeStream.details.title || activeStream.details.name || "Untitled",
                        poster_path: activeStream.details.poster_path,
                        backdrop_path: activeStream.details.backdrop_path,
                        vote_average: activeStream.details.vote_average,
                        release_date: activeStream.details.release_date,
                        imdb_id: activeStream.details.imdb_id || activeStream.imdbId,
                        media_type: resolvedMediaType
                    }
                })
            });
            fetchUserLists();
        } catch (e) {
            console.error(e);
        }
    };

    const seekTo = async (frac: number) => {
        if (!activeSessionId || !seekDurRef.current || seekingRef.current) return;
        const targetTime = frac * seekDurRef.current;
        if (targetTime < 0) return;

        const video = videoRef.current;

        // Fast path: if target is within buffered range, seek natively
        if (video && video.buffered.length > 0) {
            const relativeTarget = targetTime - seekOffset;
            for (let i = 0; i < video.buffered.length; i++) {
                if (relativeTarget >= video.buffered.start(i) && relativeTarget <= video.buffered.end(i)) {
                    video.currentTime = relativeTarget;
                    return;
                }
            }
        }

        seekingRef.current = true;
        setIsSeeking(true);
        setHlsReadyUrl(null);
        setProbingCodecs(true);

        // Freeze last frame before destroying Hls.js
        if (video) {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 360;
                canvas.getContext("2d")?.drawImage(video, 0, 0);
                setFrozenFrame(canvas.toDataURL());
            } catch (e) {}
        }

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        const hlsUrl = `${API_BASE}/api/stream/${activeSessionId}/hls/index.m3u8?audioTrack=${currentAudioTrack}&startTime=${targetTime}`;

        try {
            await fetch(`${API_BASE}/api/stream/${activeSessionId}/seek`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ time: targetTime, audioTrack: currentAudioTrack })
            });

            for (let i = 0; i < 120; i++) {
                try {
                    const res = await fetch(hlsUrl, { cache: "no-store" });
                    if (res.ok) {
                        const ct = res.headers.get("content-type") || "";
                        if (ct.includes("application/vnd.apple.mpegurl")) {
                            await sleep(2000);
                            setSeekOffset(targetTime);
                            setFrozenFrame(null);
                            setHlsReadyUrl(hlsUrl);
                            setProbingCodecs(false);
                            setIsSeeking(false);

                            if (videoRef.current) {
                                if (Hls.isSupported()) {
                                    const hls = new Hls({ maxBufferLength: 30, maxBufferSize: 60 * 1000 * 1000 });
                                    hlsRef.current = hls;
                                    hls.loadSource(hlsUrl);
                                    hls.attachMedia(videoRef.current);
                                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                        videoRef.current!.currentTime = 0;
                                        videoRef.current?.play().catch(() => {});
                                    });
                                } else {
                                    videoRef.current.src = hlsUrl;
                                    videoRef.current.play().catch(() => {});
                                }
                            }
                            seekingRef.current = false;
                            return;
                        }
                    }
                } catch (e) {}
                await sleep(1000);
            }
        } catch (e) {}

        setHlsErrorMsg("Seek timed out");
        setProbingCodecs(false);
        setIsSeeking(false);
        seekingRef.current = false;
    };

    const startTorrentStatusPolling = (sessionId: string) => {
        if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
        const fetchStatus = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/stream/${sessionId}/status`);
                if (res.ok) {
                    const data = await res.json();
                    setTorrentStatus(data);
                    if (data.sourceDuration) {
                        setSourceDuration(data.sourceDuration);
                    }
                }
            } catch (e) {
                // ignore
            }
        };
        statusIntervalRef.current = setInterval(fetchStatus, 1500);
        fetchStatus();
    };



    const parseSubtitleText = (text: string): {start: number; end: number; text: string}[] => {
        text = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
        text = text.replace(/<\/?[^>]+(>|$)/g, '');
        const lines = text.split('\n');
        const cues: {start: number; end: number; text: string}[] = [];
        const timeRegex = /(\d{2}:\d{2}:\d{2})[.,](\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2})[.,](\d{3})/;

        const toSec = (h: number, m: number, s: number, ms: number) => h * 3600 + m * 60 + s + ms / 1000;

        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            const m = timeRegex.exec(line);
            if (m) {
                const [_, h1, ms1, h2, ms2] = m;
                const start = toSec(...h1.split(':').map(Number), Number(ms1));
                const end = toSec(...h2.split(':').map(Number), Number(ms2));
                const textLines: string[] = [];
                i++;
                while (i < lines.length && lines[i].trim() !== '' && !timeRegex.test(lines[i])) {
                    const t = lines[i].trim();
                    if (t && !/^\d+$/.test(t)) textLines.push(t);
                    i++;
                }
                if (textLines.length > 0) {
                    cues.push({ start, end, text: textLines.join('<br />') });
                }
            } else {
                i++;
            }
        }
        return cues;
    };

    const handleLocalSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;
            const cues = parseSubtitleText(text);
            setSubtitleCues(cues);
            setSubtitleName(file.name);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const downloadSub = (sub: any) => {
        fetch(`${API_BASE}/api/stream/${activeSessionId}/subs/${sub.index}`)
            .then(res => res.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = sub.name;
                a.click();
                URL.revokeObjectURL(url);
            })
            .catch(() => {});
    };

    const closePlayer = async () => {
        await reportProgress();

        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
        if (subsPollIntervalRef.current) clearInterval(subsPollIntervalRef.current);

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        fetch(`${API_BASE}/api/stream/stop`, { method: "POST" }).catch(() => {});

        setActiveStream(null);
        setHlsReadyUrl(null);
        setProbingCodecs(false);
        setTorrentStatus(null);
        setSourceDuration(null);
        setPlayerCurrentTime(0);
        setPlayerPaused(true);
        setUiVisible(false);
        setSeekOffset(0);
        setIsSeeking(false);
        setFrozenFrame(null);
        seekingRef.current = false;
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setSubtitleCues([]);
        setSubtitleName("");

        // Clear HLS audio tracks and session states
        setAudioTracks([]);
        setCurrentAudioTrack(0);
        setActiveSessionId(null);
        setAvailableTorrents([]);
        setActiveTorrentHash(null);

        // Refresh storage stats
        fetchStorageStats();
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    const getPosterUrl = (path: string) =>
        path ? `https://image.tmdb.org/t/p/w500${path}` : "https://via.placeholder.com/500x750?text=No+Poster";

    const getBackdropUrl = (path: string) =>
        path ? `https://image.tmdb.org/t/p/w1280${path}` : "";

    const getCardBackdropUrl = (path: string) =>
        path ? `https://image.tmdb.org/t/p/w500${path}` : "https://via.placeholder.com/500x281?text=No+Preview";

    const getMovieThemeColor = (movie: Movie | null): [number, number, number] => {
        if (!movie) return [0.15, 0.15, 0.18]; // Default dark slate/grey

        // Hash title to compute a consistent color for the movie
        let hash = 0;
        const titleText = movie.title || movie.name || "";
        for (let i = 0; i < titleText.length; i++) {
            hash = titleText.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = Math.abs(hash) % 360;
        const s = 0.35; // 35% saturation
        const v = 0.18; // 18% brightness/value

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
                <header className="hidden md:flex py-3 items-center justify-between text-[10px] tracking-[0.28em] text-slate-300">
                    {/* Cache stats */}
                    <div className="flex items-center gap-3 flex-1">
                        <span>{storageStats ? formatStorageSize(storageStats.totalBytes) : "0 B"}</span>
                        <button
                            onClick={handleDeleteAllStorage}
                            className="hover:text-rose-400 transition-colors duration-200 cursor-pointer"
                        >
                            Wipe
                        </button>
                    </div>


                    <nav className="flex items-center justify-center gap-5 flex-shrink-0">
                        <Link href="/" className="hover:text-white transition-colors duration-200 cursor-pointer">Home</Link>
                        <Link href="/log" className="hover:text-white transition-colors duration-200 cursor-pointer">Log</Link>
                    </nav>


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
                </header>




                {/* Expanded Hero Card Panel (Using more space vertically since trending carousel was removed) */}
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

                                {/* ReactBits Proximity font weight cursor animation */}
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



                                {/* Minimalist Action Buttons (Grey/White/Black) */}
                                <div className="flex items-center gap-2 md:gap-3.5 mt-1 md:mt-2">
                                    <button
                                        onClick={() => playMovie(selectedMovie)}
                                        className="px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-white hover:bg-slate-200 text-slate-950 font-bold text-[11px] md:text-sm flex items-center gap-1.5 transition-all duration-300 shadow-md active:scale-95"
                                    >
                                        <Play className="w-3.5 h-3.5 fill-slate-950 text-slate-950" /> {selectedMovie.media_type === "tv" ? "Play Episode" : "Play"}
                                    </button>
                                    <button
                                        onClick={() => toggleWatchlist(selectedMovie)}
                                        className="px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 backdrop-blur-sm text-white font-semibold text-[11px] md:text-sm flex items-center gap-1.5 transition-all duration-300 active:scale-95"
                                    >
                                        {(() => {
                                            const wlId = getWatchlistId(selectedMovie);
                                            return wlId && watchlist.some(item => item.imdbId === wlId);
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

            {/* ── VERTICAL SCROLLABLE BOTTOM AREA ── scrollable, hero stays fixed above */}
            <div className="w-full flex-1 overflow-y-auto no-scrollbar z-10 relative mt-3 snap-y snap-mandatory">
                <div className="max-w-[96vw] mx-auto px-6 md:px-12">

                    {/* Search Results in Scrollable Container if active */}
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

                        {/* Trending Movies/Series */}
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

                        {/* Continue Watching Row */}
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
                                                key={item.imdbId}
                                                className="flex-none group cursor-pointer snap-start w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]"
                                                onClick={() => {
                                                    const mt = item.mediaType || item.movieDetails?.media_type;
                                                    if (mt) {
                                                        playMovie({ ...item.movieDetails, imdb_id: item.imdbId, media_type: mt }, item.timestamp);
                                                    } else {
                                                        (async () => {
                                                            try {
                                                                const r = await fetch(`${API_BASE}/api/resolve-media-type/${item.imdbId}`);
                                                                if (r.ok) {
                                                                    const d = await r.json();
                                                                    if (d.mediaType) {
                                                                        playMovie({ ...item.movieDetails, imdb_id: item.imdbId, media_type: d.mediaType }, item.timestamp);
                                                                        return;
                                                                    }
                                                                }
                                                            } catch (e) {}
                                                            playMovie({ ...item.movieDetails, imdb_id: item.imdbId, media_type: "movie" }, item.timestamp);
                                                        })();
                                                    }
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

                        {/* Watchlist Row */}
                        {watchlist.length > 0 && (
                            <FadeContent className="snap-start snap-always scroll-mt-0 pt-8 pb-10">
                                <h3 className="text-[10px] font-semibold mb-5 tracking-[0.28em] uppercase text-slate-300">
                                    Watchlist
                                </h3>
                                <ScrollRow>
                                    {watchlist.map((item: any) => (
                                        <div
                                            key={item.imdbId}
                                            onClick={() => {
                                                const mt = item.mediaType || item.movieDetails?.media_type;
                                                if (mt) {
                                                    handleCardClick({ ...item.movieDetails, imdb_id: item.imdbId, media_type: mt });
                                                } else {
                                                    (async () => {
                                                        try {
                                                            const r = await fetch(`${API_BASE}/api/resolve-media-type/${item.imdbId}`);
                                                            if (r.ok) {
                                                                const d = await r.json();
                                                                if (d.mediaType) {
                                                                    handleCardClick({ ...item.movieDetails, imdb_id: item.imdbId, media_type: d.mediaType });
                                                                    return;
                                                                }
                                                            }
                                                        } catch (e) {}
                                                        handleCardClick({ ...item.movieDetails, imdb_id: item.imdbId, media_type: "movie" });
                                                    })();
                                                }
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
                        )}







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

                            {/* Left Column: Video Box Container */}
                            <div ref={playerContainerRef} className="flex-none md:flex-grow w-full lg:w-[72%] aspect-video lg:aspect-auto relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black/40 shadow-2xl flex flex-col justify-center items-center backdrop-blur-xl">

                                {/* Loader overlay */}
                                {(probingCodecs || !hlsReadyUrl) && (
                                    <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center gap-4 ${isSeeking ? 'bg-black/40' : 'bg-black'}`} style={frozenFrame ? { backgroundImage: `url(${frozenFrame})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}}>
                                        {hlsErrorMsg ? (
                                            <div className="flex flex-col items-center gap-3 text-rose-500">
                                                <AlertCircle className="w-10 h-10 stroke-[1.5]" />
                                                <div className="font-light tracking-wide text-sm text-rose-450">Streaming Session Failed</div>
                                                <div className="text-xs text-white/50 max-w-md font-light">{hlsErrorMsg}</div>
                                                <button
                                                    onClick={closePlayer}
                                                    className="px-5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/95 rounded-full mt-2 text-xs font-medium active:scale-95 transition-all cursor-pointer"
                                                >
                                                    Go Back
                                                </button>
                                            </div>
                                        ) : isSeeking ? (
                                            <Loader2 className="w-8 h-8 text-white/60 animate-spin stroke-[1.5]" />
                                        ) : (
                                            <>
                                                <Loader2 className="w-8 h-8 text-white/60 animate-spin stroke-[1.5]" />
                                                <div>
                                                    <div className="text-white/90 font-light tracking-wider text-sm">Preparing Media Torrent...</div>
                                                    <div className="text-white/40 text-[10px] tracking-wide font-light mt-1 max-w-xs leading-relaxed">
                                                        Connecting peers, probing streams, and spinning up transcoding server.
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                <div
                                    className="absolute inset-0 z-10"
                                    onMouseMove={showUi}
                                />
                                <video
                                    ref={videoRef}
                                    playsInline
                                    onClick={() => {
                                        const v = videoRef.current;
                                        if (v) v.paused ? v.play() : v.pause();
                                        showUi();
                                    }}
                                    className="w-full h-full object-contain relative z-10 cursor-pointer"
                                />
                                {subtitleCues.length > 0 && (() => {
                                    const cue = subtitleCues.find(c => playerCurrentTime >= c.start && playerCurrentTime < c.end);
                                    return cue ? (
                                        <div className="absolute bottom-20 left-0 right-0 z-20 flex justify-center pointer-events-none px-6" key={cue.start}>
                                            <div
                                                className="text-white/90 text-xl md:text-2xl text-center leading-relaxed max-w-[85%]"
                                                style={{
                                                    textShadow: '0 0 1px #000, 0 0 1px #000, 0 0 1px #000, 0 1px 2px #000',
                                                    WebkitTextStroke: '0.5px rgba(0,0,0,0.8)'
                                                }}
                                                dangerouslySetInnerHTML={{ __html: cue.text }}
                                            />
                                        </div>
                                    ) : null;
                                })()}
                                {hlsReadyUrl && (() => {
                                    const vDur = videoRef.current?.duration;
                                    const seekDur = sourceDuration || (vDur && isFinite(vDur) ? vDur : null);
                                    if (seekDur) seekDurRef.current = seekDur;
                                    const absTime = seekOffset + playerCurrentTime;
                                    const controlsVisible = (uiVisible || playerPaused) && !isSeeking;
                                    return (
                                        <>
                                            {playerPaused && controlsVisible && (
                                                <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none transition-opacity duration-300">
                                                    <div className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                                                        <Play className="w-6 h-6 text-white/70 ml-0.5" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                                <div className="flex items-center gap-3 px-4 pb-3">
                                                    <div className="flex-1 relative h-2 bg-white/10 rounded-full cursor-pointer overflow-hidden"
                                                        onClick={(e) => {
                                                            if (!seekDur) return;
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const x = e.clientX - rect.left;
                                                            const frac = x / rect.width;
                                                            showUi();
                                                            seekTo(frac);
                                                        }}
                                                    >
                                                        <div
                                                            className="absolute left-0 top-0 h-full bg-white/40 rounded-full transition-all duration-75"
                                                            style={{ width: `${seekDur ? (absTime / seekDur) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[11px] text-white/40 font-mono tabular-nums flex-shrink-0">
                                                        {formatTime(absTime)} / {seekDur ? formatTime(seekDur) : "--:--"}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            if (isFullscreen) {
                                                                document.exitFullscreen();
                                                            } else if (playerContainerRef.current) {
                                                                playerContainerRef.current.requestFullscreen();
                                                            }
                                                            showUi();
                                                        }}
                                                        className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                                                    >
                                                        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Right Column: Glassmorphic Sidebar */}
                            <GlassSurface className="w-full lg:w-80 xl:w-96 p-5 flex flex-col gap-6 !border-white/[0.03] !bg-transparent !backdrop-blur-none h-auto max-h-[70vh] lg:max-h-full overflow-y-auto no-scrollbar rounded-2xl !shadow-none">

                                {/* 0. Rating System */}
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

                                {/* 1. TV Season/Episode Selector (Text-only, Stacked) */}
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
                                    </div>
                                )}

                                {/* 2. Download Status Progress Bar */}
                                {torrentStatus && (
                                    <div className="flex flex-col gap-2 pb-4 border-b border-white/[0.05]">
                                        <div className="flex justify-between items-center text-[9px] uppercase tracking-[0.25em] text-white/40 mb-0.5">
                                            <VariableProximity
                                                text="Download Status"
                                                fromWeight={400}
                                                toWeight={800}
                                                radius={80}
                                                className=""
                                            />
                                            <span className="font-medium text-white/80 tracking-wide font-mono normal-case">{Math.round((torrentStatus.progress || 0) * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 h-[2px] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-white transition-all duration-300"
                                                style={{ width: `${Math.round((torrentStatus.progress || 0) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-white/30 text-[8px] font-mono tracking-tight">
                                            <span>{formatSpeed(torrentStatus.downloadSpeed)}</span>
                                            <span>{torrentStatus.numPeers || 0} Peers</span>
                                        </div>
                                    </div>
                                )}

                                {/* 3. Available Torrents (Top 5 Qualities) */}
                                <div className="flex flex-col gap-3 pb-4 border-b border-white/[0.05]">
                                    <button
                                        onClick={() => setIsQualityExpanded(!isQualityExpanded)}
                                        className="flex items-center justify-between w-full text-left focus:outline-none cursor-pointer"
                                    >
                                        <VariableProximity
                                            text="quality"
                                            fromWeight={400}
                                            toWeight={800}
                                            radius={80}
                                            className="text-[9px] uppercase tracking-[0.25em] text-white/40"
                                        />
                                        <span className="text-[8px] text-white/30 font-light hover:text-white/60 transition-colors uppercase tracking-wider">
                                            {isQualityExpanded ? "Collapse" : `Expand (${availableTorrents.length})`}
                                        </span>
                                    </button>

                                    {isQualityExpanded && (
                                        <div className="flex flex-col gap-2 max-h-[210px] overflow-y-auto no-scrollbar">
                                            {availableTorrents.length === 0 ? (
                                                <div className="text-xs text-white/30 italic py-2 font-light">No alternative torrents found.</div>
                                            ) : (
                                                availableTorrents.slice(0, 10).map((t, idx) => {
                                                    const isActive = t.hash === activeTorrentHash;
                                                    return (
                                                        <button
                                                            key={t.hash || idx}
                                                            onClick={() => !isActive && changeTorrentQuality(t)}
                                                            className={`w-full text-left rounded-2xl p-3 transition-all duration-300 flex flex-col gap-2 bg-transparent ${isActive
                                                                ? "cursor-default text-white"
                                                                : "hover:bg-white/[0.08] text-white/60 hover:text-white/90 cursor-pointer"
                                                                }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-2 w-full">
                                                                <span className={`text-[11px] font-normal leading-normal line-clamp-2 ${isActive ? "text-white" : "text-white/70"}`} title={t.quality}>
                                                                    {t.quality}
                                                                </span>
                                                                {isActive && (
                                                                    <span className="flex-shrink-0 text-[8px] border border-white/20 text-white/90 px-2 py-0.5 rounded font-medium uppercase tracking-wider bg-white/5">
                                                                        Active
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-between text-[9px] text-white/40 font-mono font-light w-full">
                                                                <span>Size: {t.size}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white/40 font-normal">▲ {t.seeds}</span>
                                                                    <span className="text-white/40 font-normal">▼ {t.peers}</span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 4. Subtitles — Download & Upload */}
                                <div className="flex flex-col gap-2 pb-4 border-b border-white/[0.05]">
                                    <div className="flex items-center justify-between mb-1">
                                        <VariableProximity
                                            text="Subtitles"
                                            fromWeight={400}
                                            toWeight={800}
                                            radius={80}
                                            className="text-[9px] uppercase tracking-[0.25em] text-white/40"
                                        />
                                        <label className="cursor-pointer text-[8px] bg-white/[0.05] hover:bg-white/10 text-white/60 hover:text-white/90 border border-white/10 px-2 py-1 rounded transition-colors uppercase tracking-wider flex items-center gap-1 active:scale-95 shadow-sm">
                                            <Upload className="w-2.5 h-2.5" /> Upload SRT
                                            <input type="file" accept=".srt,.vtt" onChange={handleLocalSubtitleUpload} className="hidden" />
                                        </label>
                                    </div>

                                    {/* Active uploaded subtitle */}
                                    {subtitleCues.length > 0 && (
                                        <div className="w-full rounded-lg p-2.5 flex items-center justify-between gap-2 bg-white/[0.06] border border-white/10">
                                            <span className="text-[10px] font-medium leading-tight truncate text-white/90" title={subtitleName}>
                                                {subtitleName}
                                            </span>
                                            <button
                                                onClick={() => { setSubtitleCues([]); setSubtitleName(""); }}
                                                className="flex-shrink-0 text-[8px] bg-white/[0.05] hover:bg-white/15 text-white/50 hover:text-white/90 border border-white/10 px-1.5 py-0.5 rounded transition-colors uppercase tracking-wider cursor-pointer"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
                                        {torrentSubs.length > 0 ? (
                                            torrentSubs.map((sub: any) => (
                                                <div
                                                    key={sub.index}
                                                    className={`w-full rounded-lg p-2.5 flex items-center justify-between gap-2 border border-white/[0.02] ${sub.downloaded ? "bg-white/[0.02]" : "bg-white/[0.01]"}`}
                                                >
                                                    <span className="text-[10px] font-medium leading-tight truncate text-white/70" title={sub.name}>
                                                        {sub.name}
                                                    </span>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {sub.downloaded ? (
                                                            <>
                                                                <span className="text-[8px] text-white/40 uppercase tracking-wider">Ready</span>
                                                                <button
                                                                    onClick={() => downloadSub(sub)}
                                                                    className="flex items-center gap-1 text-[8px] bg-white/[0.05] hover:bg-white/10 text-white/60 hover:text-white/90 border border-white/10 px-2 py-1 rounded transition-colors uppercase tracking-wider cursor-pointer"
                                                                >
                                                                    <Download className="w-2.5 h-2.5" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="text-[8px] text-white/30 uppercase tracking-wider">Downloading...</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="bg-white/[0.01] border border-white/[0.04] rounded-lg p-2 text-[10px] text-white/30 italic text-center">
                                                No subtitles available
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 5. Audio Track Selection */}
                                <div className="flex flex-col gap-3 pb-4">
                                    <VariableProximity
                                        text="Audio Track"
                                        fromWeight={400}
                                        toWeight={800}
                                        radius={80}
                                        className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1"
                                    />
                                    {audioTracks.length > 1 ? (
                                        <CustomSelect
                                            value={currentAudioTrack}
                                            onChange={(val: number) => changeAudioTrack(val)}
                                            options={audioTracks.map(track => ({ value: track.id, label: `${track.title} [${track.language}]` }))}
                                        />
                                    ) : (
                                        <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl px-3 py-2 text-xs text-white/30 font-light">
                                            Default Audio Track
                                        </div>
                                    )}
                                </div>



                            </GlassSurface>

                        </div>


                    </motion.div>
                )}
            </AnimatePresence>
            {/* Mobile Bottom Navigation (Glassmorphic) */}
            {!activeStream && (
                <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-[400px]">
                    <nav className="flex items-center justify-between px-6 py-4 rounded-full bg-[#090b14]/70 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                    {/* Storage */}
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] tracking-[0.2em] text-slate-300 font-medium whitespace-nowrap">
                            {storageStats ? formatStorageSize(storageStats.totalBytes) : "0 B"}
                        </span>
                    </div>

                    {/* Wipe */}
                    <button onClick={handleDeleteAllStorage} className="flex flex-col items-center gap-1 text-slate-400 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-5 h-5" />
                    </button>

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
