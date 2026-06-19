"use client";

import { memo, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NavbarProps {
  onSettingsClick: () => void;
  currentPath: string;
  children?: React.ReactNode;
}

function NavbarInner({ onSettingsClick, currentPath, children }: NavbarProps) {
  const [username, setUsername] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUsername(data.username || null))
      .catch(() => setUsername(null));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSignOut(false);
      }
    };
    if (showSignOut) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSignOut]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setShowSignOut(false);
    setUsername(null);
    router.push("/login");
  }, [router]);

  return (
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
        <Link
          href="/recommend"
          className={`transition-colors duration-200 cursor-pointer ${
            currentPath === "/recommend" ? "text-white" : "hover:text-white"
          }`}
        >
          Recs
        </Link>
      </nav>

      <div className="flex items-center justify-end gap-3 flex-1 ml-6" ref={containerRef}>
        {username ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSignOut((v) => !v)}
              className="capitalize text-white/80 hover:text-white transition-colors duration-200 cursor-pointer"
            >
              {username}
            </button>
            {showSignOut && (
              <>
                <span className="text-white/15">·</span>
                <button
                  onClick={handleLogout}
                  className="hover:text-white transition-colors duration-200 cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="hover:text-white transition-colors duration-200 cursor-pointer"
          >
            Sign Up
          </Link>
        )}
        {children}
      </div>
    </header>
  );
}

export const Navbar = memo(NavbarInner);