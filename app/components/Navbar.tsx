"use client";

import { memo } from "react";
import Link from "next/link";

interface NavbarProps {
  onSettingsClick: () => void;
  currentPath: string;
  children?: React.ReactNode;
}

function NavbarInner({ onSettingsClick, currentPath, children }: NavbarProps) {
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
    </>
  );
}

export const Navbar = memo(NavbarInner);
