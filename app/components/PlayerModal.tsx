"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { X, AlertCircle, Play, Plus, Check, Loader2, Volume2, VolumeX } from "lucide-react";
import type { TouchEvent as ReactTouchEvent } from "react";
import ScrambledText from "./ScrambledText";
import { PlayerSidebar } from "./PlayerSidebar";
import { MobilePlayerSheet } from "./MobilePlayerSheet";
import { getBackdropUrl } from "../lib/tmdb-utils";
import { getWatchlistId } from "../lib/watchlist";
import { getDetails } from "../lib/details-cache";

interface PlayerModalProps {
    activeStream: {
        tmdbId: string;
        title: string;
        details: any;
        embedUrl: string;
    } | null;
    playerError: string | null;
    effectiveSource: string;
    effectiveEnabledSources: string[];
    selectedShowDetails: any;
    selectedSeason: number;
    selectedEpisode: number;
    episodesList: number[];
    ratings: Record<string, any>;
    watchlist: any[];
    onClose: () => void;
    onSourceChange: (source: string) => void;
    onRate: (movie: any, rating: number, thoughts?: string) => void;
    onChangeEpisode: (season: number, episode: number) => void;
    onToggleWatchlist: (item: any) => void;
    onPlaySimilar: (movie: any) => void;
    /** If provided, shows a delete-from-log button in the sidebar/sheet */
    onDelete?: (tmdbId: string) => void;
    /**
     * The tab the modal should open on for every new active stream.
     * - "controls" (default) — used by the home page; player visible immediately.
     * - "details" — used by the recommend page; metadata-first landing.
     */
    initialTab?: "controls" | "details" | "similar";
}

