"use client";

import { memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Home as HomeIcon, List, Settings as SettingsIcon, Film, Star, Sparkles } from "lucide-react";
import { getPosterUrl } from "../lib/tmdb-utils";

interface MobileBottomNavProps {
    activeStream: any;
    isMobileSearchOpen: boolean;
    setIsMobileSearchOpen: (v: boolean) => void;
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    handleSearch: (e: React.FormEvent) => void;
    setShowSettings: (v: boolean) => void;
    currentPath: string;
    searchResults?: any[];
    isSearching?: boolean;
    searchLoading?: boolean;
    onCardClick?: (movie: any) => void;
}

function MobileBottomNavInner({
    activeStream,
    isMobileSearchOpen,
    setIsMobileSearchOpen,
    searchQuery,
    setSearchQuery,
    handleSearch,
    setShowSettings,
    currentPath,
    searchResults = [],
    isSearching = false,
    searchLoading = false,
    onCardClick,
}: MobileBottomNavProps) {
    const router = useRouter();
    const showResults = isMobileSearchOpen && isSearching && searchQuery;

    return (
        <>
            {!activeStream && (
                <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-[400px]">
                    {/* Mobile Search Results Overlay */}
                    {showResults && (
                        <div
                            className="absolute bottom-[calc(100%+88px)] left-0 w-full max-h-[60vh] overflow-y-auto bg-[#090b14]/70 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl p-2 no-scrollbar origin-bottom transition-all duration-200 ease-out"
                            style={{ opacity: 1, transform: "translateY(0) scaleY(1)" }}
                        >
                            {searchLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-5 h-5 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {searchResults.map((movie) => (
                                        <div
                                            key={movie.id}
                                            onClick={() => {
                                                if (currentPath !== "/") {
                                                    sessionStorage.setItem("pendingStream", JSON.stringify(movie));
                                                    router.push("/");
                                                } else if (onCardClick) {
                                                    onCardClick(movie);
                                                }
                                                setIsMobileSearchOpen(false);
                                                setSearchQuery("");
                                            }}
                                            className="relative h-24 rounded-xl overflow-hidden bg-slate-800 cursor-pointer active:scale-[0.98] transition-all group"
                                        >
                                            {movie.backdrop_path ? (
                                                <Image
                                                    src={getPosterUrl(movie.backdrop_path)}
                                                    alt=""
                                                    fill
                                                    sizes="(max-width: 400px) 90vw"
                                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Film className="w-5 h-5 text-slate-500" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#090b14]/90 via-[#090b14]/10 to-transparent" />
                                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                                <div className="text-sm font-semibold text-white truncate leading-snug">
                                                    {movie.title || movie.name}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-white/50">
                                                        {(movie.release_date || movie.first_air_date || "").split("-")[0] || "—"}
                                                    </span>
                                                    {movie.vote_average ? (
                                                        <span className="flex items-center gap-0.5 text-[10px] text-white/50">
                                                            <Star className="w-2.5 h-2.5 fill-white/40 text-white/40" />
                                                            {movie.vote_average.toFixed(1)}
                                                        </span>
                                                    ) : null}
                                                    <span className="ml-auto text-[8px] uppercase tracking-wider text-white/40 border border-white/10 rounded-full px-2 py-0.5 bg-white/[0.04]">
                                                        {movie.media_type === "tv" ? "Series" : "Movie"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 gap-2">
                                    <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                                        <Film className="w-3.5 h-3.5 text-white/20" />
                                    </div>
                                    <div className="text-[10px] text-white/30 tracking-wider">
                                        No results found
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Search Input */}
                    {isMobileSearchOpen && (
                        <form
                            onSubmit={(e) => { handleSearch(e); setIsMobileSearchOpen(false); }}
                            className="absolute bottom-full mb-4 left-0 w-full transition-all duration-200 ease-out"
                        >
                            <input
                                type="text"
                                placeholder="Search movies..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-6 py-4 rounded-3xl bg-[#090b14]/70 backdrop-blur-2xl border border-white/10 text-sm focus:outline-none focus:border-white/20 text-white placeholder-slate-500 shadow-2xl"
                                autoFocus
                            />
                        </form>
                    )}

                    {/* Nav Bar */}
                    <nav className="flex items-center justify-between px-6 py-4 rounded-full bg-[#090b14]/70 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                        <Link href="/" className={`flex flex-col items-center gap-1 ${currentPath === "/" ? "text-slate-200" : "text-slate-400 hover:text-slate-200"}`}>
                            <HomeIcon className="w-5 h-5" />
                        </Link>
                        <Link href="/log" className={`flex flex-col items-center gap-1 ${currentPath === "/log" ? "text-slate-200" : "text-slate-400 hover:text-slate-200"}`}>
                            <List className="w-5 h-5" />
                        </Link>
                        <Link href="/recommend" className={`flex flex-col items-center gap-1 ${currentPath === "/recommend" ? "text-slate-200" : "text-slate-400 hover:text-slate-200"}`}>
                            <Sparkles className="w-5 h-5" />
                        </Link>
                        <button onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)} className={`flex flex-col items-center gap-1 ${isMobileSearchOpen ? "text-slate-200" : "text-slate-400 hover:text-slate-200"}`}>
                            <Search className="w-5 h-5" />
                        </button>
                        <button onClick={() => setShowSettings(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200">
                            <SettingsIcon className="w-5 h-5" />
                        </button>
                    </nav>
                </div>
            )}
        </>
    );
}

export const MobileBottomNav = memo(MobileBottomNavInner);
