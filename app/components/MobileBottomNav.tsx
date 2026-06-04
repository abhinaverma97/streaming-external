"use client";

import { memo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Home as HomeIcon, List, Settings as SettingsIcon } from "lucide-react";

interface MobileBottomNavProps {
    activeStream: any;
    isMobileSearchOpen: boolean;
    setIsMobileSearchOpen: (v: boolean) => void;
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    handleSearch: (e: React.FormEvent) => void;
    setShowSettings: (v: boolean) => void;
    currentPath: string;
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
}: MobileBottomNavProps) {
    return (
        <>
            {!activeStream && (
                <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-[400px]">
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
            )}
        </>
    );
}

export const MobileBottomNav = memo(MobileBottomNavInner);
