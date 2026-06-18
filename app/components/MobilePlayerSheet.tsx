"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, Loader2, Plus, Check, Play, Star, Settings2, Layers, Info, Sparkles } from "lucide-react";
import { StarRating } from "./StarRating";
import { SOURCES } from "../lib/sources-config";
import { getPosterUrl } from "../lib/tmdb-utils";

type MobileTab = "controls" | "details" | "similar";

interface MobilePlayerSheetProps {
    // Active stream / title context
    activeStreamDetails: any;
    activeStreamTitle: string;
    currentYear: string;

    // Source
    selectedSource: string;
    effectiveEnabledSources: string[];
    onSourceChange: (src: string) => void;

    // Ratings
    ratings: Record<string, any>;
    onRate: (movie: any, rating: number, thoughts?: string) => void;

    // TV / episode control
    selectedShowDetails: any;
    selectedSeason: number;
    selectedEpisode: number;
    episodesList: number[];
    onChangeEpisode: (season: number, episode: number) => void;

    // Tabs
    activeTab: MobileTab;
    onTabChange: (tab: MobileTab) => void;

    // Details panel
    detailsFullData: any | null;
    detailsLoading: boolean;

    // Similar panel
    similarItems: any[];
    similarLoading: boolean;
    similarError: string | null;
    similarDisplayCount: number;
    onLoadMore: () => void;
    selectedSimilarIdx: number;
    onSelectSimilar: (idx: number) => void;
    selectedSimilarDetails: any | null;
    isSelectedSimilarInWatchlist: boolean;
    onToggleWatchlistForSimilar: () => void;
    onPlaySimilar: () => void;
}

