"use client";

import Link from "next/link";
import { Home, List, Settings } from "lucide-react";

interface NavbarProps {
  onSettingsClick: () => void;
  currentPath: string;
  children?: React.ReactNode;
}

export default function Navbar({ onSettingsClick, currentPath, children }: NavbarProps) {
  return (
    <>
      {/* Desktop Navbar */}
      <header className="hidden md:flex py-3 items-center justify-between text-[10px] tracking-[0.28em] text-slate-300">
        <div className="flex items-center flex-1">
          <button
            onClick={onSettingsClick}
            className="hover:text-white transition-colors duration-200 cursor-pointer ml-3"
          >
            Settings
          </button>
        </div>

        <nav className="flex items-center justify-center gap-5 flex-shrink-0">
          <Link
            href="/"
            className={`transition-colors duration-200 cursor-pointer ${
              currentPath === "/" ? "text-white" : "hover:text-white"
            }`}
          >
            Home
          </Link>
          <Link
            href="/log"
            className={`transition-colors duration-200 cursor-pointer ${
              currentPath === "/log" ? "text-white" : "hover:text-white"
            }`}
          >
            Log
          </Link>
        </nav>

        <div className="flex items-center justify-end gap-4 flex-1">
          {children}
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-[400px]">
        <nav className="flex items-center justify-between px-6 py-4 rounded-full bg-[#090b14]/70 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 ${
              currentPath === "/" ? "text-slate-200" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Home className="w-5 h-5" />
          </Link>

          <Link
            href="/log"
            className={`flex flex-col items-center gap-1 ${
              currentPath === "/log" ? "text-slate-200" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <List className="w-5 h-5" />
          </Link>

          <button
            onClick={onSettingsClick}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200"
          >
            <Settings className="w-5 h-5" />
          </button>
        </nav>
      </div>
    </>
  );
}
