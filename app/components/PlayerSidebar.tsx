"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, Loader2 } from "lucide-react";
import GlassSurface from "./GlassSurface";
import { CustomSelect } from "./CustomSelect";
import { StarRating } from "./StarRating";
import { SOURCES } from "../lib/sources-config";
import { getPosterUrl } from "../lib/tmdb-utils";

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
    activeTab: "controls" | "details" | "similar";
    onTabChange: (tab: "controls" | "details" | "similar") => void;
    detailsFullData: any | null;
    detailsLoading: boolean;
    similarItems: any[];
    similarLoading: boolean;
    similarError: string | null;
    similarDisplayCount: number;
    onLoadMore: () => void;
    selectedSimilarIdx: number;
    onSelectSimilar: (idx: number) => void;
}

function SimilarCard({ item, isSelected = false }: { item: any; isSelected?: boolean }) {
    const [loaded, setLoaded] = useState(false);
    const hasImage = item.backdrop_path || item.poster_path;
    const title = item.title || item.name || "Untitled";
    const year = (item.release_date || item.first_air_date || "").split("-")[0];

    return (
        <div
            className={`flex gap-3 items-start p-3 rounded-xl border transition-all ${
                isSelected
                    ? "bg-white/[0.08] border-white/15"
                    : "hover:bg-white/[0.03] border-transparent"
            }`}
        >
            <div className="relative w-[96px] aspect-[16/9] rounded-lg overflow-hidden flex-shrink-0 bg-slate-950 border border-slate-800/40 shadow-sm">
                {hasImage ? (
                    <Image
                        src={getPosterUrl(item.backdrop_path || item.poster_path)}
                        alt={title}
                        fill
                        onLoad={() => setLoaded(true)}
                        className={`object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
                        sizes="96px"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                        <Film className="w-4 h-4" />
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="text-sm font-medium truncate text-white/95">{title}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {year && <span className="text-[10px] text-slate-400">{year}</span>}
                    {year && <span className="w-1 h-1 rounded-full bg-slate-700" />}
                    <span className="text-[10px] text-white/60 font-semibold">{item.similarity}%</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span className="text-[10px] text-slate-500 uppercase">{item.media_type === "tv" ? "TV" : "Film"}</span>
                </div>
            </div>
        </div>
    );
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
}: PlayerSidebarProps) {
    const currentRating = ratings[activeStreamDetails?.id]?.rating || 0;
    const [thoughts, setThoughts] = useState("");
    const [isEditingThoughts, setIsEditingThoughts] = useState(false);

    const handleThoughtsBlur = () => {
        setIsEditingThoughts(false);
        if (activeStreamDetails && currentRating > 0) {
            if (thoughts !== (ratings[activeStreamDetails.id]?.thoughts || "")) {
                onRate(activeStreamDetails, currentRating, thoughts);
            }
        }
    };

    const handleSeasonChangeInPlayer = (seasonNum: number) => {
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

    const remainingCount = Math.max(0, similarItems.length - similarDisplayCount);

    const currentGenres = detailsFullData?.genres || [];
    const currentRuntime = detailsFullData?.runtime;
    const currentVote = detailsFullData?.vote_average;

    return (
        <GlassSurface className="w-full lg:w-80 xl:w-96 p-5 flex flex-col gap-5 !border-white/[0.03] !bg-transparent !backdrop-blur-none flex-1 min-h-0 lg:flex-none lg:h-auto lg:max-h-full overflow-y-auto lg:overflow-y-visible xl:overflow-y-auto no-scrollbar rounded-2xl !shadow-none">
            {/* Tab Toggle */}
            <div className="flex gap-0.5 p-0.5 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                {(["controls", "details", "similar"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => onTabChange(tab)}
                        className={`flex-1 py-1.5 text-[10px] font-medium tracking-wider uppercase rounded-md transition-all cursor-pointer ${
                            activeTab === tab
                                ? "bg-white/10 text-white shadow-sm"
                                : "text-white/40 hover:text-white/70"
                        }`}
                    >
                        {tab === "details" ? "Details" : tab === "similar" ? "Similar" : "Controls"}
                    </button>
                ))}
            </div>

            {activeTab === "controls" ? (
                <>
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
                                    disabled={selectedEpisode <= 1 && !selectedShowDetails?.seasons?.filter((s: any) => s.season_number > 0).some((s: any) => s.season_number === selectedSeason - 1)}
                                    className="flex items-center gap-1 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/10 disabled:opacity-25 disabled:cursor-not-allowed text-white/70 hover:text-white text-xs transition-all active:scale-95 cursor-pointer"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                                </button>
                                <span className="text-[10px] text-white/30 font-mono tracking-wider">
                                    S{String(selectedSeason).padStart(2, "0")} E{String(selectedEpisode).padStart(2, "0")}
                                </span>
                                <button
                                    onClick={goToNextEpisode}
                                    disabled={selectedEpisode >= (selectedShowDetails?.seasons?.find((s: any) => s.season_number === selectedSeason)?.episode_count || 1) && (!selectedShowDetails?.seasons?.some((s: any) => s.season_number === selectedSeason + 1))}
                                    className="flex items-center gap-1 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/10 disabled:opacity-25 disabled:cursor-not-allowed text-white/70 hover:text-white text-xs transition-all active:scale-95 cursor-pointer"
                                >
                                    Next <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : activeTab === "details" ? (
                <div className="flex flex-col gap-3">
                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">Details</span>

                    {detailsLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                        </div>
                    ) : detailsFullData ? (
                        <>
                            {currentGenres.length > 0 && (
                                <span className="text-xs text-white/70">
                                    {currentGenres.map((g: any) => g.name).join(", ")}
                                </span>
                            )}

                            <div className="flex flex-col gap-2 text-xs">
                                {detailsFullData.release_date && (
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Released</span>
                                        <span className="text-white/70">{detailsFullData.release_date}</span>
                                    </div>
                                )}
                                {detailsFullData.first_air_date && !detailsFullData.release_date && (
                                    <div className="flex justify-between">
                                        <span className="text-white/40">First Aired</span>
                                        <span className="text-white/70">{detailsFullData.first_air_date}</span>
                                    </div>
                                )}
                                {currentRuntime && (
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Runtime</span>
                                        <span className="text-white/70">{currentRuntime} min</span>
                                    </div>
                                )}
                                {currentVote > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Rating</span>
                                        <span className="text-white/70">{currentVote.toFixed(1)} / 10</span>
                                    </div>
                                )}
                                {detailsFullData.status && (
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Status</span>
                                        <span className="text-white/70">{detailsFullData.status}</span>
                                    </div>
                                )}
                                {detailsFullData.seasons && (
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Seasons</span>
                                        <span className="text-white/70">{detailsFullData.seasons.filter((s: any) => s.season_number > 0).length}</span>
                                    </div>
                                )}
                                {detailsFullData.number_of_episodes && (
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Episodes</span>
                                        <span className="text-white/70">{detailsFullData.number_of_episodes}</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-b border-white/[0.05]" />

                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">Overview</span>
                                <p className="text-xs text-white/60 leading-relaxed">
                                    {detailsFullData.overview || "No overview available."}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-[10px] text-white/30 text-center">No details available</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-3 min-h-0">
                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">Similar Titles</span>

                    {similarLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                        </div>
                    ) : similarError ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-[10px] text-rose-400/80 text-center leading-relaxed max-w-xs">
                                {similarError}
                            </span>
                        </div>
                    ) : similarItems.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-[10px] text-white/30 text-center">No similar titles found</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar">
                            {similarItems.slice(0, similarDisplayCount).map((item, i) => (
                                <button
                                    key={item.id || i}
                                    onClick={() => onSelectSimilar(i)}
                                    className="w-full text-left transition-all cursor-pointer"
                                >
                                    <SimilarCard item={item} isSelected={i === selectedSimilarIdx} />
                                </button>
                            ))}

                            {remainingCount > 0 && (
                                <button
                                    onClick={onLoadMore}
                                    className="w-full py-2.5 mt-1 text-[10px] font-medium tracking-wider uppercase text-white/40 hover:text-white/70 border border-white/[0.05] hover:border-white/10 rounded-lg transition-all cursor-pointer"
                                >
                                    Load More ({remainingCount} remaining)
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </GlassSurface>
    );
}

export const PlayerSidebar = memo(PlayerSidebarInner);
