"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X } from "lucide-react";
import ScrambledText from "./ScrambledText";
import { PlayerSidebar } from "./PlayerSidebar";

interface PlayerModalProps {
    activeStream: {
        tmdbId: string;
        title: string;
        details: any;
        embedUrl: string;
    } | null;
    playerError: string | null;
    playerContainerRef: React.RefObject<HTMLDivElement | null>;
    playerRef: React.RefObject<HTMLIFrameElement | null>;
    effectiveSource: string;
    effectiveEnabledSources: string[];
    selectedShowDetails: any;
    selectedSeason: number;
    selectedEpisode: number;
    episodesList: number[];
    ratings: Record<string, any>;
    onClose: () => void;
    onSourceChange: (source: string) => void;
    onRate: (movie: any, rating: number) => void;
    onChangeEpisode: (season: number, episode: number) => void;
}

export function PlayerModal({
    activeStream,
    playerError,
    playerContainerRef,
    playerRef,
    effectiveSource,
    effectiveEnabledSources,
    selectedShowDetails,
    selectedSeason,
    selectedEpisode,
    episodesList,
    ratings,
    onClose,
    onSourceChange,
    onRate,
    onChangeEpisode,
}: PlayerModalProps) {
    return (
        <AnimatePresence>
            {activeStream && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xl md:bg-black/60 flex flex-col items-center justify-start md:justify-center p-4 pt-10 pb-20 md:p-6 md:backdrop-blur-3xl overflow-y-auto w-full h-full"
                >
            <div className="w-full max-w-7xl flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-base md:text-lg font-light tracking-wide text-white/95 flex items-center gap-2">
                        <ScrambledText text={activeStream?.title || ""} />
                    </h2>
                </div>
                <div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95 duration-200 cursor-pointer"
                    >
                        <X className="w-4.5 h-4.5" />
                    </button>
                </div>
            </div>

            <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch justify-center h-auto lg:h-[62vh] xl:h-[66vh]">

                <div ref={playerContainerRef} className="flex-none md:flex-grow w-full lg:w-[72%] aspect-video lg:aspect-auto relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-2xl">
                    {activeStream?.embedUrl && (
                        <iframe
                            ref={playerRef}
                            src={activeStream.embedUrl}
                            className="w-full h-full"
                            allow="encrypted-media"
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
                />
            </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}