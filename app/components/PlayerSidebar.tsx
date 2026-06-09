"use client";

import { memo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import GlassSurface from "./GlassSurface";
import { CustomSelect } from "./CustomSelect";
import { StarRating } from "./StarRating";
import { SOURCES } from "../lib/sources-config";

interface PlayerSidebarProps {
    selectedSource: string;
    effectiveEnabledSources: string[];
    selectedShowDetails: any;
    selectedSeason: number;
    selectedEpisode: number;
    episodesList: number[];
    ratings: Record<string, any>;
    activeStreamDetails: any;
    onSourceChange: (src: string) => void;
    onRate: (movie: any, rating: number, thoughts?: string) => void;
    onChangeEpisode: (season: number, episode: number) => void;
}

function PlayerSidebarInner({
    selectedSource,
    effectiveEnabledSources,
    selectedShowDetails,
    selectedSeason,
    selectedEpisode,
    episodesList,
    ratings,
    activeStreamDetails,
    onSourceChange,
    onRate,
    onChangeEpisode,
}: PlayerSidebarProps) {
    const currentRating = ratings[activeStreamDetails?.id]?.rating || 0;
    const [thoughts, setThoughts] = useState("");
    const [isEditingThoughts, setIsEditingThoughts] = useState(false);

    useEffect(() => {
        if (!isEditingThoughts && activeStreamDetails?.id) {
            setThoughts(ratings[activeStreamDetails.id]?.thoughts || "");
        }
    }, [activeStreamDetails?.id, ratings, isEditingThoughts]);

    const handleThoughtsBlur = () => {
        setIsEditingThoughts(false);
        if (activeStreamDetails && currentRating > 0) {
            if (thoughts !== (ratings[activeStreamDetails.id]?.thoughts || "")) {
                onRate(activeStreamDetails, currentRating, thoughts);
            }
        }
    };

    const handleSeasonChangeInPlayer = (seasonNum: number) => {
        const seasonObj = selectedShowDetails?.seasons?.find((s: any) => s.season_number === seasonNum);
        const epCount = seasonObj ? seasonObj.episode_count : 1;
        onChangeEpisode(seasonNum, 1);
    };

    const goToPrevEpisode = () => {
        if (selectedEpisode > 1) { onChangeEpisode(selectedSeason, selectedEpisode - 1); return; }
        const prevSeason = selectedShowDetails?.seasons?.filter((s: any) => s.season_number > 0).find((s: any) => s.season_number === selectedSeason - 1);
        if (prevSeason && prevSeason.episode_count > 0) onChangeEpisode(prevSeason.season_number, prevSeason.episode_count);
    };

    const goToNextEpisode = () => {
        const seasonObj = selectedShowDetails?.seasons?.find((s: any) => s.season_number === selectedSeason);
        const maxEp = seasonObj?.episode_count || 1;
        if (selectedEpisode < maxEp) { onChangeEpisode(selectedSeason, selectedEpisode + 1); return; }
        const nextSeason = selectedShowDetails?.seasons?.filter((s: any) => s.season_number > 0).find((s: any) => s.season_number === selectedSeason + 1);
        if (nextSeason && nextSeason.episode_count > 0) onChangeEpisode(nextSeason.season_number, 1);
    };

    return (
        <GlassSurface className="w-full lg:w-80 xl:w-96 p-5 flex flex-col gap-6 !border-white/[0.03] !bg-transparent !backdrop-blur-none h-auto max-h-[70vh] lg:max-h-full overflow-y-auto no-scrollbar rounded-2xl !shadow-none">
            {/* Source Selector */}
            <div className="flex flex-col gap-2 pb-4 border-b border-white/[0.05]">
                <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1">Source</span>
                <CustomSelect
                    value={selectedSource}
                    onChange={(val: string) => onSourceChange(val)}
                    options={SOURCES.filter((s) => effectiveEnabledSources.includes(s.id)).map((s) => ({ value: s.id, label: s.name }))}
                />
            </div>

            {/* Rating System */}
            <div className="flex flex-col gap-3 pb-4 border-b border-white/[0.05]">
                <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1">
                    Rate Title
                </span>
                <StarRating
                    value={currentRating}
                    onChange={(val) => activeStreamDetails && onRate(activeStreamDetails, val, thoughts)}
                />
                <div className="flex flex-col gap-1 mt-2">
                    <span className="text-[8px] font-medium uppercase tracking-[0.15em] text-white/30 mb-0.5">Thoughts</span>
                    <textarea
                        value={thoughts}
                        onChange={(e) => setThoughts(e.target.value)}
                        onFocus={() => setIsEditingThoughts(true)}
                        onBlur={handleThoughtsBlur}
                        disabled={currentRating === 0}
                        placeholder={currentRating === 0 ? "Rate first to add thoughts..." : "What did you think?"}
                        className="w-full h-24 px-3 py-2 text-xs text-white/80 bg-white/[0.02] border border-white/[0.05] hover:border-white/10 focus:border-white/20 rounded-xl resize-none outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors placeholder:text-white/20"
                    />
                </div>
            </div>

            {/* TV Season/Episode Selector */}
            {selectedShowDetails && (
                <div className="flex flex-col gap-3 pb-4 border-b border-white/[0.05]">
                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1">
                        TV Episode Control
                    </span>
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
                                onChange={(val: number) => onChangeEpisode(selectedSeason, val)}
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
    );
}

export const PlayerSidebar = memo(PlayerSidebarInner);
