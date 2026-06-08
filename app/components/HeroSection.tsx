"use client";

import { useState, useEffect, useRef, memo } from "react";
import Image from "next/image";
import { Play, Plus, Check, Star, Volume2, VolumeX } from "lucide-react";
import VariableProximity from "./VariableProximity";
import FadeContent from "./FadeContent";
import { StarRating } from "./StarRating";
import { Movie, CwPlayContext } from "../lib/types";
import { getBackdropUrl } from "../lib/tmdb-utils";

interface HeroSectionProps {
    selectedMovie: Movie | null;
    heroTrailerUrl: string | null;
    cwPlayContext: CwPlayContext | null;
    watchlist: any[];
    ratings: Record<string, any>;
    defaultSource: string;
    effectiveEnabledSources: string[];
    selectedSource: string;
    activeStream: any;
    onPlay: (movie: Movie, startTime: number, season?: number, episode?: number, source?: string) => void;
    onToggleWatchlist: (movie: Movie) => void;
    onRate: (movie: Movie, rating: number) => void;
    getWatchlistId: (movie: Movie) => string;
}

function HeroSectionInner({
    selectedMovie,
    heroTrailerUrl,
    cwPlayContext,
    watchlist,
    ratings,
    defaultSource,
    effectiveEnabledSources,
    selectedSource,
    activeStream,
    onPlay,
    onToggleWatchlist,
    onRate,
    getWatchlistId,
}: HeroSectionProps) {
    const heroIframeRef = useRef<HTMLIFrameElement>(null);
    const [heroTrailerMuted, setHeroTrailerMuted] = useState(true);
    const [showHeroTrailer, setShowHeroTrailer] = useState(false);

    useEffect(() => {
        setShowHeroTrailer(false);
        let timer: any;
        if (heroTrailerUrl && !activeStream) {
            timer = setTimeout(() => setShowHeroTrailer(true), 3000);
        }
        return () => clearTimeout(timer);
    }, [heroTrailerUrl, activeStream]);

    return (
        <section className="relative h-[calc(100dvh-350px)] md:h-[66vh] w-full rounded-2xl overflow-hidden border border-slate-800/40 shadow-2xl bg-[#090b14]/90 md:bg-[#090b14]/40 md:backdrop-blur-xl mt-4 md:mt-0">
            {selectedMovie && (
                <div
                    key={selectedMovie.id}
                    className="absolute inset-0 z-0 transition-opacity duration-700 ease-out will-animate"
                    style={{ opacity: 1 }}
                >
                    <Image
                        src={getBackdropUrl(selectedMovie.backdrop_path)}
                        alt={selectedMovie.title || selectedMovie.name || "Movie Backdrop"}
                        fill
                        priority
                        className={`object-cover object-center pointer-events-none transition-opacity duration-700 ease-out ${
                            showHeroTrailer ? 'opacity-0' : 'opacity-100'
                        }`}
                    />
                    {heroTrailerUrl && !activeStream && (
                        <div className={`absolute inset-0 z-0 bg-black transition-opacity duration-700 ease-out pointer-events-none flex items-center justify-center overflow-hidden ${showHeroTrailer ? 'opacity-100' : 'opacity-0'}`}>
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
                </div>
            )}

            {/* Hero Content Overlay */}
            <div className="absolute inset-0 z-10 flex flex-col justify-end p-5 pb-8 md:p-14 gap-3 md:gap-5">
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
                                            ? cwPlayContext.source : defaultSource;
                                        if (src) onPlay(selectedMovie, cwPlayContext.timestamp, cwPlayContext.season, cwPlayContext.episode, src);
                                    } else {
                                        onPlay(selectedMovie, 0, undefined, undefined, defaultSource);
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
                                onClick={() => onToggleWatchlist(selectedMovie)}
                                className="px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-slate-900/90 md:bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 md:backdrop-blur-sm text-white font-semibold text-[11px] md:text-sm flex items-center gap-1.5 transition-all duration-300 active:scale-95"
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
                                    onChange={(val) => onRate(selectedMovie, val)}
                                />
                            </div>
                        </div>
                    </FadeContent>
                )}
            </div>
        </section>
    );
}

export const HeroSection = memo(HeroSectionInner);
