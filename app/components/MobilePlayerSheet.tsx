"use client";

import { memo, useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, Loader2, Plus, Check, Play, Star, Layers, Info, Sparkles, Trash2 } from "lucide-react";
import { StarRating } from "./StarRating";
import { CustomSelect } from "./CustomSelect";
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
    onDelete?: (tmdbId: string) => void;
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
    onDelete,
}: MobilePlayerSheetProps) {
    const [thoughts, setThoughts] = useState(
        () => ratings[activeStreamDetails?.id]?.thoughts || ""
    );
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const similarScrollRef = useRef<HTMLDivElement>(null);
    const scrollSimilar = (direction: 'left' | 'right') => {
        if (similarScrollRef.current) {
            const { clientWidth } = similarScrollRef.current;
            const scrollAmount = direction === 'left' ? -clientWidth * 0.7 : clientWidth * 0.7;
            similarScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    const isTv = !!selectedShowDetails;
    const currentRating = ratings[activeStreamDetails?.id]?.rating || 0;
    const enabledSources = SOURCES.filter((s) => effectiveEnabledSources.includes(s.id));

    useEffect(() => {
        if (!confirmingDelete) return;
        const t = setTimeout(() => setConfirmingDelete(false), 3000);
        return () => clearTimeout(t);
    }, [confirmingDelete]);

    const handleDeleteClick = () => {
        if (!onDelete || !activeStreamDetails?.id) return;
        if (!confirmingDelete) {
            setConfirmingDelete(true);
            return;
        }
        onDelete(activeStreamDetails.id);
        setConfirmingDelete(false);
    };

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

    const tmdbVote = detailsFullData?.vote_average ?? activeStreamDetails?.vote_average;
    const remainingCount = Math.max(0, similarItems.length - similarDisplayCount);

    const displayItems = similarItems.slice(0, similarDisplayCount);

    const tabs: { id: MobileTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
        { id: "controls", label: isTv ? "EPISODES" : "PLAYER", Icon: isTv ? Layers : Play },
        { id: "details", label: "DETAILS", Icon: Info },
        { id: "similar", label: "RELATED", Icon: Sparkles },
    ];

    // Selected similar item data
    const selectedItem = similarItems[selectedSimilarIdx];
    const selectedTitle =
        selectedSimilarDetails?.title || selectedSimilarDetails?.name ||
        selectedItem?.title || selectedItem?.name || "";
    const selectedOverview =
        selectedSimilarDetails?.overview || selectedItem?.overview || "";
    const selectedYear = (
        selectedSimilarDetails?.release_date || selectedSimilarDetails?.first_air_date ||
        selectedItem?.release_date || selectedItem?.first_air_date || ""
    ).split("-")[0];
    const selectedVote = selectedSimilarDetails?.vote_average ?? selectedItem?.vote_average;
    const selectedPct = selectedItem?.similarity;
    const selectedMediaType = selectedItem?.media_type || "movie";

    const headerYear = activeTab === "similar" ? selectedYear : currentYear;
    const headerVote = activeTab === "similar" ? selectedVote : tmdbVote;
    const headerPct = activeTab === "similar" ? selectedPct : null;
    const headerMediaType = activeTab === "similar" ? selectedMediaType : (isTv ? "tv" : "movie");

    return (
        <div className="lg:hidden w-full flex flex-col">
            {/* ── Title & Meta ─────────────────────────────────────── */}
            <div className="px-5 pt-4 pb-3 flex flex-col gap-1">
                <h1 className="text-[17px] font-semibold tracking-tight text-white leading-tight truncate">
                    {activeStreamTitle}
                </h1>
                <div className="flex items-center gap-2 text-[11px] text-white/40 flex-wrap">
                    {headerYear && <span>{headerYear}</span>}
                    {headerYear && ((headerVote > 0) || headerPct) && <span className="w-0.5 h-0.5 rounded-full bg-white/20" />}
                    {headerVote > 0 && (
                        <span className="flex items-center gap-1 text-white/50">
                            <Star className="w-2.5 h-2.5 fill-white/50 text-white/50" />
                            {headerVote.toFixed(1)}
                        </span>
                    )}
                    {headerVote > 0 && headerPct && <span className="w-0.5 h-0.5 rounded-full bg-white/20" />}
                    {headerPct && (
                        <span className="text-white/50">{headerPct}% match</span>
                    )}
                    {activeTab === "similar" ? (
                        <>
                            <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
                            <span className="uppercase tracking-wide">{headerMediaType === "tv" ? "Series" : "Film"}</span>
                        </>
                    ) : (
                        isTv && (
                            <>
                                <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
                                <span className="font-mono">
                                    S{String(selectedSeason).padStart(2, "0")}E{String(selectedEpisode).padStart(2, "0")}
                                </span>
                            </>
                        )
                    )}
                </div>
            </div>

            {/* ── Tab Bar ──────────────────────────────────────────── */}
            <div className="px-5 pb-3">
                <div className="flex p-0.5 bg-white/[0.04] rounded-xl">
                    {tabs.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => onTabChange(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[11px] font-medium tracking-wide transition-all cursor-pointer ${
                                activeTab === id
                                    ? "bg-white/[0.12] text-white"
                                    : "text-white/35"
                            }`}
                        >
                            <Icon className="w-3 h-3" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Panels ───────────────────────────────────────── */}

            {/* CONTROLS */}
            {activeTab === "controls" && (
                <div className="px-5 pb-8 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">Source</span>
                        {isTv ? (
                            <CustomSelect
                                value={selectedSource}
                                onChange={(val: string) => onSourceChange(val)}
                                options={enabledSources.map((s) => ({ value: s.id, label: s.name }))}
                            />
                        ) : (
                            <div className="flex flex-col gap-1">
                                {enabledSources.map((s) => {
                                    const isActive = s.id === selectedSource;
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => onSourceChange(s.id)}
                                            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs active:scale-[0.98] transition-all cursor-pointer ${
                                                isActive
                                                    ? "bg-white/[0.08] border-white/15 text-white"
                                                    : "bg-transparent border-white/[0.05] text-white/50"
                                            }`}
                                        >
                                            <span className="font-medium">{s.name}</span>
                                            {isActive && <Check className="w-3 h-3 text-white/70" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {isTv && (
                        <>
                            <div className="h-px bg-white/[0.05]" />
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">Season</span>
                                <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
                                    {validSeasons.map((s: any) => {
                                        const isActive = s.season_number === selectedSeason;
                                        return (
                                            <button
                                                key={s.season_number}
                                                onClick={() => onChangeEpisode(s.season_number, 1)}
                                                className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-medium border transition-all active:scale-95 cursor-pointer ${
                                                    isActive
                                                        ? "bg-white text-black border-white"
                                                        : "bg-transparent text-white/50 border-white/[0.08]"
                                                }`}
                                            >
                                                {s.name || `S${s.season_number}`}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">Episode</span>
                                    <span className="text-[10px] text-white/25 font-mono">{selectedEpisode} / {episodesList.length || 1}</span>
                                </div>
                                <div className="grid grid-cols-7 gap-1.5">
                                    {episodesList.map((ep) => {
                                        const isActive = ep === selectedEpisode;
                                        return (
                                            <button
                                                key={ep}
                                                onClick={() => onChangeEpisode(selectedSeason, ep)}
                                                className={`aspect-square rounded-lg text-[11px] font-medium border transition-all duration-150 active:scale-90 cursor-pointer ${
                                                    isActive
                                                        ? "bg-white text-black border-white shadow-sm"
                                                        : "bg-white/[0.04] text-white/60 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/80"
                                                }`}
                                            >
                                                {ep}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={goToPrevEpisode}
                                    disabled={prevDisabled}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/70 text-[10px] font-medium disabled:opacity-25 active:scale-95 transition-all cursor-pointer"
                                >
                                    <ChevronLeft className="w-3 h-3" /> Prev
                                </button>
                                <button
                                    onClick={goToNextEpisode}
                                    disabled={nextDisabled}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white text-black text-[10px] font-semibold disabled:opacity-25 active:scale-95 transition-all cursor-pointer"
                                >
                                    Next <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </>
                    )}

                    {onDelete && (
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">Log</span>
                            <button
                                onClick={handleDeleteClick}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.98] cursor-pointer ${
                                    confirmingDelete
                                        ? "bg-rose-500/80 text-white"
                                        : "bg-rose-500/10 text-rose-400/90 hover:bg-rose-500/15 border border-rose-500/20"
                                }`}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                {confirmingDelete ? "Confirm delete?" : "Delete from log"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* DETAILS */}
            {activeTab === "details" && (
                <div className="px-5 pb-8 flex flex-col gap-4">
                    {detailsLoading ? (
                        <div className="flex items-center justify-center py-14">
                            <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-white/60 leading-relaxed">
                                {detailsFullData?.overview || activeStreamDetails?.overview || "No overview available."}
                            </p>
                            <div className="h-px bg-white/[0.05]" />
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">Your Rating</span>
                                    <StarRating
                                        value={currentRating}
                                        onChange={(val) => activeStreamDetails && onRate(activeStreamDetails, val, thoughts)}
                                    />
                                </div>
                                <textarea
                                    value={thoughts}
                                    onChange={(e) => setThoughts(e.target.value)}
                                    onBlur={handleThoughtsBlur}
                                    disabled={currentRating === 0}
                                    placeholder={currentRating === 0 ? "Rate first to add thoughts..." : "Share your thoughts..."}
                                    className="w-full min-h-[80px] px-3 py-2.5 text-sm text-white/70 bg-white/[0.03] border border-white/[0.06] focus:border-white/15 rounded-xl resize-none outline-none disabled:opacity-40 transition-colors placeholder:text-white/20"
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* SIMILAR — full-height layout: info panel + horizontal scroll strip */}
            {activeTab === "similar" && (
                <div className="flex flex-col flex-1 min-h-0">
                    {similarLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                            <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
                            <span className="text-[10px] text-white/25 uppercase tracking-widest">Finding similar</span>
                        </div>
                    ) : similarError ? (
                        <div className="flex items-center justify-center py-12 px-5">
                            <span className="text-[11px] text-rose-400/70 text-center">{similarError}</span>
                        </div>
                    ) : similarItems.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <span className="text-[11px] text-white/25">No similar titles found</span>
                        </div>
                    ) : (
                        <>
                            {/* Selected item info — fills available space */}
                            {selectedItem && (
                                <div className="px-5 pb-4 flex flex-col gap-3">
                                    {/* Overview */}
                                    {selectedOverview ? (
                                        <p className="text-xs text-white/45 leading-relaxed line-clamp-2">
                                            {selectedOverview}
                                        </p>
                                    ) : null}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={onPlaySimilar}
                                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white text-black text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                                        >
                                            <Play className="w-3 h-3 fill-black" /> Play
                                        </button>
                                        <button
                                            onClick={onToggleWatchlistForSimilar}
                                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/[0.12] text-white/60 text-xs font-medium active:scale-95 transition-all cursor-pointer"
                                        >
                                            {isSelectedSimilarInWatchlist
                                                ? <><Check className="w-3 h-3" /> Saved</>
                                                : <><Plus className="w-3 h-3" /> Watchlist</>
                                            }
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Horizontal scroll strip - Mathematically locked symmetric layout */}
                            <div className="border-t border-white/[0.05] pt-2 pb-4 px-5">
                                <div className="relative w-full group/row">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); scrollSimilar('left'); }}
                                        className="absolute left-0 top-0 bottom-0 w-12 z-20 cursor-pointer"
                                        aria-label="Scroll Left"
                                    />
                                    <div ref={similarScrollRef} className="grid grid-flow-col auto-cols-[calc((100%-1rem)/2)] sm:auto-cols-[calc((100%-2rem)/3)] md:auto-cols-[calc((100%-3rem)/4)] lg:auto-cols-[calc((100%-4rem)/5)] gap-4 overflow-x-auto py-2 no-scrollbar snap-x snap-mandatory scroll-smooth relative z-10">
                                        {displayItems.map((item, i) => (
                                            <SimilarHCard
                                                key={item.id || i}
                                                item={item}
                                                isSelected={i === selectedSimilarIdx}
                                                onSelect={() => onSelectSimilar(i)}
                                            />
                                        ))}
                                        {remainingCount > 0 && (
                                            <button
                                                onClick={onLoadMore}
                                                className="snap-start w-full flex flex-col items-center justify-center gap-1 rounded-xl border border-white/[0.06] text-white/30 text-[10px] cursor-pointer active:scale-95 transition-all"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>{remainingCount} more</span>
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); scrollSimilar('right'); }}
                                        className="absolute right-0 top-0 bottom-0 w-12 z-20 cursor-pointer"
                                        aria-label="Scroll Right"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// Horizontal strip card — fixed width, poster-style
function SimilarHCard({
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
            className={`snap-start w-full flex flex-col gap-1.5 text-left cursor-pointer active:scale-95 transition-all`}
        >
            <div className={`relative w-full rounded-xl overflow-hidden bg-black border transition-all ${
                isSelected ? "border-white/40 shadow-[0_0_0_1px_rgba(255,255,255,0.15)]" : "border-white/[0.07]"
            }`} style={{ aspectRatio: "16/9" }}>
                {hasImage ? (
                    <Image
                        src={getPosterUrl(item.backdrop_path || item.poster_path)}
                        alt={title}
                        fill
                        onLoad={() => setLoaded(true)}
                        className={`object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
                        sizes="50vw"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/10">
                        <Film className="w-6 h-6" />
                    </div>
                )}
                {isSelected && (
                    <div className="absolute inset-0 bg-white/[0.06]" />
                )}
                {item.similarity && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/80 text-[9px] font-semibold text-white/80">
                        {item.similarity}%
                    </div>
                )}
            </div>
            <div className="px-0.5">
                <div className={`text-[11px] font-medium leading-tight truncate transition-colors ${isSelected ? "text-white" : "text-white/55"}`}>
                    {title}
                </div>
                {year && <div className="text-[10px] text-white/25 mt-0.5">{year}</div>}
            </div>
        </button>
    );
}

export const MobilePlayerSheet = memo(MobilePlayerSheetInner);
