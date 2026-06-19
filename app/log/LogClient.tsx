"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FadeImage } from "../components/FadeImage";
import { Star, Film } from "lucide-react";
import { Navbar } from "../components/Navbar";
import SettingsOverlay from "../components/SettingsOverlay";
import { SearchInput } from "../components/SearchInput";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { PlayerModal } from "../components/PlayerModal";
import { getBackdropUrl, getPosterUrl } from "../lib/tmdb-utils";
import { useUserLists } from "../hooks/useUserLists";
import { useSearch } from "../hooks/useSearch";
import { useSourcePrefs } from "../hooks/useSourcePrefs";
import { buildEmbedUrl } from "../lib/sources-config";
import { getDetails } from "../lib/details-cache";
import { flushGlobalProgress } from "../hooks/usePlayerProgress";

interface LogClientProps {
    ratings: Record<string, any>;
    defaultSource: string;
    enabledSources: string[];
    username?: string;
}

export default function LogClient({ ratings: initialRatings, defaultSource, enabledSources, username }: LogClientProps) {
    const [sortBy, setSortBy] = useState<"rating" | "time" | "release">("time");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
    const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");
    const [showSettings, setShowSettings] = useState(false);
    const [activeStream, setActiveStream] = useState<{
        tmdbId: string; title: string; details: any; embedUrl: string;
    } | null>(null);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [selectedShowDetails, setSelectedShowDetails] = useState<any | null>(null);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);
    const [episodesList, setEpisodesList] = useState<number[]>([]);
    const [playerSource, setPlayerSource] = useState<string | null>(null);

    const router = useRouter();

    const { effectiveEnabledSources, effectiveSource } = useSourcePrefs(defaultSource, enabledSources);
    const currentActiveSource = playerSource || effectiveSource;

    const {
        searchQuery, setSearchQuery,
        searchResults, isSearching,
        searchLoading,
        isMobileSearchOpen, setIsMobileSearchOpen,
        handleSearch
    } = useSearch();

    const { ratings: ratingsMap, handleRate, handleDeleteRating, refreshContinueWatching } = useUserLists({ ratings: initialRatings });

    const ratings = useMemo(() => {
        return Object.values(ratingsMap).filter((item: any) => item && item.movieDetails);
    }, [ratingsMap]);

    const playLogItem = async (item: any) => {
        const details = item.movieDetails;
        if (!details?.id) return;
        const isTv = details.media_type === "tv";
        const tmdbId = isTv ? `tv-${details.id}-${selectedSeason}-${selectedEpisode}` : String(details.id);
        const title = details.title || details.name || "Untitled";
        const resolvedTitle = isTv ? `${title} S${String(selectedSeason).padStart(2, "0")}E${String(selectedEpisode).padStart(2, "0")}` : title;
        if (isTv) {
            try {
                const tmdbData = await getDetails(details.id, "tv");
                if (tmdbData) {
                    setSelectedShowDetails(tmdbData);
                    const seasonObj = tmdbData.seasons?.find((s: any) => s.season_number === 1);
                    const epCount = seasonObj?.episode_count || 1;
                    setSelectedSeason(1); setSelectedEpisode(1);
                    setEpisodesList(Array.from({ length: epCount }, (_, i) => i + 1));
                } else {
                    setSelectedShowDetails(null); setEpisodesList([]);
                }
            } catch { setSelectedShowDetails(null); setEpisodesList([]); }
        } else {
            setSelectedShowDetails(null); setEpisodesList([]); setSelectedSeason(1); setSelectedEpisode(1);
        }
        setPlayerError(null);
        const embedUrl = buildEmbedUrl(currentActiveSource, details.id, isTv ? "tv" : "movie", isTv ? 1 : undefined, isTv ? 1 : undefined, 0);
        setPlayerSource(currentActiveSource);
        setActiveStream({ tmdbId, title: resolvedTitle, details, embedUrl });
    };

    const handleSourceChange = (newSource: string) => {
        setPlayerSource(newSource);
        if (!activeStream) return;
        const details = activeStream.details;
        const isTv = details?.media_type === "tv";
        const newUrl = buildEmbedUrl(newSource, details?.id, isTv ? "tv" : "movie", isTv ? selectedSeason : undefined, isTv ? selectedEpisode : undefined);
        setActiveStream({ ...activeStream, embedUrl: newUrl });
    };

    const closePlayer = () => {
        flushGlobalProgress();
        setActiveStream(null);
        setPlayerError(null);
        setPlayerSource(null);
        refreshContinueWatching();
    };

    const changeEpisode = (season: number, episode: number) => {
        if (!activeStream) return;
        setSelectedSeason(season); setSelectedEpisode(episode);
        setActiveStream({ ...activeStream, embedUrl: buildEmbedUrl(playerSource || effectiveSource, activeStream.details.id, "tv", season, episode, 0) });
    };

    const handleDesktopSearch = (e: any) => {
        e.preventDefault();
        if (searchQuery) {
            sessionStorage.setItem("pendingSearch", searchQuery);
            router.push("/");
        }
    };

    const totalMovies = ratings.filter((r: any) => r.movieDetails?.media_type === "movie").length;
    const totalTv = ratings.filter((r: any) => r.movieDetails?.media_type === "tv").length;

    const filteredRatings = useMemo(() => {
        return mediaFilter === "all" ? ratings : ratings.filter((r: any) =>
            mediaFilter === "tv" ? r.movieDetails?.media_type === "tv" : r.movieDetails?.media_type !== "tv"
        );
    }, [ratings, mediaFilter]);

    const sortedRatings = useMemo(() => {
        return [...filteredRatings].sort((a: any, b: any) => {
            let result = 0;
            if (sortBy === "rating") {
                result = b.rating - a.rating;
            } else if (sortBy === "release") {
                const dateA = new Date(a.movieDetails.release_date || a.movieDetails.first_air_date || 0).getTime();
                const dateB = new Date(b.movieDetails.release_date || b.movieDetails.first_air_date || 0).getTime();
                result = dateB - dateA;
            } else {
                result = (b.ratedAt || 0) - (a.ratedAt || 0);
            }
            return sortOrder === "asc" ? -result : result;
        });
    }, [filteredRatings, sortBy, sortOrder]);

    return (
        <main className="min-h-screen bg-black text-slate-100 font-sans selection:bg-white/20 pb-20 relative overflow-hidden">
            <div className="w-full flex-shrink-0 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pt-4 md:pt-3">
                <Navbar onSettingsClick={() => setShowSettings(true)} currentPath="/log" username={username}>
                    <SearchInput
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        handleSearch={handleDesktopSearch}
                    />
                </Navbar>
            </div>

            <div className="hero-transition w-full flex-1 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pb-12">

                <div className="flex items-center justify-center gap-4 md:gap-6 mt-8 md:mt-16 mb-4 text-[10px] font-medium tracking-[0.2em] text-slate-500 uppercase">
                    <span>{ratings.length} <span className="text-slate-600">rated</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>{totalMovies} <span className="text-slate-600">movies</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>{totalTv} <span className="text-slate-600">series</span></span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-8 md:mb-12 text-[10px] font-semibold tracking-[0.28em] uppercase text-slate-300">
                    <SortButton active={mediaFilter === "all"} onClick={() => setMediaFilter("all")} label="Both" />
                    <SortButton active={mediaFilter === "movie"} onClick={() => setMediaFilter("movie")} label="Movies" />
                    <SortButton active={mediaFilter === "tv"} onClick={() => setMediaFilter("tv")} label="Series" />

                    <span className="text-white/20 font-light">|</span>

                    <SortButton active={sortBy === "time"} onClick={() => setSortBy("time")} label="Recent" />
                    <SortButton active={sortBy === "rating"} onClick={() => setSortBy("rating")} label="Rating" />
                    <SortButton active={sortBy === "release"} onClick={() => setSortBy("release")} label="Release" />

                    <span className="text-white/20 font-light">|</span>

                    <button
                        onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                        className="transition-colors duration-200 cursor-pointer text-slate-500 hover:text-white"
                    >
                        {sortOrder === "desc" ? "DESC" : "ASC"}
                    </button>
                </div>

                {sortedRatings.length === 0 ? (
                    <div className="text-center py-32 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                            <Film className="w-6 h-6 text-white/20" />
                        </div>
                        <div className="text-[11px] text-white/40 uppercase tracking-widest font-light">
                            {mediaFilter === "all" ? "You haven't rated anything yet." : mediaFilter === "movie" ? "No rated movies found." : "No rated series found."}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6 md:gap-x-5 md:gap-y-10">
                        {sortedRatings.map((item: any) => (
                            <div key={`${item.movieDetails.media_type || "movie"}-${item.movieDetails.id}`} className="group flex flex-col cursor-pointer" onClick={() => playLogItem(item)}>
                                <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800/40 shadow-md group-hover:border-white/40 transition-all duration-300">
                                    {item.movieDetails.backdrop_path || item.movieDetails.poster_path ? (
                                        <FadeImage
                                            src={item.movieDetails.backdrop_path ? getBackdropUrl(item.movieDetails.backdrop_path) : getPosterUrl(item.movieDetails.poster_path)}
                                            alt={item.movieDetails.title || item.movieDetails.name || "Poster"}
                                            fill
                                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 15vw"
                                            className="object-cover brightness-90 group-hover:brightness-100"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                                            <Film className="w-6 h-6 text-slate-600" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/90 md:bg-black/40 md:backdrop-blur-xl px-2.5 py-1.5 rounded-full border border-white/10 shadow-xl opacity-90 group-hover:opacity-100 transition-opacity">
                                        <Star className="w-3 h-3 fill-slate-300 text-slate-300 drop-shadow-[0_0_6px_rgba(203,213,225,0.4)]" />
                                        <span className="text-[10px] font-bold text-white tracking-wide">{item.rating}</span>
                                    </div>
                                </div>
                                <div className="mt-4 px-1">
                                    <h3 className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors duration-300">
                                        {item.movieDetails.title || item.movieDetails.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-500 uppercase tracking-[0.2em] font-medium">
                                        <span>{(item.movieDetails.release_date || item.movieDetails.first_air_date || "").split("-")[0]}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                                        <span>{item.movieDetails.media_type === "tv" ? "Series" : "Movie"}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <PlayerModal
                activeStream={activeStream}
                playerError={playerError}
                effectiveSource={playerSource || effectiveSource}
                effectiveEnabledSources={effectiveEnabledSources}
                selectedShowDetails={selectedShowDetails}
                selectedSeason={selectedSeason}
                selectedEpisode={selectedEpisode}
                episodesList={episodesList}
                ratings={ratingsMap}
                watchlist={[]}
                onClose={closePlayer}
                onSourceChange={handleSourceChange}
                onRate={handleRate}
                onChangeEpisode={changeEpisode}
                onToggleWatchlist={() => {}}
                onPlaySimilar={() => {}}
                onDelete={handleDeleteRating}
                initialTab="controls"
            />

            <MobileBottomNav
                activeStream={activeStream}
                isMobileSearchOpen={isMobileSearchOpen}
                setIsMobileSearchOpen={setIsMobileSearchOpen}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearch={handleSearch}
                searchResults={searchResults}
                isSearching={isSearching}
                searchLoading={searchLoading}
                setShowSettings={setShowSettings}
                currentPath="/log"
            />

            <SettingsOverlay isOpen={showSettings} onClose={() => setShowSettings(false)} onSourcesChange={() => {}} username={username} />
        </main>
    );
}

function SortButton({ active, onClick, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`transition-colors duration-200 cursor-pointer ${active ? "text-white" : "text-slate-500 hover:text-white"}`}
        >
            {label}
        </button>
    );
}