export function PlayerModal({
    activeStream,
    playerError,
    effectiveSource,
    effectiveEnabledSources,
    selectedShowDetails,
    selectedSeason,
    selectedEpisode,
    episodesList,
    ratings,
    watchlist,
    onClose,
    onSourceChange,
    onRate,
    onChangeEpisode,
    onToggleWatchlist,
    onPlaySimilar,
    onDelete,
    initialTab = "controls",
}: PlayerModalProps) {
    const [activeTab, setActiveTab] = useState<"controls" | "details" | "similar">(initialTab);
    const [isExitingFullscreen, setIsExitingFullscreen] = useState(false);

    // Reset to the configured initial tab whenever a new title is opened in
    // the player. Without this, switching titles would keep whatever tab was
    // last active (e.g. "details" lingering after closing + reopening on a
    // different movie).
    const lastStreamIdRef = useRef<string | null>(null);
    useEffect(() => {
        const id = activeStream?.tmdbId || null;
        if (id && id !== lastStreamIdRef.current) {
            lastStreamIdRef.current = id;
            setActiveTab(initialTab);
        } else if (!id) {
            lastStreamIdRef.current = null;
        }
    }, [activeStream?.tmdbId, initialTab]);

    // Lock body scroll when modal opens to prevent background scrolling
    useEffect(() => {
        if (!activeStream) return;
        const scrollY = window.scrollY;
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.position = "";
            document.body.style.top = "";
            document.body.style.width = "";
            document.body.style.overflow = "";
            window.scrollTo(0, scrollY);
        };
    }, [activeStream]);

    const [similarItems, setSimilarItems] = useState<any[]>([]);
    const [similarLoading, setSimilarLoading] = useState(false);
    const [similarError, setSimilarError] = useState<string | null>(null);
    const [similarDisplayCount, setSimilarDisplayCount] = useState(10);
    const [selectedSimilarIdx, setSelectedSimilarIdx] = useState(0);
    const [selectedSimilarDetails, setSelectedSimilarDetails] = useState<any | null>(null);
    const [similarTrailerUrl, setSimilarTrailerUrl] = useState<string | null>(null);
    const [similarDetailLoading, setSimilarDetailLoading] = useState(false);
    const similarDetailCache = useRef<Map<number, { details: any; trailerUrl: string | null }>>(new Map());

    const [detailsFullData, setDetailsFullData] = useState<any | null>(null);
    const [detailsTrailerKey, setDetailsTrailerKey] = useState<string | null>(null);
    const [trailerMuted, setTrailerMuted] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const trailerIframeRef = useRef<HTMLIFrameElement>(null);
    const fetchedDetailsRef = useRef<string | null>(null);

    useEffect(() => {
        const details = activeStream?.details;
        if (!details) { setSimilarItems([]); return; }
        const title = details.title || details.name;
        if (!title) { setSimilarItems([]); return; }

        setSimilarItems([]);
        setSimilarLoading(true);
        setSimilarError(null);
        setSimilarDisplayCount(10);
        setSelectedSimilarIdx(0);
        setSelectedSimilarDetails(null);
        setSimilarTrailerUrl(null);
        similarDetailCache.current.clear();

        fetch("/api/similar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title,
                mediaType: details.media_type || "movie",
            }),
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.error) {
                    setSimilarError(data.error);
                    setSimilarItems([]);
                } else {
                    setSimilarItems(data.items || []);
                }
            })
            .catch((err) => {
                setSimilarError(err.message);
                setSimilarItems([]);
            })
            .finally(() => setSimilarLoading(false));
    }, [activeStream?.details?.id]);

    useEffect(() => {
        const item = similarItems[selectedSimilarIdx];
        if (!item || !item.id) {
            setSelectedSimilarDetails(null);
            setSimilarTrailerUrl(null);
            setSimilarDetailLoading(false);
            return;
        }

        const cached = similarDetailCache.current.get(item.id);
        if (cached) {
            setSelectedSimilarDetails(cached.details);
            setSimilarTrailerUrl(cached.trailerUrl);
            setSimilarDetailLoading(false);
            return;
        }

        setSimilarDetailLoading(true);

        const mt = item.media_type || "movie";

        getDetails(item.id, mt)
            .then((details) => {
                const currentItem = similarItems[selectedSimilarIdx];
                if (currentItem?.id !== item.id) return;

                if (details) {
                    const videos = details.videos?.results;
                    let trailerUrl: string | null = null;
                    if (videos) {
                        const trailer = videos.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || videos.find((v: any) => v.site === "YouTube");
                        trailerUrl = trailer ? `https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&enablejsapi=1` : null;
                    }
                    setSelectedSimilarDetails(details);
                    setSimilarTrailerUrl(trailerUrl);
                    similarDetailCache.current.set(item.id, { details, trailerUrl });
                } else {
                    setSelectedSimilarDetails(null);
                    setSimilarTrailerUrl(null);
                }
            })
            .catch(() => {
                const currentItem = similarItems[selectedSimilarIdx];
                if (currentItem?.id !== item.id) return;
                setSelectedSimilarDetails(null);
                setSimilarTrailerUrl(null);
            })
            .finally(() => setSimilarDetailLoading(false));
    }, [selectedSimilarIdx, similarItems]);

    useEffect(() => {
        const id = activeStream?.details?.id;
        const mt = activeStream?.details?.media_type || "movie";
        const cacheKey = id ? `${id}-${mt}` : null;

        if (!id || activeTab !== "details") return;
        if (fetchedDetailsRef.current === cacheKey) return;

        setDetailsLoading(true);
        getDetails(id, mt as "movie" | "tv")
            .then((details) => {
                if (details) {
                    setDetailsFullData(details);
                    const videos = details.videos?.results;
                    if (videos) {
                        const trailer = videos.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || videos.find((v: any) => v.site === "YouTube");
                        setDetailsTrailerKey(trailer ? trailer.key : null);
                        setTrailerMuted(true);
                    } else {
                        setDetailsTrailerKey(null);
                    }
                    fetchedDetailsRef.current = cacheKey;
                }
            })
            .catch(() => {})
            .finally(() => setDetailsLoading(false));
    }, [activeTab, activeStream?.details?.id]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setIsExitingFullscreen(true);
                const timer = setTimeout(() => {
                    setIsExitingFullscreen(false);
                }, 250);
                return () => clearTimeout(timer);
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);

    const handlePlaySimilar = useCallback(() => {
        const item = similarItems[selectedSimilarIdx];
        const full = selectedSimilarDetails;
        if (!item) return;

        const movie = {
            id: full?.id || item.id,
            title: full?.title || full?.name || item.title || item.name,
            name: full?.name || full?.title || item.name || item.title,
            overview: full?.overview || item.overview || "",
            poster_path: full?.poster_path || item.poster_path || null,
            backdrop_path: full?.backdrop_path || item.backdrop_path || null,
            vote_average: full?.vote_average || item.vote_average || 0,
            release_date: full?.release_date || item.release_date || "",
            first_air_date: full?.first_air_date || item.first_air_date || "",
            media_type: item.media_type || "movie",
        };

        onPlaySimilar(movie);
    }, [similarItems, selectedSimilarIdx, selectedSimilarDetails, onPlaySimilar, initialTab]);

    const handleToggleWatchlistForSimilar = useCallback(() => {
        const item = similarItems[selectedSimilarIdx];
        const full = selectedSimilarDetails;
        if (!item) return;
        onToggleWatchlist({
            ...item,
            title: full?.title || full?.name || item.title,
            name: full?.name || full?.title || item.name,
        });
    }, [similarItems, selectedSimilarIdx, selectedSimilarDetails, onToggleWatchlist]);

    // Reset mute state whenever the similar trailer changes (new item selected)
    useEffect(() => {
        setTrailerMuted(true);
    }, [similarTrailerUrl]);

    const handleToggleMute = useCallback(() => {
        const iframe = trailerIframeRef.current;
        if (!iframe?.contentWindow) return;
        const cmd = trailerMuted ? "unMute" : "mute";
        iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: cmd }), "*");
        setTrailerMuted((prev) => !prev);
    }, [trailerMuted]);

    const selectedSimilarItem = similarItems[selectedSimilarIdx];
    const isSelectedInWatchlist = selectedSimilarItem?.id
        ? (watchlist || []).some(
              (w: any) => w.tmdbId === getWatchlistId({ id: selectedSimilarItem.id, media_type: selectedSimilarItem.media_type })
          )
        : false;

    const similarItemForCard = selectedSimilarDetails || selectedSimilarItem;
    const similarBackdrop = similarItemForCard?.backdrop_path || selectedSimilarItem?.backdrop_path;
    const similarTitle = selectedSimilarDetails?.title || selectedSimilarDetails?.name || selectedSimilarItem?.title || selectedSimilarItem?.name || "";
    const similarYear = (selectedSimilarDetails?.release_date || selectedSimilarDetails?.first_air_date || selectedSimilarItem?.release_date || selectedSimilarItem?.first_air_date || "").split("-")[0];
    const similarOverview = selectedSimilarDetails?.overview || selectedSimilarItem?.overview || "";
    const similarPct = selectedSimilarItem?.similarity;

    const detailsEmbedUrl = detailsTrailerKey
        ? `https://www.youtube.com/embed/${detailsTrailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&enablejsapi=1`
        : null;

    const currentBackdrop = detailsFullData?.backdrop_path || activeStream?.details?.backdrop_path;
    const currentTitle = activeStream?.details?.title || activeStream?.details?.name || "";
    const currentYear = (activeStream?.details?.release_date || activeStream?.details?.first_air_date || "").split("-")[0];

    const displayTitle = activeTab === "similar" && similarTitle
        ? similarTitle
        : activeStream?.title || "";

    if (!activeStream) return null;

    const playerAreaProps = {
        activeTab,
        activeStream,
        playerError,
        detailsLoading,
        detailsEmbedUrl,
        currentBackdrop,
        currentTitle,
        currentYear,
        similarDetailLoading,
        similarTrailerUrl,
        similarBackdrop,
        similarTitle,
        similarYear,
        similarPct,
        similarOverview,
        isSelectedInWatchlist,
        trailerIframeRef,
        trailerMuted,
        handleToggleMute,
        handleToggleWatchlistForSimilar,
        handlePlaySimilar,
        onClose,
        selectedSimilarIdx,
    };

    return (
        <>
            {/* ── DESKTOP LAYOUT (lg+) ─────────────────────────────── */}
            <div className="modal-panel hidden lg:flex fixed inset-0 z-50 bg-black/60 backdrop-blur-3xl flex-col items-center justify-center p-6 overflow-y-auto w-full h-full">
                <div className="w-full max-w-7xl flex items-center justify-between mb-4 flex-shrink-0">
                    <h2 className="text-base md:text-lg font-light tracking-wide text-white/95 flex items-center gap-2">
                        <ScrambledText text={displayTitle} />
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95 duration-200 cursor-pointer"
                    >
                        <X className="w-[18px] h-[18px]" />
                    </button>
                </div>

                <div className="w-full max-w-7xl flex flex-row gap-6 items-stretch justify-center flex-none h-[62vh] xl:h-[66vh]">
                    <div className={`flex-grow w-[72%] relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-2xl ${isExitingFullscreen ? 'animate-exit-fullscreen' : ''}`}>
                        <PlayerArea {...playerAreaProps} showSimilarOverlay />
                    </div>

                    <PlayerSidebar
                        selectedSource={effectiveSource}
                        effectiveEnabledSources={effectiveEnabledSources}
                        selectedShowDetails={selectedShowDetails}
                        selectedSeason={selectedSeason}
                        selectedEpisode={selectedEpisode}
                        episodesList={episodesList}
                        ratings={ratings}
                        activeStreamDetails={activeStream?.details}
                        onSourceChange={onSourceChange}
                        onRate={onRate}
                        onChangeEpisode={onChangeEpisode}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        detailsFullData={detailsFullData}
                        detailsLoading={detailsLoading}
                        similarItems={similarItems}
                        similarLoading={similarLoading}
                        similarError={similarError}
                        similarDisplayCount={similarDisplayCount}
                        onLoadMore={() => setSimilarDisplayCount((p) => Math.min(p + 10, similarItems.length))}
                        selectedSimilarIdx={selectedSimilarIdx}
                        onSelectSimilar={setSelectedSimilarIdx}
                        onDelete={onDelete}
                    />
                </div>
            </div>

            {/* ── MOBILE LAYOUT (<lg) ──────────────────────────────── */}
            <MobileModal
                activeStream={activeStream}
                playerAreaProps={playerAreaProps}
                isExitingFullscreen={isExitingFullscreen}
                displayTitle={displayTitle}
                currentYear={currentYear}
                effectiveSource={effectiveSource}
                effectiveEnabledSources={effectiveEnabledSources}
                onSourceChange={onSourceChange}
                ratings={ratings}
                onRate={onRate}
                selectedShowDetails={selectedShowDetails}
                selectedSeason={selectedSeason}
                selectedEpisode={selectedEpisode}
                episodesList={episodesList}
                onChangeEpisode={onChangeEpisode}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                detailsFullData={detailsFullData}
                detailsLoading={detailsLoading}
                similarItems={similarItems}
                similarLoading={similarLoading}
                similarError={similarError}
                similarDisplayCount={similarDisplayCount}
                onLoadMore={() => setSimilarDisplayCount((p) => Math.min(p + 10, similarItems.length))}
                selectedSimilarIdx={selectedSimilarIdx}
                onSelectSimilar={setSelectedSimilarIdx}
                selectedSimilarDetails={selectedSimilarDetails}
                isSelectedInWatchlist={isSelectedInWatchlist}
                onToggleWatchlistForSimilar={handleToggleWatchlistForSimilar}
                onPlaySimilar={handlePlaySimilar}
                onClose={onClose}
                onDelete={onDelete}
            />
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Player area: iframe / trailer / backdrop with corrected gradient.
// Used by both desktop and mobile layouts.
// ─────────────────────────────────────────────────────────────────────
interface PlayerAreaProps {
    activeTab: "controls" | "details" | "similar";
    activeStream: { tmdbId?: string; embedUrl: string; details: any; title: string } | null;
    playerError: string | null;
    detailsLoading: boolean;
    detailsEmbedUrl: string | null;
    currentBackdrop?: string;
    currentTitle: string;
    currentYear: string;
    similarDetailLoading: boolean;
    similarTrailerUrl: string | null;
    similarBackdrop?: string;
    similarTitle: string;
    similarYear: string;
    similarPct?: number;
    similarOverview: string;
    isSelectedInWatchlist: boolean;
    trailerIframeRef: React.RefObject<HTMLIFrameElement | null>;
    trailerMuted: boolean;
    handleToggleMute: () => void;
    handleToggleWatchlistForSimilar: () => void;
    handlePlaySimilar: () => void;
    onClose: () => void;
    showSimilarOverlay?: boolean;
    isMobile?: boolean;
    selectedSimilarIdx: number;
}

function PlayerArea(props: PlayerAreaProps) {
    const {
        activeTab, activeStream, playerError,
        detailsLoading, detailsEmbedUrl, currentBackdrop, currentTitle, currentYear,
        similarDetailLoading, similarTrailerUrl, similarBackdrop, similarTitle, similarYear, similarPct, similarOverview,
        isSelectedInWatchlist,
        trailerIframeRef, trailerMuted, handleToggleMute,
        handleToggleWatchlistForSimilar, handlePlaySimilar,
        onClose, showSimilarOverlay = false, isMobile,
        selectedSimilarIdx,
    } = props;

    if (activeTab === "controls") {
        return (
            <>
                {activeStream?.embedUrl && (
                    <iframe
                        src={activeStream.embedUrl}
                        className="w-full h-full"
                        allow="autoplay; encrypted-media; fullscreen *"
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
                                onClick={onClose}
                                className="px-5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/95 rounded-full mt-2 text-xs font-medium active:scale-95 transition-all cursor-pointer"
                            >
                                Go Back
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }

    if (activeTab === "details") {
        return (
            <div className="w-full h-full relative">
                {detailsLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                    </div>
                ) : detailsEmbedUrl ? (
                    <TrailerFrame
                        key={`details-${activeStream?.tmdbId}-${detailsEmbedUrl}`}
                        innerRef={trailerIframeRef}
                        src={detailsEmbedUrl}
                        muted={trailerMuted}
                        onToggleMute={handleToggleMute}
                    />
                ) : currentBackdrop ? (
                    <>
                        <Image
                            src={getBackdropUrl(currentBackdrop)}
                            alt={currentTitle}
                            fill
                            className="object-cover"
                            sizes={isMobile ? "100vw" : "72vw"}
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20 text-[10px] uppercase tracking-widest">
                        No image available
                    </div>
                )}

                {!isMobile && !detailsEmbedUrl && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
                        <h3 className="text-base md:text-xl font-medium text-white">
                            {currentTitle}
                            {currentYear && <span className="text-white/50 font-light ml-2">({currentYear})</span>}
                        </h3>
                    </div>
                )}
            </div>
        );
    }

    // similar
    return (
        <div className="w-full h-full relative">
            {similarDetailLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                </div>
            ) : similarTrailerUrl ? (
                <TrailerFrame
                    key={`similar-${activeStream?.tmdbId}-${selectedSimilarIdx}-${similarTrailerUrl}`}
                    innerRef={trailerIframeRef}
                    src={similarTrailerUrl}
                    muted={trailerMuted}
                    onToggleMute={handleToggleMute}
                />
            ) : similarBackdrop ? (
                <>
                    <Image
                        src={getBackdropUrl(similarBackdrop)}
                        alt={similarTitle}
                        fill
                        className="object-cover"
                        sizes={isMobile ? "100vw" : "72vw"}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
                </>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/20 text-[10px] uppercase tracking-widest">
                    No image available
                </div>
            )}

            {showSimilarOverlay && (
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
                    <h3 className="text-base md:text-xl font-medium text-white">
                        {similarTitle}
                        {similarYear && <span className="text-white/50 font-light ml-2">({similarYear})</span>}
                        {similarPct && <span className="ml-3 text-sm text-white/60 font-medium">{similarPct}% Match</span>}
                    </h3>
                    <p className="text-[10px] md:text-xs text-white/70 mt-2 line-clamp-2 max-w-xl leading-relaxed">
                        {similarOverview || "No overview available."}
                    </p>
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleToggleWatchlistForSimilar}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer"
                        >
                            {isSelectedInWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            {isSelectedInWatchlist ? "In Watchlist" : "Watchlist"}
                        </button>
                        <button
                            onClick={handlePlaySimilar}
                            disabled={similarDetailLoading}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Play className="w-3.5 h-3.5" /> Play
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// TrailerFrame: hides YouTube top/bottom chrome by clipping a 160%
// overscaled wrapper. Replaces the previous scale(1.3) + split top &
// bottom gradients that produced a visible horizontal seam mid-image.
// ─────────────────────────────────────────────────────────────────────
function TrailerFrame({ src, muted, onToggleMute, innerRef }: {
    src: string;
    muted: boolean;
    onToggleMute: () => void;
    innerRef?: React.Ref<HTMLIFrameElement>;
}) {
    return (
        <>
            <div className="absolute inset-0 overflow-hidden bg-black">
                <div
                    className="absolute"
                    style={{ top: "-30%", left: "-30%", width: "160%", height: "160%" }}
                >
                    <iframe
                        ref={innerRef}
                        src={src}
                        className="w-full h-full pointer-events-none block"
                        allow="autoplay; encrypted-media; fullscreen *"
                        allowFullScreen
                    />
                </div>
            </div>
            {/* Single bottom-up gradient (no mid-image seam) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/55 to-transparent" />
            <button
                onClick={onToggleMute}
                className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full border border-white/20 bg-black/50 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
                {muted ? <VolumeX className="w-[18px] h-[18px]" /> : <Volume2 className="w-[18px] h-[18px]" />}
            </button>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────
// MobileModal: handles swipe-to-close, rounded top corners, safe-area
// ─────────────────────────────────────────────────────────────────────
function MobileModal({
    activeStream,
    playerAreaProps,
    isExitingFullscreen,
    displayTitle,
    currentYear,
    effectiveSource,
    effectiveEnabledSources,
    onSourceChange,
    ratings,
    onRate,
    selectedShowDetails,
    selectedSeason,
    selectedEpisode,
    episodesList,
    onChangeEpisode,
    activeTab,
    onTabChange,
    detailsFullData,
    detailsLoading,
    similarItems,
    similarLoading,
    similarError,
    similarDisplayCount,
    onLoadMore,
    selectedSimilarIdx,
    onSelectSimilar,
    selectedSimilarDetails,
    isSelectedInWatchlist,
    onToggleWatchlistForSimilar,
    onPlaySimilar,
    onClose,
    onDelete,
}: {
    activeStream: any;
    playerAreaProps: PlayerAreaProps;
    isExitingFullscreen: boolean;
    displayTitle: string;
    currentYear: string;
    effectiveSource: string;
    effectiveEnabledSources: string[];
    onSourceChange: (s: string) => void;
    ratings: Record<string, any>;
    onRate: (movie: any, rating: number, thoughts?: string) => void;
    selectedShowDetails: any;
    selectedSeason: number;
    selectedEpisode: number;
    episodesList: number[];
    onChangeEpisode: (season: number, episode: number) => void;
    activeTab: "controls" | "details" | "similar";
    onTabChange: (tab: "controls" | "details" | "similar") => void;
    detailsFullData: any;
    detailsLoading: boolean;
    similarItems: any[];
    similarLoading: boolean;
    similarError: string | null;
    similarDisplayCount: number;
    onLoadMore: () => void;
    selectedSimilarIdx: number;
    onSelectSimilar: (i: number) => void;
    selectedSimilarDetails: any;
    isSelectedInWatchlist: boolean;
    onToggleWatchlistForSimilar: () => void;
    onPlaySimilar: () => void;
    onClose: () => void;
    onDelete?: (tmdbId: string) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);
    const touchStartYRef = useRef(0);
    const deltaYRef = useRef(0);
    const draggingRef = useRef(false);

    const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
        const sheetScrollTop = sheetRef.current?.scrollTop ?? 0;
        // Only initiate swipe-to-close when sheet is scrolled to top
        if (sheetScrollTop > 4) return;
        touchStartYRef.current = e.touches[0].clientY;
        deltaYRef.current = 0;
        draggingRef.current = true;
    };

    const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        const delta = e.touches[0].clientY - touchStartYRef.current;
        if (delta <= 0) {
            // Upward swipe — cancel drag, let sheet scroll normally
            draggingRef.current = false;
            if (containerRef.current) containerRef.current.style.transform = "";
            return;
        }
        deltaYRef.current = delta;
        const capped = Math.min(delta, 220);
        if (containerRef.current) {
            containerRef.current.style.transition = "none";
            containerRef.current.style.transform = `translateY(${capped}px)`;
        }
    };

    const handleTouchEnd = () => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        if (deltaYRef.current >= 80) {
            // Dismiss
            if (containerRef.current) {
                containerRef.current.style.transition = "transform 0.25s cubic-bezier(0.16,1,0.3,1)";
                containerRef.current.style.transform = "translateY(100%)";
            }
            setTimeout(onClose, 220);
        } else {
            // Snap back
            if (containerRef.current) {
                containerRef.current.style.transition = "transform 0.25s cubic-bezier(0.16,1,0.3,1)";
                containerRef.current.style.transform = "";
            }
        }
        deltaYRef.current = 0;
    };

    const handleClose = () => {
        if (containerRef.current) {
            containerRef.current.style.transition = "transform 0.28s cubic-bezier(0.16,1,0.3,1)";
            containerRef.current.style.transform = "translateY(100%)";
        }
        setTimeout(onClose, 250);
    };

    return (
        <>
            {/* Dim backdrop */}
            <div
                className="modal-backdrop lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Bottom sheet — 75vh, slides up from bottom */}
            <div
                ref={containerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="mobile-sheet lg:hidden fixed inset-x-0 bottom-0 z-50 bg-black flex flex-col overflow-hidden w-full rounded-t-2xl border-t border-white/[0.06]"
                style={{ height: "75vh" }}
            >
                {/* Video area — flush with rounded top corners */}
                <div className="relative flex-shrink-0 w-full overflow-hidden rounded-t-2xl">
                    <div className={`relative w-full aspect-video bg-black ${isExitingFullscreen ? "animate-exit-fullscreen" : ""}`}>
                        <PlayerArea {...playerAreaProps} showSimilarOverlay={false} isMobile={true} />
                        <button
                            onClick={handleClose}
                            className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/90 active:scale-90 transition-all cursor-pointer"
                            aria-label="Close player"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Scrollable sheet content */}
                <div ref={sheetRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                    <MobilePlayerSheet
                        activeStreamDetails={activeStream?.details}
                        activeStreamTitle={displayTitle}
                        currentYear={currentYear}
                        selectedSource={effectiveSource}
                        effectiveEnabledSources={effectiveEnabledSources}
                        onSourceChange={onSourceChange}
                        ratings={ratings}
                        onRate={onRate}
                        selectedShowDetails={selectedShowDetails}
                        selectedSeason={selectedSeason}
                        selectedEpisode={selectedEpisode}
                        episodesList={episodesList}
                        onChangeEpisode={onChangeEpisode}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                        detailsFullData={detailsFullData}
                        detailsLoading={detailsLoading}
                        similarItems={similarItems}
                        similarLoading={similarLoading}
                        similarError={similarError}
                        similarDisplayCount={similarDisplayCount}
                        onLoadMore={onLoadMore}
                        selectedSimilarIdx={selectedSimilarIdx}
                        onSelectSimilar={onSelectSimilar}
                        selectedSimilarDetails={selectedSimilarDetails}
                        isSelectedSimilarInWatchlist={isSelectedInWatchlist}
                        onToggleWatchlistForSimilar={onToggleWatchlistForSimilar}
                        onPlaySimilar={onPlaySimilar}
                        onDelete={onDelete}
                    />
                </div>
            </div>
        </>
    );
}
