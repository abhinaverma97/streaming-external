"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Film, X, Search, Home as HomeIcon, List, Settings as SettingsIcon } from "lucide-react";
import Navbar from "../components/Navbar";
import SettingsOverlay from "../components/SettingsOverlay";
import { SearchInput } from "../components/SearchInput";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { getBackdropUrl, getPosterUrl } from "../lib/tmdb-utils";

export default function LogPage() {
    const [ratings, setRatings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<"rating" | "time" | "release">("time");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
    const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        fetch(`/api/ratings`)
            .then(res => res.json())
            .then(data => {
                const arr = Object.values(data).filter((item: any) => item && item.movieDetails);
                setRatings(arr);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSearch = (e: any) => {
        e.preventDefault();
        if (searchQuery) {
            window.location.href = `/?q=${encodeURIComponent(searchQuery)}`;
        }
    };

    const totalMovies = ratings.filter((r: any) => r.movieDetails?.media_type === "movie" || (!r.movieDetails?.name && !r.movieDetails?.media_type)).length;
    const totalTv = ratings.filter((r: any) => r.movieDetails?.media_type === "tv" || r.movieDetails?.name).length;
    const isTv = (r: any) => r.movieDetails?.media_type === "tv" || !!r.movieDetails?.name;

    const filteredRatings = mediaFilter === "all" ? ratings : ratings.filter((r: any) => mediaFilter === "tv" ? isTv(r) : !isTv(r));

    const sortedRatings = [...filteredRatings].sort((a, b) => {
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

    const containerVariants: any = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };

    const itemVariants: any = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <main className="min-h-screen bg-black text-slate-100 font-sans selection:bg-white/20 pb-20 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

            <div className="w-full flex-shrink-0 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pt-4 md:pt-3">
                <Navbar onSettingsClick={() => setShowSettings(true)} currentPath="/log">
                    <SearchInput
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        handleSearch={handleSearch}
                    />
                </Navbar>

                {/* Stats */}
                <div className="flex items-center justify-center gap-4 md:gap-6 mt-8 md:mt-16 mb-4 text-[10px] font-medium tracking-[0.2em] text-slate-500 uppercase">
                    <span>{ratings.length} <span className="text-slate-600">rated</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>{totalMovies} <span className="text-slate-600">movies</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>{totalTv} <span className="text-slate-600">series</span></span>
                </div>

                {/* Controls */}
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

                {/* Grid */}
                {loading ? (
                    <div className="flex justify-center py-32">
                        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                    </div>
                ) : sortedRatings.length === 0 ? (
                    <div className="text-center py-32 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                            <Film className="w-6 h-6 text-white/20" />
                        </div>
                        <div className="text-[11px] text-white/40 uppercase tracking-widest font-light">
                            {mediaFilter === "all" ? "You haven't rated anything yet." : mediaFilter === "movie" ? "No rated movies found." : "No rated series found."}
                        </div>
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6 md:gap-x-5 md:gap-y-10"
                    >
                        {sortedRatings.map((item) => (
                            <motion.div variants={itemVariants} key={item.movieDetails.id} className="group flex flex-col cursor-default">
                                <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800/40 shadow-md group-hover:border-white/40 transition-all duration-300">
                                    {item.movieDetails.backdrop_path || item.movieDetails.poster_path ? (
                                        <Image
                                            src={item.movieDetails.backdrop_path ? getBackdropUrl(item.movieDetails.backdrop_path) : getPosterUrl(item.movieDetails.poster_path)}
                                            alt={item.movieDetails.title || item.movieDetails.name || "Poster"}
                                            fill
                                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 15vw"
                                            className="object-cover brightness-90 group-hover:brightness-100 transition-all duration-300"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                                            <Film className="w-6 h-6 text-slate-600" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-xl px-2.5 py-1.5 rounded-full border border-white/10 shadow-xl opacity-90 group-hover:opacity-100 transition-opacity">
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
                                        <span>{item.movieDetails.media_type === "tv" || item.movieDetails.name ? "Series" : "Movie"}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>

            <MobileBottomNav
                activeStream={false}
                isMobileSearchOpen={isMobileSearchOpen}
                setIsMobileSearchOpen={setIsMobileSearchOpen}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearch={(e: any) => { handleSearch(e); setIsMobileSearchOpen(false); }}
                setShowSettings={setShowSettings}
                currentPath="/log"
            />

            <SettingsOverlay isOpen={showSettings} onClose={() => setShowSettings(false)} onSourcesChange={(enabled, defaultSource) => {
                fetch("/api/source-prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, defaultSource }) }).catch(() => {});
            }} />
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
