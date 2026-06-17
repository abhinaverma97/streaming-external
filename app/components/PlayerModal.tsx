"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { X, AlertCircle, Play, Plus, Check, Loader2, Volume2, VolumeX } from "lucide-react";
import ScrambledText from "./ScrambledText";
import { PlayerSidebar } from "./PlayerSidebar";
import { getBackdropUrl } from "../lib/tmdb-utils";
import { getWatchlistId } from "../lib/watchlist";

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
}: PlayerModalProps) {
    const [activeTab, setActiveTab] = useState<"controls" | "details" | "similar">("controls");
    const [isExitingFullscreen, setIsExitingFullscreen] = useState(false);

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

        fetch(`/api/${mt}/${item.id}`)
            .then((r) => r.json())
            .then((data) => {
                const currentItem = similarItems[selectedSimilarIdx];
                if (currentItem?.id !== item.id) return;

                if (data.tmdb) {
                    const videos = data.tmdb.videos?.results;
                    let trailerUrl: string | null = null;
                    if (videos) {
                        const trailer = videos.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || videos.find((v: any) => v.site === "YouTube");
                        trailerUrl = trailer ? `https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&enablejsapi=1` : null;
                    }
                    setSelectedSimilarDetails(data.tmdb);
                    setSimilarTrailerUrl(trailerUrl);
                    similarDetailCache.current.set(item.id, { details: data.tmdb, trailerUrl });
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
        fetch(`/api/${mt}/${id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.tmdb) {
                    setDetailsFullData(data.tmdb);
                    const videos = data.tmdb.videos?.results;
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
        setActiveTab("controls");
    }, [similarItems, selectedSimilarIdx, selectedSimilarDetails, onPlaySimilar]);

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

    return (
        <>
            {activeStream && (
                <div className="modal-panel fixed inset-0 z-50 bg-black/40 backdrop-blur-2xl md:bg-black/60 flex flex-col items-center justify-start md:justify-center p-4 pt-10 pb-20 md:p-6 md:backdrop-blur-3xl overflow-hidden w-full h-full">
                    <div className="w-full max-w-7xl flex items-center justify-between mb-4 flex-shrink-0">
                        <div>
                            <h2 className="text-base md:text-lg font-light tracking-wide text-white/95 flex items-center gap-2">
                                <ScrambledText text={displayTitle} />
                            </h2>
                        </div>
                        <div>
                            <button
                                onClick={onClose}
                                className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95 duration-200 cursor-pointer"
                            >
                                <X className="w-[18px] h-[18px]" />
                            </button>
                        </div>
                    </div>

                    <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch justify-center flex-1 min-h-0 lg:h-[62vh] xl:h-[66vh]">
                        <div className={`flex-none md:flex-grow w-full lg:w-[72%] aspect-video lg:aspect-auto relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-2xl ${isExitingFullscreen ? 'animate-exit-fullscreen' : ''}`}>
                            {activeTab === "controls" ? (
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
                            ) : activeTab === "details" ? (
                                <div className="w-full h-full relative">
                                    {detailsLoading ? (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                                        </div>
                                    ) : detailsEmbedUrl ? (
                                        <>
                                            <div className="w-full h-full overflow-hidden bg-black">
                                                <iframe
                                                    ref={trailerIframeRef}
                                                    src={detailsEmbedUrl}
                                                    className="w-full h-full pointer-events-none"
                                                    style={{ transform: "scale(1.3)", transformOrigin: "50% 50%" }}
                                                    allow="autoplay; encrypted-media; fullscreen *"
                                                    allowFullScreen
                                                />
                                            </div>
                                            <button
                                                onClick={handleToggleMute}
                                                className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full border border-white/20 bg-black/50 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer"
                                            >
                                                {trailerMuted ? <VolumeX className="w-[18px] h-[18px]" /> : <Volume2 className="w-[18px] h-[18px]" />}
                                            </button>
                                        </>
                                    ) : currentBackdrop ? (
                                        <Image
                                            src={getBackdropUrl(currentBackdrop)}
                                            alt={currentTitle}
                                            fill
                                            className="object-cover"
                                            sizes="72vw"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-[10px] uppercase tracking-widest">
                                            No image available
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent h-1/3" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 to-transparent" />

                                    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
                                        <h3 className="text-base md:text-xl font-medium text-white">
                                            {currentTitle}
                                            {currentYear && <span className="text-white/50 font-light ml-2">({currentYear})</span>}
                                        </h3>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full relative">
                                    {similarDetailLoading ? (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                                        </div>
                                    ) : similarTrailerUrl ? (
                                        <>
                                            <div className="w-full h-full overflow-hidden bg-black">
                                                <iframe
                                                    ref={trailerIframeRef}
                                                    src={similarTrailerUrl}
                                                    className="w-full h-full pointer-events-none"
                                                    style={{ transform: "scale(1.3)", transformOrigin: "50% 50%" }}
                                                    allow="autoplay; encrypted-media; fullscreen *"
                                                    allowFullScreen
                                                />
                                            </div>
                                            <button
                                                onClick={handleToggleMute}
                                                className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full border border-white/20 bg-black/50 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer"
                                            >
                                                {trailerMuted ? <VolumeX className="w-[18px] h-[18px]" /> : <Volume2 className="w-[18px] h-[18px]" />}
                                            </button>
                                        </>
                                    ) : similarBackdrop ? (
                                        <Image
                                            src={getBackdropUrl(similarBackdrop)}
                                            alt={similarTitle}
                                            fill
                                            className="object-cover"
                                            sizes="72vw"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-[10px] uppercase tracking-widest">
                                            No image available
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent h-1/3" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 to-transparent" />

                                    <div className="hidden lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:p-8">
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
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer"
                                            >
                                                <Play className="w-3.5 h-3.5" /> Play
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {activeTab === "similar" && (
                            <div className="block lg:hidden w-full rounded-2xl border border-white/[0.06] bg-black/60 shadow-2xl p-4">
                                <h3 className="text-base font-medium text-white">
                                    {similarTitle}
                                    {similarYear && <span className="text-white/50 font-light ml-2">({similarYear})</span>}
                                    {similarPct && <span className="ml-3 text-sm text-white/60 font-medium">{similarPct}% Match</span>}
                                </h3>
                                <p className="text-[10px] text-white/70 mt-2 line-clamp-3 leading-relaxed">
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
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer"
                                    >
                                        <Play className="w-3.5 h-3.5" /> Play
                                    </button>
                                </div>
                            </div>
                        )}

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
                        />
                    </div>
                </div>
            )}
        </>
    );
}
