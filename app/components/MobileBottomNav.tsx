"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Home as HomeIcon, List, Settings as SettingsIcon, Film } from "lucide-react";
import { getCardBackdropUrl } from "../lib/tmdb-utils";

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
    onCardClick,
}: MobileBottomNavProps) {
    return (
        <>
            {!activeStream && (
                <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-[400px]">
                    {/* Mobile Search Results Overlay */}
                    <AnimatePresence>
                        {isMobileSearchOpen && (isSearching || searchResults.length > 0) && searchQuery && (
                            <motion.div
                                key="mobile-search-results"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="absolute bottom-[calc(100%+88px)] left-0 w-full max-h-[50vh] overflow-y-auto bg-[#090b14]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 no-scrollbar"
                            >
                                {searchResults.length > 0 ? (
                                    searchResults.map((movie) => (
                                        <div
                                            key={movie.id}
                                            onClick={() => {
                                                if (onCardClick) onCardClick(movie);
                                                setIsMobileSearchOpen(false);
                                                setSearchQuery("");
                                            }}
                                            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.05] cursor-pointer transition-colors"
                                        >
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
                                                {movie.backdrop_path ? (
                                                    <Image
                                                        src={getCardBackdropUrl(movie.backdrop_path)}
                                                        alt=""
                                                        width={40}
                                                        height={40}
                                                        className="object-cover w-full h-full"
                                                    />
                                                ) : (
                                                    <Film className="w-4 h-4 text-slate-500" />
                                                )}
                                            </div>
                                            <span className="text-xs text-white/80 truncate">{movie.title || movie.name}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-[11px] text-white/40">
                                        No results found for &ldquo;{searchQuery}&rdquo;
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Search Input */}
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

                    {/* Nav Bar */}
                    <nav className="flex items-center justify-between px-6 py-4 rounded-full bg-[#090b14]/70 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                        <Link href="/" className={`flex flex-col items-center gap-1 ${currentPath === "/" ? "text-slate-200" : "text-slate-400 hover:text-slate-200"}`}>
                            <HomeIcon className="w-5 h-5" />
                        </Link>
                        <Link href="/log" className={`flex flex-col items-center gap-1 ${currentPath === "/log" ? "text-slate-200" : "text-slate-400 hover:text-slate-200"}`}>
                            <List className="w-5 h-5" />
                        </Link>
                        <button onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200">
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
