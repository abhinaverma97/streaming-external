"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Film, X, Search, Home as HomeIcon, List, Settings as SettingsIcon } from "lucide-react";
import Navbar from "../components/Navbar";
import SettingsOverlay from "../components/SettingsOverlay";


const getPosterUrl = (path: string) => path ? `https://image.tmdb.org/t/p/w500${path}` : "";
const getBackdropUrl = (path: string) => path ? `https://image.tmdb.org/t/p/w500${path}` : "";

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
            .catch(err => {
                console.error(err);
                setLoading(false);
            });

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
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants: any = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <main className="min-h-screen bg-black text-slate-100 font-sans selection:bg-white/20 pb-20 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

            <div className="w-full flex-shrink-0 max-w-[96vw] mx-auto px-4 md:px-12 flex flex-col z-20 pt-4 md:pt-3">
                {/* Navbar */}
                <Navbar onSettingsClick={() => setShowSettings(true)} currentPath="/log">
                    <form onSubmit={handleSearch} className="flex items-center justify-end gap-4 flex-1">
                        <div className="relative w-48 md:w-64">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pr-6 py-1 bg-transparent focus:outline-none text-inherit placeholder-slate-600 transition-all duration-300"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </form>
                </Navbar>

                {/* Stats */}
                <div className="flex items-center justify-center gap-4 md:gap-6 mt-8 md:mt-16 mb-4 text-[10px] font-medium tracking-[0.2em] text-slate-500 uppercase">
                    <span>{ratings.length} <span className="text-slate-600">rated</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>{totalMovies} <span className="text-slate-600">movies</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>{totalTv} <span className="text-slate-600">series</span></span>
                </div>

                {/* Controls - Center aligned, purely textual matching home page section headers */}
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
                        variants={containerVariants as any}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6 md:gap-x-5 md:gap-y-10"
                    >
                        {sortedRatings.map((item) => (
                            <motion.div variants={itemVariants as any} key={item.movieDetails.id} className="group flex flex-col cursor-default">
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
                                    {/* Glassmorphic Rating Badge */}
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

            {/* Mobile Bottom Navigation (Glassmorphic) */}
            <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-[400px]">
                <nav className="flex items-center justify-between px-6 py-4 rounded-full bg-[#090b14]/70 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                    {/* Home */}
                    <Link href="/" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200">
                        <HomeIcon className="w-5 h-5" />
                    </Link>

                    {/* Log */}
                    <Link href="/log" className="flex flex-col items-center gap-1 text-slate-200">
                        <List className="w-5 h-5" />
                    </Link>

                    {/* Search Toggle */}
                    <button onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200">
                        <Search className="w-5 h-5" />
                    </button>

                    {/* Settings */}
                    <button onClick={() => setShowSettings(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200">
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                </nav>

                {/* Mobile Search Input Overlay */}
                <AnimatePresence>
                    {isMobileSearchOpen && (
                        <motion.form
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            onSubmit={(e) => { handleSearch(e); setIsMobileSearchOpen(false); }}
                            className="absolute bottom-full mb-4 left-0 w-full"
                        >
                            <input
                                type="text"
                                placeholder="Search movies..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-6 py-4 rounded-3xl bg-[#090b14]/90 backdrop-blur-2xl border border-white/10 text-sm focus:outline-none focus:border-white/20 text-white placeholder-slate-500 shadow-2xl"
                                autoFocus
                            />
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>

            {/* ── SETTINGS OVERLAY ── */}
            <SettingsOverlay isOpen={showSettings} onClose={() => setShowSettings(false)} onSourcesChange={(enabled, defaultSource) => {
                localStorage.setItem("bitcine-enabled-sources", JSON.stringify(enabled));
                localStorage.setItem("bitcine-default-source", defaultSource);
                fetch("/api/source-prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, defaultSource }) }).catch(() => {});
            }} />
        </main>
    );
}

function SortButton({ active, onClick, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`transition-colors duration-200 cursor-pointer ${active
                    ? "text-white"
                    : "text-slate-500 hover:text-white"
                }`}
        >
            {label}
        </button>
    );
}