function MobilePlayerSheetInner({
    activeStreamDetails,
    activeStreamTitle,
    currentYear,
    selectedSource,
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
    isSelectedSimilarInWatchlist,
    onToggleWatchlistForSimilar,
    onPlaySimilar,
}: MobilePlayerSheetProps) {
    const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
    const [thoughts, setThoughts] = useState(
        () => ratings[activeStreamDetails?.id]?.thoughts || ""
    );

    const isTv = !!selectedShowDetails;
    const currentRating = ratings[activeStreamDetails?.id]?.rating || 0;
    const currentSourceName =
        SOURCES.find((s) => s.id === selectedSource)?.name || selectedSource;

    const handleThoughtsBlur = () => {
        if (activeStreamDetails && currentRating > 0) {
            if (thoughts !== (ratings[activeStreamDetails.id]?.thoughts || "")) {
                onRate(activeStreamDetails, currentRating, thoughts);
            }
        }
    };

    const goToPrevEpisode = () => {
        if (selectedEpisode > 1) {
            onChangeEpisode(selectedSeason, selectedEpisode - 1);
            return;
        }
        const prevSeason = selectedShowDetails?.seasons
            ?.filter((s: any) => s.season_number > 0)
            .find((s: any) => s.season_number === selectedSeason - 1);
        if (prevSeason && prevSeason.episode_count > 0)
            onChangeEpisode(prevSeason.season_number, prevSeason.episode_count);
    };

    const goToNextEpisode = () => {
        const seasonObj = selectedShowDetails?.seasons?.find(
            (s: any) => s.season_number === selectedSeason
        );
        const maxEp = seasonObj?.episode_count || 1;
        if (selectedEpisode < maxEp) {
            onChangeEpisode(selectedSeason, selectedEpisode + 1);
            return;
        }
        const nextSeason = selectedShowDetails?.seasons
            ?.filter((s: any) => s.season_number > 0)
            .find((s: any) => s.season_number === selectedSeason + 1);
        if (nextSeason && nextSeason.episode_count > 0)
            onChangeEpisode(nextSeason.season_number, 1);
    };

    const prevDisabled =
        selectedEpisode <= 1 &&
        !selectedShowDetails?.seasons
            ?.filter((s: any) => s.season_number > 0)
            .some((s: any) => s.season_number === selectedSeason - 1);

    const seasonObj = selectedShowDetails?.seasons?.find(
        (s: any) => s.season_number === selectedSeason
    );
    const maxEpInSeason = seasonObj?.episode_count || 1;
    const nextDisabled =
        selectedEpisode >= maxEpInSeason &&
        !selectedShowDetails?.seasons?.some(
            (s: any) => s.season_number === selectedSeason + 1
        );

    const validSeasons =
        selectedShowDetails?.seasons?.filter((s: any) => s.season_number > 0) || [];

    const genres = detailsFullData?.genres || activeStreamDetails?.genres || [];
    const runtime = detailsFullData?.runtime;
    const tmdbVote = detailsFullData?.vote_average ?? activeStreamDetails?.vote_average;

    const remainingCount = Math.max(0, similarItems.length - similarDisplayCount);

    const tabs: { id: MobileTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
        { id: "controls", label: isTv ? "EPISODES" : "PLAYER", Icon: isTv ? Layers : Play },
        { id: "details", label: "DETAILS", Icon: Info },
        { id: "similar", label: "RELATED", Icon: Sparkles },
    ];

    return (
        <div className="lg:hidden w-full flex flex-col gap-4 pb-8">
            {/* ── Title & Meta ─────────────────────────────────────── */}
            <div className="px-5 pt-4 flex flex-col gap-2">
                <h1 className="text-xl font-medium tracking-tight text-white leading-tight">
                    {activeStreamTitle}
                </h1>
                <div className="flex items-center gap-2 text-[11px] text-white/50 flex-wrap">
                    {currentYear && <span>{currentYear}</span>}
                    {currentYear && (tmdbVote || runtime) && (
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                    )}
                    {tmdbVote > 0 && (
                        <span className="flex items-center gap-1 text-white/70">
                            <Star className="w-3 h-3 fill-amber-300/80 text-amber-300/80" />
                            {tmdbVote.toFixed(1)}
                        </span>
                    )}
                    {runtime && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span>{runtime}m</span>
                        </>
                    )}
                    {isTv && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="font-mono text-white/60">
                                S{String(selectedSeason).padStart(2, "0")}E
                                {String(selectedEpisode).padStart(2, "0")}
                            </span>
                        </>
                    )}
                </div>
                {genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {genres.slice(0, 4).map((g: any) => (
                            <span
                                key={g.id || g.name}
                                className="text-[10px] uppercase tracking-wider text-white/60 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]"
                            >
                                {g.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Action Tiles ─────────────────────────────────────── */}
            <div className="px-5 grid grid-cols-3 gap-2">
                <button
                    onClick={() => onTabChange("details")}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] active:scale-95 active:bg-white/[0.06] transition-all cursor-pointer"
                >
                    <Star
                        className={`w-5 h-5 ${
                            currentRating > 0
                                ? "fill-amber-300/90 text-amber-300/90"
                                : "text-white/70"
                        }`}
                    />
                    <span className="text-[10px] uppercase tracking-wider text-white/70 font-medium">
                        {currentRating > 0 ? `${currentRating}/5` : "Rate"}
                    </span>
                </button>
                <button
                    onClick={() => setSourceSheetOpen(true)}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] active:scale-95 active:bg-white/[0.06] transition-all cursor-pointer min-w-0"
                >
                    <Settings2 className="w-5 h-5 text-white/70" />
                    <span className="text-[10px] uppercase tracking-wider text-white/70 font-medium truncate max-w-full px-1">
                        {currentSourceName}
                    </span>
                </button>
                <button
                    onClick={() => onTabChange("similar")}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] active:scale-95 active:bg-white/[0.06] transition-all cursor-pointer"
                >
                    <Sparkles className="w-5 h-5 text-white/70" />
                    <span className="text-[10px] uppercase tracking-wider text-white/70 font-medium">
                        Related
                    </span>
                </button>
            </div>

            {/* ── Tab Bar ──────────────────────────────────────────── */}
            <div className="px-5">
                <div className="flex p-1 bg-white/[0.03] border border-white/[0.05] rounded-xl">
                    {tabs.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => onTabChange(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-medium tracking-wider transition-all cursor-pointer ${
                                activeTab === id
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-white/45 hover:text-white/70"
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Panels ───────────────────────────────────────── */}
            <div className="px-5">
                {activeTab === "controls" && (
                    <div className="flex flex-col gap-4">
                        {isTv ? (
                            <>
                                {/* Season chip scroller */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">
                                        Season
                                    </span>
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-1 px-1 pb-1">
                                        {validSeasons.map((s: any) => {
                                            const isActive = s.season_number === selectedSeason;
                                            return (
                                                <button
                                                    key={s.season_number}
                                                    onClick={() =>
                                                        onChangeEpisode(s.season_number, 1)
                                                    }
                                                    className={`snap-start flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium border transition-all active:scale-95 cursor-pointer ${
                                                        isActive
                                                            ? "bg-white text-black border-white"
                                                            : "bg-white/[0.03] text-white/70 border-white/[0.08] hover:bg-white/[0.06]"
                                                    }`}
                                                >
                                                    {s.name || `Season ${s.season_number}`}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Episode grid */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">
                                            Episode
                                        </span>
                                        <span className="text-[10px] text-white/30 font-mono">
                                            {selectedEpisode} / {episodesList.length || 1}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                        {episodesList.map((ep) => {
                                            const isActive = ep === selectedEpisode;
                                            return (
                                                <button
                                                    key={ep}
                                                    onClick={() =>
                                                        onChangeEpisode(selectedSeason, ep)
                                                    }
                                                    className={`aspect-square rounded-lg text-xs font-medium border transition-all active:scale-95 cursor-pointer ${
                                                        isActive
                                                            ? "bg-white text-black border-white shadow-[0_0_0_2px_rgba(255,255,255,0.15)]"
                                                            : "bg-white/[0.03] text-white/70 border-white/[0.06] hover:bg-white/[0.06]"
                                                    }`}
                                                >
                                                    {ep}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Prev/Next */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={goToPrevEpisode}
                                        disabled={prevDisabled}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/80 text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" /> Previous
                                    </button>
                                    <button
                                        onClick={goToNextEpisode}
                                        disabled={nextDisabled}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
                                    >
                                        Next Episode <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-3 py-10">
                                <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                                    <Play className="w-5 h-5 text-white/60" />
                                </div>
                                <span className="text-xs text-white/50 text-center">
                                    Playing on{" "}
                                    <span className="text-white/80 font-medium">
                                        {currentSourceName}
                                    </span>
                                </span>
                                <button
                                    onClick={() => setSourceSheetOpen(true)}
                                    className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/70 underline-offset-4 hover:underline cursor-pointer"
                                >
                                    Change source
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "details" && (
                    <div className="flex flex-col gap-5">
                        {detailsLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                            </div>
                        ) : (
                            <>
                                {/* Overview */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">
                                        Overview
                                    </span>
                                    <p className="text-sm text-white/75 leading-relaxed">
                                        {detailsFullData?.overview ||
                                            activeStreamDetails?.overview ||
                                            "No overview available."}
                                    </p>
                                </div>

                                {/* Metadata grid */}
                                {detailsFullData && (
                                    <div className="flex flex-col gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                        {detailsFullData.release_date && (
                                            <MetaRow
                                                label="Released"
                                                value={detailsFullData.release_date}
                                            />
                                        )}
                                        {detailsFullData.first_air_date &&
                                            !detailsFullData.release_date && (
                                                <MetaRow
                                                    label="First Aired"
                                                    value={detailsFullData.first_air_date}
                                                />
                                            )}
                                        {runtime && (
                                            <MetaRow label="Runtime" value={`${runtime} min`} />
                                        )}
                                        {detailsFullData.vote_average > 0 && (
                                            <MetaRow
                                                label="TMDB"
                                                value={`${detailsFullData.vote_average.toFixed(1)} / 10`}
                                            />
                                        )}
                                        {detailsFullData.status && (
                                            <MetaRow
                                                label="Status"
                                                value={detailsFullData.status}
                                            />
                                        )}
                                        {detailsFullData.seasons && (
                                            <MetaRow
                                                label="Seasons"
                                                value={String(
                                                    detailsFullData.seasons.filter(
                                                        (s: any) => s.season_number > 0
                                                    ).length
                                                )}
                                            />
                                        )}
                                        {detailsFullData.number_of_episodes && (
                                            <MetaRow
                                                label="Episodes"
                                                value={String(detailsFullData.number_of_episodes)}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Rate & Thoughts */}
                                <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">
                                            Your Rating
                                        </span>
                                        <StarRating
                                            value={currentRating}
                                            onChange={(val) =>
                                                activeStreamDetails &&
                                                onRate(activeStreamDetails, val, thoughts)
                                            }
                                        />
                                    </div>
                                    <textarea
                                        value={thoughts}
                                        onChange={(e) => setThoughts(e.target.value)}
                                        onBlur={handleThoughtsBlur}
                                        disabled={currentRating === 0}
                                        placeholder={
                                            currentRating === 0
                                                ? "Rate first to add thoughts..."
                                                : "Share your thoughts..."
                                        }
                                        className="w-full min-h-[96px] px-3 py-3 text-sm text-white/85 bg-white/[0.02] border border-white/[0.06] focus:border-white/15 rounded-xl resize-none outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors placeholder:text-white/25"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === "similar" && (
                    <div className="flex flex-col gap-4">
                        {/* Selected similar action card */}
                        {similarItems.length > 0 && similarItems[selectedSimilarIdx] && (
                            <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">
                                        Selected
                                    </span>
                                    <h3 className="text-sm font-medium text-white/95 leading-snug">
                                        {selectedSimilarDetails?.title ||
                                            selectedSimilarDetails?.name ||
                                            similarItems[selectedSimilarIdx]?.title ||
                                            similarItems[selectedSimilarIdx]?.name}
                                        {similarItems[selectedSimilarIdx]?.similarity && (
                                            <span className="ml-2 text-[10px] text-white/50 font-normal">
                                                {similarItems[selectedSimilarIdx].similarity}% match
                                            </span>
                                        )}
                                    </h3>
                                </div>
                                <p className="text-xs text-white/60 leading-relaxed line-clamp-3">
                                    {selectedSimilarDetails?.overview ||
                                        similarItems[selectedSimilarIdx]?.overview ||
                                        "No overview available."}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={onPlaySimilar}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white text-black text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                                    >
                                        <Play className="w-3.5 h-3.5 fill-black" /> Play
                                    </button>
                                    <button
                                        onClick={onToggleWatchlistForSimilar}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/80 text-xs font-medium active:scale-95 transition-all cursor-pointer"
                                    >
                                        {isSelectedSimilarInWatchlist ? (
                                            <>
                                                <Check className="w-3.5 h-3.5" /> In List
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-3.5 h-3.5" /> Watchlist
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Grid */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">
                                More Like This
                            </span>
                            {similarLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                                </div>
                            ) : similarError ? (
                                <div className="flex items-center justify-center py-8">
                                    <span className="text-[10px] text-rose-400/80 text-center max-w-xs">
                                        {similarError}
                                    </span>
                                </div>
                            ) : similarItems.length === 0 ? (
                                <div className="flex items-center justify-center py-8">
                                    <span className="text-[10px] text-white/30">
                                        No similar titles found
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        {similarItems
                                            .slice(0, similarDisplayCount)
                                            .map((item, i) => (
                                                <SimilarGridCard
                                                    key={item.id || i}
                                                    item={item}
                                                    isSelected={i === selectedSimilarIdx}
                                                    onSelect={() => onSelectSimilar(i)}
                                                />
                                            ))}
                                    </div>
                                    {remainingCount > 0 && (
                                        <button
                                            onClick={onLoadMore}
                                            className="w-full py-3 mt-1 text-[10px] font-medium tracking-wider uppercase text-white/50 hover:text-white/80 bg-white/[0.02] border border-white/[0.05] hover:border-white/10 rounded-xl transition-all cursor-pointer"
                                        >
                                            Load More ({remainingCount} remaining)
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Source Bottom Sheet ──────────────────────────────── */}
            {sourceSheetOpen && (
                <div
                    onClick={() => setSourceSheetOpen(false)}
                    className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end animate-[fadeIn_0.2s_ease-out]"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-[#0b0c10] border-t border-white/10 rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,1rem)+1.25rem)] animate-[slideUp_0.25s_cubic-bezier(0.16,1,0.3,1)]"
                    >
                        <div className="w-12 h-1 rounded-full bg-white/15 mx-auto mb-5" />
                        <h3 className="text-sm font-medium text-white mb-4">Streaming source</h3>
                        <div className="flex flex-col gap-1.5">
                            {SOURCES.filter((s) =>
                                effectiveEnabledSources.includes(s.id)
                            ).map((s) => {
                                const isActive = s.id === selectedSource;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            onSourceChange(s.id);
                                            setSourceSheetOpen(false);
                                        }}
                                        className={`flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm active:scale-[0.98] transition-all cursor-pointer ${
                                            isActive
                                                ? "bg-white/10 border-white/20 text-white"
                                                : "bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.05]"
                                        }`}
                                    >
                                        <span className="font-medium">{s.name}</span>
                                        {isActive && (
                                            <Check className="w-4 h-4 text-white" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-baseline text-xs">
            <span className="text-white/40">{label}</span>
            <span className="text-white/80 text-right">{value}</span>
        </div>
    );
}

function SimilarGridCard({
    item,
    isSelected,
    onSelect,
}: {
    item: any;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const [loaded, setLoaded] = useState(false);
    const hasImage = item.backdrop_path || item.poster_path;
    const title = item.title || item.name || "Untitled";
    const year = (item.release_date || item.first_air_date || "").split("-")[0];

    return (
        <button
            onClick={onSelect}
            className={`relative flex flex-col gap-1.5 text-left rounded-xl overflow-hidden transition-all active:scale-95 cursor-pointer ${
                isSelected ? "ring-2 ring-white/40" : ""
            }`}
        >
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-slate-950 border border-white/[0.06]">
                {hasImage ? (
                    <Image
                        src={getPosterUrl(item.backdrop_path || item.poster_path)}
                        alt={title}
                        fill
                        onLoad={() => setLoaded(true)}
                        className={`object-cover transition-opacity duration-500 ${
                            loaded ? "opacity-100" : "opacity-0"
                        }`}
                        sizes="50vw"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                        <Film className="w-5 h-5" />
                    </div>
                )}
                {item.similarity && (
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-semibold text-white">
                        {item.similarity}%
                    </div>
                )}
            </div>
            <div className="px-1 pb-1">
                <div className="text-xs font-medium text-white/90 truncate">{title}</div>
                {year && <div className="text-[10px] text-white/40">{year}</div>}
            </div>
        </button>
    );
}

export const MobilePlayerSheet = memo(MobilePlayerSheetInner);
